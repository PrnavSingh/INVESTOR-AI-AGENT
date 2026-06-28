import { NextRequest } from "next/server";
import { buildResearchGraph } from "@/lib/agent/graph";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Allow up to 2 minutes for full research

/**
 * POST /api/research
 *
 * Accepts { company: string } and streams the agent's progress as SSE events.
 * Each event has: { type, node, data }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const company = body.company?.trim();

    if (!company) {
      return new Response(
        JSON.stringify({ error: "Company name is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate API keys
    if (!process.env.GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (
          type: string,
          node: string,
          data: Record<string, unknown>
        ) => {
          const event = JSON.stringify({ type, node, data });
          controller.enqueue(encoder.encode(`data: ${event}\n\n`));
        };

        try {
          const graph = buildResearchGraph();

          sendEvent("node_start", "planner", {
            message: "Planning research strategy...",
          });

          // Use stream() to get state updates after each node
          const streamResult = graph.stream(
            { company },
            { 
              streamMode: "updates" as const,
            }
          );

          const nodeOrder = [
            "planner",
            "researcher",
            "financial_analyst",
            "sentiment_analyzer",
            "final_verdict",
          ];

          const nodeMessages: Record<string, { start: string; complete: string }> = {
            planner: {
              start: "Planning research strategy...",
              complete: "Research plan ready",
            },
            researcher: {
              start: "Searching for recent news & analyst opinions...",
              complete: "Web research complete",
            },
            financial_analyst: {
              start: "Fetching financial metrics...",
              complete: "Financial data loaded",
            },
            sentiment_analyzer: {
              start: "Analyzing news sentiment...",
              complete: "Sentiment analysis complete",
            },
            final_verdict: {
              start: "Generating investment verdict...",
              complete: "Analysis complete",
            },
          };

          let lastNodeIndex = -1;

          for await (const update of await streamResult) {
            // update is keyed by node name: { nodeName: { ...state updates } }
            const updateRecord = update as Record<string, Record<string, unknown>>;
            const nodeNames = Object.keys(updateRecord);

            for (const nodeName of nodeNames) {
              const nodeData = updateRecord[nodeName];
              const currentIndex = nodeOrder.indexOf(nodeName);

              // Send completion for current node
              sendEvent("node_complete", nodeName, {
                message: nodeMessages[nodeName]?.complete || `${nodeName} complete`,
                ...nodeData,
              });

              // Send start for next node
              const nextIndex = currentIndex + 1;
              if (nextIndex < nodeOrder.length) {
                const nextNode = nodeOrder[nextIndex];
                sendEvent("node_start", nextNode, {
                  message: nodeMessages[nextNode]?.start || `Starting ${nextNode}...`,
                });
              }

              lastNodeIndex = currentIndex;
            }
          }

          // Send final done event
          sendEvent("done", "complete", {
            message: "Research complete",
          });
        } catch (error) {
          sendEvent("error", "system", {
            message:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
