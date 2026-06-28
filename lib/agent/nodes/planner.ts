import { AgentStateType, ResearchPlan } from "../state";
import { getModel, withRetry } from "../model";

/**
 * PLANNER NODE
 * Takes raw company name → identifies ticker, sector, generates research plan.
 * This is the first node in the pipeline.
 */
export async function plannerNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const model = getModel();

  const response = await withRetry(() => model.invoke([
    {
      role: "system",
      content: `You are a financial research planner. Given a company name, identify its details and create a research plan.
      
You MUST respond with ONLY a valid JSON object (no markdown, no code fences) in this exact format:
{
  "ticker": "STOCK_TICKER",
  "exchange": "EXCHANGE_NAME (e.g. NYSE, NASDAQ, NSE, BSE)",
  "sector": "Sector name",
  "industry": "Industry name",
  "companyFullName": "Full legal company name",
  "searchQueries": ["query1", "query2", "query3", "query4", "query5"],
  "focusAreas": ["area1", "area2", "area3"]
}

For searchQueries, generate 5 targeted search queries that would reveal:
1. Recent news and developments
2. Financial performance and earnings
3. Analyst opinions and price targets
4. Competitive landscape
5. Risks, controversies, or regulatory issues

For focusAreas, identify 3 key areas that matter most for this company's sector.

If the company is not publicly traded or you can't identify a ticker, use "UNKNOWN" for ticker and exchange.`,
    },
    {
      role: "user",
      content: `Research planning for company: ${state.company}`,
    },
  ]));

  try {
    const content =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    // Strip markdown code fences if present
    const cleaned = content.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();
    const plan: ResearchPlan = JSON.parse(cleaned);

    return {
      plan,
      currentNode: "planner",
    };
  } catch (error) {
    return {
      plan: {
        ticker: "UNKNOWN",
        exchange: "UNKNOWN",
        sector: "Unknown",
        industry: "Unknown",
        companyFullName: state.company,
        searchQueries: [
          `${state.company} latest news`,
          `${state.company} financial performance`,
          `${state.company} analyst rating`,
          `${state.company} stock analysis`,
          `${state.company} risks and challenges`,
        ],
        focusAreas: [
          "Financial Performance",
          "Market Position",
          "Growth Prospects",
        ],
      },
      currentNode: "planner",
      errors: [
        `Planner warning: Could not parse structured plan, using defaults. ${error}`,
      ],
    };
  }
}
