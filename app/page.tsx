"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { POPULAR_COMPANIES } from "@/lib/companies";
import { generatePDFReport } from "@/lib/pdf-report";
import type {
  ResearchResult,
  NodeProgress,
  StreamEvent,
} from "@/lib/types";

/* ════════════════════════════════════
   Initial Pipeline Node Config
   ════════════════════════════════════ */
const INITIAL_NODES: NodeProgress[] = [
  { id: "planner", label: "Research Planner", icon: "🎯", status: "waiting", message: "Identifying company & planning research" },
  { id: "researcher", label: "Web Researcher", icon: "🔍", status: "waiting", message: "Searching news & analyst opinions" },
  { id: "financial_analyst", label: "Financial Analyst", icon: "📊", status: "waiting", message: "Fetching financial metrics" },
  { id: "sentiment_analyzer", label: "Sentiment Analyzer", icon: "🧠", status: "waiting", message: "Analyzing news sentiment" },
  { id: "final_verdict", label: "Investment Verdict", icon: "⚖️", status: "waiting", message: "Synthesizing final recommendation" },
];

/* ════════════════════════════════════
   Main Page
   ════════════════════════════════════ */
export default function HomePage() {
  const [query, setQuery] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isResearching, setIsResearching] = useState(false);
  const [nodes, setNodes] = useState<NodeProgress[]>(INITIAL_NODES);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<Record<string, boolean>>({
    bull: true, bear: true, risks: false, catalysts: false, reasoning: false,
  });
  const [copied, setCopied] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);

  const filtered = query.length > 0
    ? POPULAR_COMPANIES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.ticker.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowAutocomplete(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ═══════ SSE Research Handler ═══════ */
  const startResearch = useCallback(
    async (company: string) => {
      if (!company.trim() || isResearching) return;
      setIsResearching(true);
      setResult(null);
      setError(null);
      setShowAutocomplete(false);
      setNodes(INITIAL_NODES.map((n) => ({ ...n })));

      const acc: ResearchResult = {
        plan: null, newsData: [], financialData: null,
        sentimentAnalysis: null, verdict: null, sources: [], errors: [],
      };

      try {
        const res = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Request failed");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No stream");
        const dec = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() || "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data: ")) continue;
            try {
              const ev: StreamEvent = JSON.parse(line.slice(6));

              if (ev.type === "node_start") {
                setNodes((p) =>
                  p.map((n) =>
                    n.id === ev.node
                      ? { ...n, status: "active", message: (ev.data.message as string) || n.message }
                      : n
                  )
                );
              }

              if (ev.type === "node_complete") {
                const d = ev.data;
                if (ev.node === "planner" && d.plan) acc.plan = d.plan as ResearchResult["plan"];
                if (ev.node === "researcher" && d.newsData) {
                  acc.newsData = d.newsData as ResearchResult["newsData"];
                  acc.sources = (d.sources as string[]) || [];
                }
                if (ev.node === "financial_analyst" && d.financialData) acc.financialData = d.financialData as ResearchResult["financialData"];
                if (ev.node === "sentiment_analyzer") {
                  if (d.sentimentAnalysis) acc.sentimentAnalysis = d.sentimentAnalysis as ResearchResult["sentimentAnalysis"];
                  if (d.newsData) acc.newsData = d.newsData as ResearchResult["newsData"];
                }
                if (ev.node === "final_verdict" && d.verdict) acc.verdict = d.verdict as ResearchResult["verdict"];

                setNodes((p) =>
                  p.map((n) =>
                    n.id === ev.node
                      ? { ...n, status: "complete", message: (ev.data.message as string) || "Done" }
                      : n
                  )
                );
                setResult({ ...acc });
              }

              if (ev.type === "error") {
                setError(ev.data.message as string);
                setNodes((p) => p.map((n) => (n.status === "active" ? { ...n, status: "error" } : n)));
              }
              if (ev.type === "done") setResult({ ...acc });
            } catch { /* skip */ }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        setIsResearching(false);
      }
    },
    [isResearching]
  );

  const submit = (e: React.FormEvent) => { e.preventDefault(); startResearch(query); };
  const pick = (name: string) => { setQuery(name); setShowAutocomplete(false); startResearch(name); };
  const toggle = (k: string) => setSections((p) => ({ ...p, [k]: !p[k] }));

  const onKey = (e: React.KeyboardEvent) => {
    if (!showAutocomplete || !filtered.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightedIndex((p) => (p < filtered.length - 1 ? p + 1 : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightedIndex((p) => (p > 0 ? p - 1 : filtered.length - 1)); }
    else if (e.key === "Enter" && highlightedIndex >= 0) { e.preventDefault(); pick(filtered[highlightedIndex].name); }
  };

  const exportJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${result.plan?.ticker || "company"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    if (!result?.verdict) return;
    const v = result.verdict;
    const txt = `${v.verdict} (${v.confidence}%)\n\n${v.thesis}\n\nBull:\n${v.bullCase.map((x) => `• ${x}`).join("\n")}\n\nBear:\n${v.bearCase.map((x) => `• ${x}`).join("\n")}\n\n${v.fullReasoning}`;
    await navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmtCap = (v: number | null) => {
    if (v === null) return "N/A";
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    return `$${v.toLocaleString()}`;
  };
  const fmtPct = (v: number | null) => (v === null ? "N/A" : `${(v * 100).toFixed(1)}%`);
  const fmtNum = (v: number | null, d = 2) => (v === null ? "N/A" : v.toFixed(d));

  const verdictColor = (v: string) =>
    v === "BUY" ? "var(--verdict-green)" : v === "HOLD" ? "var(--verdict-amber)" : v === "PASS" ? "var(--verdict-red)" : "inherit";

  /* ═══════════════════════════════════
     RENDER
     ═══════════════════════════════════ */
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px 80px" }}>

      {/* ════ HERO ════ */}
      <header className="hero">
        <div className="hero-chip"><span>✦</span> AI-Powered Research Agent</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 42 }}>📈</span>
          <h1 className="hero-title">InvestorAI</h1>
        </div>
        <p className="hero-sub">
          Enter any company to get an instant <b className="v-buy">BUY</b> / <b className="v-hold">HOLD</b> / <b className="v-pass">PASS</b> verdict
          — powered by a 5-node AI agent pipeline with live financial data &amp; sentiment analysis.
        </p>
      </header>

      {/* ════ SEARCH ════ */}
      <div ref={searchRef} className="search-wrap">
        <form onSubmit={submit}>
          <div style={{ position: "relative" }}>
            <span className="search-icon">🔍</span>
            <input
              id="company-search"
              type="text"
              className="search-input"
              placeholder="Search any company — Tesla, Reliance, NVIDIA..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowAutocomplete(!!e.target.value); setHighlightedIndex(-1); }}
              onFocus={() => query && setShowAutocomplete(true)}
              onKeyDown={onKey}
              disabled={isResearching}
            />
            {query && !isResearching && (
              <button type="submit" className="btn-primary" style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", padding: "10px 22px", fontSize: 13, borderRadius: 100 }}>
                Analyze →
              </button>
            )}
            {isResearching && (
              <div style={{ position: "absolute", right: 22, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 8, color: "var(--pipeline-accent)", fontSize: 13, fontWeight: 600 }}>
                <div className="spinner" /> Analyzing…
              </div>
            )}
          </div>
        </form>
        {showAutocomplete && filtered.length > 0 && (
          <div className="autocomplete-dropdown">
            {filtered.map((c, i) => (
              <div key={c.ticker} className={`autocomplete-item ${i === highlightedIndex ? "highlighted" : ""}`} onClick={() => pick(c.name)}>
                <span className="company-name">{c.name}</span>
                <span className="company-ticker">{c.ticker} · {c.exchange}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════ ERROR ════ */}
      {error && <div className="error-bar"><span>⚠️</span> {error}</div>}

      {/* ════ PIPELINE ════ */}
      {(isResearching || result) && (
        <div className="section-pipeline fade-in">
          <div className="card" style={{ padding: "24px 28px" }}>
            <div className="card-accent-bar" />
            <div className="pipeline-header">
              <span>🤖</span> Agent Pipeline
              {result?.plan && <span className="tag">{result.plan.ticker} · {result.plan.exchange}</span>}
            </div>
            {nodes.map((n) => (
              <div key={n.id} className="step">
                <div className={`step-dot ${n.status}`}>
                  {n.status === "active" ? <div className="spinner" /> : n.status === "complete" ? "✓" : n.status === "error" ? "✕" : n.icon}
                </div>
                <div>
                  <div className="step-label" style={{ color: n.status === "active" ? "var(--pipeline-accent)" : n.status === "complete" ? "var(--verdict-green)" : n.status === "error" ? "var(--verdict-red)" : "var(--text-secondary)" }}>
                    {n.label}
                  </div>
                  <div className="step-msg">{n.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════ VERDICT ════ */}
      {result?.verdict && (
        <div className="section-verdict fade-in fade-in-d1">
          <div className="card">
            <div className="card-accent-bar" style={{ background: `linear-gradient(90deg, ${verdictColor(result.verdict.verdict)}, ${result.verdict.verdict === "BUY" ? "#34d399" : result.verdict.verdict === "HOLD" ? "#fbbf24" : "#f87171"})` }} />
            <div className="verdict-card-inner">
              <div className={`verdict-badge ${result.verdict.verdict.toLowerCase()}`}>{result.verdict.verdict}</div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 36, marginTop: 30, flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <div className="confidence-ring">
                    <svg viewBox="0 0 100 100" width="100" height="100">
                      <circle className="ring-bg" cx="50" cy="50" r="42" />
                      <circle className="ring-fill" cx="50" cy="50" r="42" style={{
                        stroke: verdictColor(result.verdict.verdict),
                        strokeDasharray: `${2 * Math.PI * 42}`,
                        strokeDashoffset: `${2 * Math.PI * 42 * (1 - result.verdict.confidence / 100)}`,
                      }} />
                    </svg>
                    <div className="confidence-num" style={{ color: verdictColor(result.verdict.verdict) }}>{result.verdict.confidence}%</div>
                  </div>
                  <div className="confidence-lbl">Confidence</div>
                </div>

                <div className="thesis-wrap">
                  <div className="thesis-tag">Investment Thesis</div>
                  <p className="thesis-body">{result.verdict.thesis}</p>
                  {result.verdict.priceTarget && <div className="price-tag">🎯 Target: {result.verdict.priceTarget}</div>}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 28 }}>
                <button className="btn-ghost" onClick={() => result && generatePDFReport(result)}>📄 PDF Report</button>
                <button className="btn-ghost" onClick={exportJSON}>📥 Export JSON</button>
                <button className="btn-ghost" onClick={copy}>{copied ? "✅ Copied!" : "📋 Copy Report"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ FINANCIALS ════ */}
      {result?.financialData?.available && (
        <div className="section-finance fade-in fade-in-d2">
          <div className="section-hdr">
            <span className="icon">📊</span> Financial Snapshot
            <span className="sub">{result.financialData.ticker} · {result.financialData.exchange}</span>
          </div>
          <div className="metrics-grid">
            {[
              { l: "Price", v: result.financialData.currentPrice ? `${result.financialData.currency === "INR" ? "₹" : "$"}${result.financialData.currentPrice.toLocaleString()}` : "N/A" },
              { l: "Market Cap", v: fmtCap(result.financialData.marketCap) },
              { l: "P/E Ratio", v: fmtNum(result.financialData.peRatio) },
              { l: "Forward P/E", v: fmtNum(result.financialData.forwardPE) },
              { l: "EPS", v: fmtNum(result.financialData.eps) },
              { l: "Rev Growth", v: fmtPct(result.financialData.revenueGrowth), pct: true, raw: result.financialData.revenueGrowth },
              { l: "Gross Margin", v: fmtPct(result.financialData.grossMargin) },
              { l: "Net Margin", v: fmtPct(result.financialData.netMargin), pct: true, raw: result.financialData.netMargin },
              { l: "Debt/Equity", v: fmtNum(result.financialData.debtToEquity) },
              { l: "52W High", v: result.financialData.fiftyTwoWeekHigh ? `${result.financialData.currency === "INR" ? "₹" : "$"}${result.financialData.fiftyTwoWeekHigh.toLocaleString()}` : "N/A" },
              { l: "52W Low", v: result.financialData.fiftyTwoWeekLow ? `${result.financialData.currency === "INR" ? "₹" : "$"}${result.financialData.fiftyTwoWeekLow.toLocaleString()}` : "N/A" },
              { l: "Beta", v: fmtNum(result.financialData.beta) },
            ].map((m) => (
              <div key={m.l} className="metric-card">
                <div className="metric-label">{m.l}</div>
                <div className={`metric-value ${m.pct && m.raw != null ? (m.raw > 0 ? "positive" : m.raw < 0 ? "negative" : "") : ""}`}>{m.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════ NEWS & SENTIMENT ════ */}
      {result?.newsData && result.newsData.length > 0 && (
        <div className="section-news fade-in fade-in-d3">
          <div className="section-hdr">
            <span className="icon">📰</span> News &amp; Sentiment
            {result.sentimentAnalysis && (
              <span className={`sentiment-badge ${result.sentimentAnalysis.overallLabel === "Bullish" ? "positive" : result.sentimentAnalysis.overallLabel === "Bearish" ? "negative" : "neutral"}`} style={{ marginLeft: "auto" }}>
                {result.sentimentAnalysis.overallLabel} ({result.sentimentAnalysis.overallScore.toFixed(2)})
              </span>
            )}
          </div>

          {result.sentimentAnalysis?.summary && <div className="sentiment-summary">{result.sentimentAnalysis.summary}</div>}

          {result.sentimentAnalysis && (
            <div className="signal-pills">
              {result.sentimentAnalysis.redFlags.map((f, i) => <span key={`r${i}`} className="pill red">🚩 {f}</span>)}
              {result.sentimentAnalysis.catalysts.map((c, i) => <span key={`c${i}`} className="pill green">🚀 {c}</span>)}
            </div>
          )}

          <div className="card" style={{ overflow: "hidden" }}>
            {result.newsData.slice(0, 8).map((item, i) => (
              <div key={i} className="news-item">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
                    <div className="news-source">{item.source}</div>
                  </div>
                  {item.sentimentLabel && (
                    <span className={`sentiment-badge ${item.sentimentLabel === "Positive" ? "positive" : item.sentimentLabel === "Negative" ? "negative" : "neutral"}`} style={{ flexShrink: 0 }}>
                      {item.sentimentLabel}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════ DETAILED ANALYSIS ════ */}
      {result?.verdict && (
        <div className="section-analysis fade-in fade-in-d4">
          <div className="section-hdr"><span className="icon">📋</span> Detailed Analysis</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Accordion title="🟢 Bull Case" items={result.verdict.bullCase} open={sections.bull} toggle={() => toggle("bull")} color="var(--verdict-green)" />
            <Accordion title="🔴 Bear Case" items={result.verdict.bearCase} open={sections.bear} toggle={() => toggle("bear")} color="var(--verdict-red)" />
            <Accordion title="⚠️ Key Risks" items={result.verdict.keyRisks} open={sections.risks} toggle={() => toggle("risks")} color="var(--verdict-amber)" />
            <Accordion title="🚀 Key Catalysts" items={result.verdict.keyCatalysts} open={sections.catalysts} toggle={() => toggle("catalysts")} color="var(--finance-accent)" />

            <div className="card">
              <div className="collapsible-header" onClick={() => toggle("reasoning")}>
                <span className="collapse-title">📝 Full Reasoning</span>
                <span className={`collapse-arrow ${sections.reasoning ? "open" : ""}`}>▼</span>
              </div>
              <div className={`collapsible-content ${sections.reasoning ? "expanded" : "collapsed"}`}>
                <div className="reasoning-text">{result.verdict.fullReasoning}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ SOURCES ════ */}
      {result?.sources && result.sources.length > 0 && (
        <div className="section-sources fade-in fade-in-d4">
          <div className="section-hdr"><span className="icon">🔗</span> Sources</div>
          <div className="card" style={{ padding: "14px 22px" }}>
            {result.sources.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="source-link">{url}</a>
            ))}
          </div>
        </div>
      )}

      {/* ════ FOOTER ════ */}
      <footer className="app-footer">
        <div className="footer-chips">
          <span className="footer-chip">🧠 LangGraph.js</span>
          <span className="footer-chip">✨ Gemini</span>
          <span className="footer-chip">🔍 Tavily AI</span>
          <span className="footer-chip">📊 Yahoo Finance</span>
        </div>
        <p>InsideIIM × Altuni AI Labs · AI Investment Research Agent</p>
      </footer>
    </div>
  );
}

/* ═══════ Sub-component ═══════ */
function Accordion({ title, items, open, toggle, color }: {
  title: string; items: string[]; open: boolean; toggle: () => void; color: string;
}) {
  return (
    <div className="card">
      <div className="collapsible-header" onClick={toggle}>
        <span className="collapse-title">{title}</span>
        <span className={`collapse-arrow ${open ? "open" : ""}`}>▼</span>
      </div>
      <div className={`collapsible-content ${open ? "expanded" : "collapsed"}`}>
        <div style={{ padding: "0 22px 18px" }}>
          {items.map((item, i) => (
            <div key={i} className="analysis-item">
              <span className="analysis-num" style={{ color }}>{i + 1}</span>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
