/**
 * Types shared between API and frontend for streaming events
 */

export interface StreamEvent {
  type: "node_start" | "node_complete" | "data" | "error" | "done";
  node: string;
  data: Record<string, unknown>;
}

export interface ResearchResult {
  plan: {
    ticker: string;
    exchange: string;
    sector: string;
    industry: string;
    companyFullName: string;
    searchQueries: string[];
    focusAreas: string[];
  } | null;
  newsData: {
    title: string;
    url: string;
    content: string;
    source: string;
    publishedDate?: string;
    sentiment?: number;
    sentimentLabel?: string;
  }[];
  financialData: {
    ticker: string;
    exchange: string;
    currency: string;
    currentPrice: number | null;
    marketCap: number | null;
    peRatio: number | null;
    forwardPE: number | null;
    eps: number | null;
    epsGrowth: number | null;
    revenueGrowth: number | null;
    grossMargin: number | null;
    operatingMargin: number | null;
    netMargin: number | null;
    debtToEquity: number | null;
    dividendYield: number | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
    beta: number | null;
    available: boolean;
  } | null;
  sentimentAnalysis: {
    overallScore: number;
    overallLabel: string;
    redFlags: string[];
    catalysts: string[];
    summary: string;
  } | null;
  verdict: {
    verdict: "BUY" | "HOLD" | "PASS";
    confidence: number;
    thesis: string;
    priceTarget: string | null;
    bullCase: string[];
    bearCase: string[];
    keyRisks: string[];
    keyCatalysts: string[];
    fullReasoning: string;
  } | null;
  sources: string[];
  errors: string[];
}

export type NodeStatus = "waiting" | "active" | "complete" | "error";

export interface NodeProgress {
  id: string;
  label: string;
  icon: string;
  status: NodeStatus;
  message: string;
}
