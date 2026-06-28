import { AgentStateType, FinancialData } from "../state";

/**
 * FINANCIAL ANALYST NODE
 * Fetches key financial metrics using yahoo-finance2.
 * Gracefully handles missing data — if the ticker is unknown or data unavailable,
 * it marks data as unavailable and continues the pipeline.
 */
export async function financialAnalystNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const plan = state.plan;
  const ticker = plan?.ticker || "UNKNOWN";

  if (ticker === "UNKNOWN") {
    return {
      financialData: {
        ticker: "UNKNOWN",
        exchange: "UNKNOWN",
        currency: "USD",
        currentPrice: null,
        marketCap: null,
        peRatio: null,
        forwardPE: null,
        eps: null,
        epsGrowth: null,
        revenueGrowth: null,
        grossMargin: null,
        operatingMargin: null,
        netMargin: null,
        debtToEquity: null,
        dividendYield: null,
        fiftyTwoWeekHigh: null,
        fiftyTwoWeekLow: null,
        beta: null,
        available: false,
      },
      currentNode: "financial_analyst",
      errors: ["Financial Analyst: No valid ticker found, skipping financial data"],
    };
  }

  try {
    // Dynamic import yahoo-finance2 (ESM module)
    const yahooFinance = (await import("yahoo-finance2")).default;

    // Build ticker symbol for Yahoo Finance
    // For Indian stocks (NSE/BSE), append .NS or .BO
    let yahooTicker = ticker;
    if (plan?.exchange === "NSE") {
      yahooTicker = `${ticker}.NS`;
    } else if (plan?.exchange === "BSE") {
      yahooTicker = `${ticker}.BO`;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yahooFinance.quoteSummary(yahooTicker, {
      modules: [
        "price",
        "summaryDetail",
        "financialData",
        "defaultKeyStatistics",
      ] as const,
    });

    const price = result.price;
    const summary = result.summaryDetail;
    const financial = result.financialData;
    const keyStats = result.defaultKeyStatistics;

    const financialData: FinancialData = {
      ticker: yahooTicker,
      exchange: price?.exchangeName || plan?.exchange || "Unknown",
      currency: price?.currency || "USD",
      currentPrice: price?.regularMarketPrice ?? null,
      marketCap: price?.marketCap ?? null,
      peRatio: summary?.trailingPE ?? null,
      forwardPE: summary?.forwardPE ?? keyStats?.forwardPE ?? null,
      eps: keyStats?.trailingEps ?? null,
      epsGrowth: keyStats?.earningsQuarterlyGrowth ?? null,
      revenueGrowth: financial?.revenueGrowth ?? null,
      grossMargin: financial?.grossMargins ?? null,
      operatingMargin: financial?.operatingMargins ?? null,
      netMargin: financial?.profitMargins ?? null,
      debtToEquity: financial?.debtToEquity ?? null,
      dividendYield: summary?.dividendYield ?? null,
      fiftyTwoWeekHigh: summary?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: summary?.fiftyTwoWeekLow ?? null,
      beta: summary?.beta ?? null,
      available: true,
    };

    return {
      financialData,
      currentNode: "financial_analyst",
    };
  } catch (error) {
    return {
      financialData: {
        ticker,
        exchange: plan?.exchange || "Unknown",
        currency: "USD",
        currentPrice: null,
        marketCap: null,
        peRatio: null,
        forwardPE: null,
        eps: null,
        epsGrowth: null,
        revenueGrowth: null,
        grossMargin: null,
        operatingMargin: null,
        netMargin: null,
        debtToEquity: null,
        dividendYield: null,
        fiftyTwoWeekHigh: null,
        fiftyTwoWeekLow: null,
        beta: null,
        available: false,
      },
      currentNode: "financial_analyst",
      errors: [
        `Financial Analyst: Failed to fetch data for ${ticker}: ${error}`,
      ],
    };
  }
}
