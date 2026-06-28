import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState } from "./state";
import { plannerNode } from "./nodes/planner";
import { researcherNode } from "./nodes/researcher";
import { financialAnalystNode } from "./nodes/financial-analyst";
import { sentimentAnalyzerNode } from "./nodes/sentiment-analyzer";
import { verdictNode } from "./nodes/verdict";

/**
 * Build the Investment Research Agent Graph
 *
 * Flow:
 *   START → planner → researcher → financial_analyst → sentiment_analyzer → verdict → END
 *                                         │
 *                                    (if ticker unknown, still continues but with partial data)
 *
 * Each node updates the shared AgentState. Conditional edges handle
 * error states gracefully — the pipeline always reaches a verdict.
 */
export function buildResearchGraph() {
  const workflow = new StateGraph(AgentState)
    // Add all 5 nodes
    .addNode("planner", plannerNode)
    .addNode("researcher", researcherNode)
    .addNode("financial_analyst", financialAnalystNode)
    .addNode("sentiment_analyzer", sentimentAnalyzerNode)
    .addNode("final_verdict", verdictNode)

    // Define the pipeline flow
    .addEdge(START, "planner")
    .addEdge("planner", "researcher")
    .addEdge("researcher", "financial_analyst")
    .addEdge("financial_analyst", "sentiment_analyzer")
    .addEdge("sentiment_analyzer", "final_verdict")
    .addEdge("final_verdict", END);

  return workflow.compile();
}
