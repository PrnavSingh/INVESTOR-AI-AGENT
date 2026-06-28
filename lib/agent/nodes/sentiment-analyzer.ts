import { AgentStateType, SentimentAnalysis } from "../state";
import { getModel, withRetry } from "../model";

/**
 * SENTIMENT ANALYZER NODE
 * Analyzes news sentiment using Claude. Scores each item and identifies
 * red flags (negative catalysts) and positive catalysts.
 */
export async function sentimentAnalyzerNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const newsData = state.newsData;

  if (!newsData || newsData.length === 0) {
    return {
      sentimentAnalysis: {
        overallScore: 0,
        overallLabel: "Neutral",
        redFlags: ["No news data available for analysis"],
        catalysts: [],
        summary: "Insufficient news data to perform sentiment analysis.",
      },
      newsData: newsData,
      currentNode: "sentiment_analyzer",
    };
  }

  const model = getModel();

  const newsText = newsData
    .map(
      (item, i) =>
        `[${i + 1}] "${item.title}" (${item.source})\n${item.content}`
    )
    .join("\n\n---\n\n");

  const response = await withRetry(() => model.invoke([
    {
      role: "system",
      content: `You are a financial sentiment analyst. Analyze the following news articles about a company and provide a sentiment assessment.

You MUST respond with ONLY a valid JSON object (no markdown, no code fences) in this exact format:
{
  "overallScore": <number from -1.0 to 1.0>,
  "overallLabel": "<Bullish|Neutral|Bearish>",
  "redFlags": ["flag1", "flag2", ...],
  "catalysts": ["catalyst1", "catalyst2", ...],
  "summary": "2-3 sentence summary of the sentiment landscape",
  "articleSentiments": [
    { "index": 1, "score": <-1 to 1>, "label": "<Positive|Neutral|Negative>" },
    ...
  ]
}

Scoring guide:
- -1.0 to -0.3: Bearish (lawsuits, earnings miss, regulatory trouble, downgrades)
- -0.3 to 0.3: Neutral (routine updates, mixed signals)
- 0.3 to 1.0: Bullish (earnings beat, upgrades, new products, partnerships)

Red flags: lawsuits, regulatory issues, earnings misses, executive departures, debt concerns
Catalysts: earnings beats, new products, partnerships, analyst upgrades, market expansion`,
    },
    {
      role: "user",
      content: `Company: ${state.plan?.companyFullName || state.company}\n\nNews Articles:\n${newsText}`,
    },
  ]));

  try {
    const content =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    const cleaned = content.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();
    const analysis = JSON.parse(cleaned);

    // Update news items with individual sentiment scores
    const updatedNews = newsData.map((item, i) => {
      const articleSentiment = analysis.articleSentiments?.find(
        (a: { index: number }) => a.index === i + 1
      );
      return {
        ...item,
        sentiment: articleSentiment?.score ?? 0,
        sentimentLabel: articleSentiment?.label ?? "Neutral",
      };
    });

    const sentimentAnalysis: SentimentAnalysis = {
      overallScore: analysis.overallScore,
      overallLabel: analysis.overallLabel,
      redFlags: analysis.redFlags || [],
      catalysts: analysis.catalysts || [],
      summary: analysis.summary,
    };

    return {
      sentimentAnalysis,
      newsData: updatedNews,
      currentNode: "sentiment_analyzer",
    };
  } catch (error) {
    return {
      sentimentAnalysis: {
        overallScore: 0,
        overallLabel: "Neutral",
        redFlags: [],
        catalysts: [],
        summary: "Failed to parse sentiment analysis.",
      },
      currentNode: "sentiment_analyzer",
      errors: [`Sentiment Analyzer: Parse error: ${error}`],
    };
  }
}
