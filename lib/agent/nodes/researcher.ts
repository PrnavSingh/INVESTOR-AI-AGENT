import { AgentStateType, NewsItem } from "../state";
import { tavily } from "@tavily/core";

/**
 * WEB RESEARCHER NODE
 * Uses Tavily AI Search to fetch recent news, analyst opinions, and company developments.
 * Runs multiple targeted search queries from the planner's output.
 */
export async function researcherNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const plan = state.plan;
  if (!plan) {
    return {
      currentNode: "researcher",
      errors: ["Researcher: No plan available, skipping web research"],
    };
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      currentNode: "researcher",
      errors: ["Researcher: TAVILY_API_KEY not set"],
    };
  }

  const tvly = tavily({ apiKey });
  const allNews: NewsItem[] = [];
  const allSources: string[] = [];
  const errors: string[] = [];

  // Run up to 3 search queries (to stay within rate limits)
  const queriesToRun = plan.searchQueries.slice(0, 3);

  for (const query of queriesToRun) {
    try {
      const result = await tvly.search(query, {
        maxResults: 5,
        searchDepth: "advanced",
        includeAnswer: false,
      });

      if (result.results) {
        for (const item of result.results) {
          // Avoid duplicates by URL
          if (!allSources.includes(item.url)) {
            allNews.push({
              title: item.title,
              url: item.url,
              content: item.content?.slice(0, 500) || "",
              source: extractDomain(item.url),
              publishedDate: undefined,
            });
            allSources.push(item.url);
          }
        }
      }
    } catch (error) {
      errors.push(`Researcher: Search failed for "${query}": ${error}`);
    }
  }

  return {
    newsData: allNews.slice(0, 10), // Cap at 10 items
    sources: allSources,
    currentNode: "researcher",
    errors: errors.length > 0 ? errors : [],
  };
}

/**
 * Extract domain name from URL for display
 */
function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    return domain;
  } catch {
    return "unknown";
  }
}
