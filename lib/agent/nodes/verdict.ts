import { AgentStateType, InvestmentVerdict } from "../state";
import { getModel, withRetry } from "../model";

/**
 * INVESTMENT VERDICT NODE
 * The final node — synthesizes ALL gathered data into a structured
 * BUY / HOLD / PASS verdict with full reasoning.
 */
export async function verdictNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const model = getModel();

  // Build context from all previous nodes
  const companyName = state.plan?.companyFullName || state.company;
  const ticker = state.plan?.ticker || "UNKNOWN";
  const sector = state.plan?.sector || "Unknown";

  // Financial summary
  let financialSummary = "Financial data unavailable.";
  if (state.financialData?.available) {
    const fd = state.financialData;
    financialSummary = `
Ticker: ${fd.ticker} | Exchange: ${fd.exchange} | Currency: ${fd.currency}
Current Price: ${fd.currentPrice ?? "N/A"}
Market Cap: ${fd.marketCap ? formatMarketCap(fd.marketCap) : "N/A"}
P/E Ratio: ${fd.peRatio?.toFixed(2) ?? "N/A"} | Forward P/E: ${fd.forwardPE?.toFixed(2) ?? "N/A"}
EPS: ${fd.eps?.toFixed(2) ?? "N/A"} | EPS Growth: ${fd.epsGrowth ? (fd.epsGrowth * 100).toFixed(1) + "%" : "N/A"}
Revenue Growth: ${fd.revenueGrowth ? (fd.revenueGrowth * 100).toFixed(1) + "%" : "N/A"}
Gross Margin: ${fd.grossMargin ? (fd.grossMargin * 100).toFixed(1) + "%" : "N/A"}
Operating Margin: ${fd.operatingMargin ? (fd.operatingMargin * 100).toFixed(1) + "%" : "N/A"}
Net Margin: ${fd.netMargin ? (fd.netMargin * 100).toFixed(1) + "%" : "N/A"}
Debt-to-Equity: ${fd.debtToEquity?.toFixed(2) ?? "N/A"}
Dividend Yield: ${fd.dividendYield ? (fd.dividendYield * 100).toFixed(2) + "%" : "N/A"}
52-Week Range: ${fd.fiftyTwoWeekLow ?? "N/A"} - ${fd.fiftyTwoWeekHigh ?? "N/A"}
Beta: ${fd.beta?.toFixed(2) ?? "N/A"}`;
  }

  // Sentiment summary
  let sentimentSummary = "Sentiment analysis unavailable.";
  if (state.sentimentAnalysis) {
    const sa = state.sentimentAnalysis;
    sentimentSummary = `
Overall Sentiment: ${sa.overallLabel} (Score: ${sa.overallScore.toFixed(2)})
Summary: ${sa.summary}
Red Flags: ${sa.redFlags.length > 0 ? sa.redFlags.join("; ") : "None identified"}
Catalysts: ${sa.catalysts.length > 0 ? sa.catalysts.join("; ") : "None identified"}`;
  }

  // News headlines
  const newsHeadlines =
    state.newsData.length > 0
      ? state.newsData
          .map(
            (n) =>
              `- "${n.title}" (${n.source}) [Sentiment: ${n.sentimentLabel || "N/A"}]`
          )
          .join("\n")
      : "No news articles available.";

  const response = await withRetry(() => model.invoke([
    {
      role: "system",
      content: `You are a senior investment analyst. Based on all the research data provided, generate a comprehensive investment verdict.

You MUST respond with ONLY a valid JSON object (no markdown, no code fences) in this exact format:
{
  "verdict": "BUY" | "HOLD" | "PASS",
  "confidence": <number 0-100>,
  "thesis": "One clear sentence summarizing your investment thesis",
  "priceTarget": "Price target with currency or null if insufficient data",
  "bullCase": ["point1", "point2", "point3"],
  "bearCase": ["point1", "point2", "point3"],
  "keyRisks": ["risk1", "risk2", "risk3"],
  "keyCatalysts": ["catalyst1", "catalyst2", "catalyst3"],
  "fullReasoning": "A 3-5 paragraph detailed analysis covering financial health, market position, growth trajectory, valuation, and sentiment. Be specific — cite actual numbers from the data."
}

Guidelines:
- BUY: Strong financials, positive catalysts, reasonable valuation, bullish sentiment. Confidence > 65%.
- HOLD: Mixed signals, fair valuation, some concerns but also positives. Confidence 40-65%.
- PASS: Weak financials, red flags, overvalued, bearish sentiment. Confidence > 60% (confident it's not a buy).
- Be data-driven — reference specific financial metrics and news items.
- If financial data is unavailable, base verdict on qualitative analysis (news, sentiment) and state lower confidence.
- bullCase, bearCase, keyRisks, keyCatalysts should each have 3-5 points.`,
    },
    {
      role: "user",
      content: `
COMPANY: ${companyName}
TICKER: ${ticker}
SECTOR: ${sector}

═══ FINANCIAL DATA ═══
${financialSummary}

═══ SENTIMENT ANALYSIS ═══
${sentimentSummary}

═══ NEWS HEADLINES ═══
${newsHeadlines}

Based on ALL of this data, provide your investment verdict.`,
    },
  ]));

  try {
    const content =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    const cleaned = content.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();
    const verdict: InvestmentVerdict = JSON.parse(cleaned);

    // Validate and clamp confidence
    verdict.confidence = Math.min(100, Math.max(0, verdict.confidence));

    return {
      verdict,
      currentNode: "verdict",
    };
  } catch (error) {
    return {
      verdict: {
        verdict: "HOLD",
        confidence: 30,
        thesis:
          "Unable to generate a complete analysis. Please review the data manually.",
        priceTarget: null,
        bullCase: ["Insufficient data for complete bull case analysis"],
        bearCase: ["Insufficient data for complete bear case analysis"],
        keyRisks: ["Analysis parsing failed — manual review recommended"],
        keyCatalysts: ["Unable to identify catalysts from available data"],
        fullReasoning: `The automated analysis encountered an error while synthesizing the research data for ${companyName}. The individual data points (financial metrics, news, sentiment) may still be valid and are displayed above. We recommend manual review of these data points to form your own investment thesis. Error: ${error}`,
      },
      currentNode: "verdict",
      errors: [`Verdict: Parse error: ${error}`],
    };
  }
}

/**
 * Format large numbers into readable market cap strings
 */
function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}
