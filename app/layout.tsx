import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InvestorAI — AI-Powered Investment Research Agent",
  description:
    "Get instant, data-driven investment verdicts powered by a multi-step AI agent. Analyzes financials, news sentiment, and market data to deliver BUY, HOLD, or PASS recommendations with full reasoning.",
  keywords: [
    "investment research",
    "AI agent",
    "stock analysis",
    "financial analysis",
    "sentiment analysis",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="bg-mesh" />
        <main style={{ position: "relative", zIndex: 1 }}>{children}</main>
      </body>
    </html>
  );
}
