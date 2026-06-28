import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ResearchResult } from "@/lib/types";

/**
 * Generates a professional investment research PDF report.
 * Covers: verdict, thesis, financials, sentiment, bull/bear cases,
 * risks, catalysts, full reasoning, and sources.
 */
export function generatePDFReport(data: ResearchResult) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const companyName = data.plan?.companyFullName || "Company";
  const ticker = data.plan?.ticker || "";
  const exchange = data.plan?.exchange || "";
  const verdict = data.verdict;
  const fin = data.financialData;
  const sentiment = data.sentimentAnalysis;

  // ─── Helper: add page break if needed ───
  const checkPage = (needed: number) => {
    if (y + needed > 275) {
      doc.addPage();
      y = 20;
    }
  };

  // ─── Helper: wrapped text ───
  const addWrappedText = (text: string, x: number, startY: number, maxW: number, fontSize: number, style: "normal" | "bold" | "italic" = "normal"): number => {
    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      checkPage(6);
      doc.text(line, x, y);
      y += fontSize * 0.45;
    }
    return y;
  };

  // ─── Helper: section header ───
  const addSectionHeader = (title: string, color: [number, number, number] = [37, 99, 235]) => {
    checkPage(16);
    y += 6;
    doc.setDrawColor(...color);
    doc.setFillColor(...color);
    doc.rect(margin, y - 4, 3, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...color);
    doc.text(title, margin + 7, y + 3);
    doc.setTextColor(0, 0, 0);
    y += 14;
  };

  // ═══════════════════════════════════
  // COVER / HEADER
  // ═══════════════════════════════════
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 48, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text("InvestorAI", margin, 22);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("AI-Powered Investment Research Report", margin, 30);

  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, margin, 38);

  // Company name bar
  doc.setFillColor(245, 247, 252);
  doc.rect(0, 48, pageWidth, 20, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(12, 16, 36);
  doc.text(companyName, margin, 61);

  if (ticker) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 120);
    doc.text(`${ticker} · ${exchange}`, margin + doc.getTextWidth(companyName + "  ") + 4, 61);
  }

  y = 78;
  doc.setTextColor(0, 0, 0);

  // ═══════════════════════════════════
  // 1. VERDICT SUMMARY
  // ═══════════════════════════════════
  if (verdict) {
    addSectionHeader("Investment Verdict", [37, 99, 235]);

    // Verdict badge
    const verdictColor: [number, number, number] =
      verdict.verdict === "BUY" ? [5, 150, 105] :
      verdict.verdict === "HOLD" ? [217, 119, 6] :
      [220, 38, 38];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...verdictColor);
    doc.text(verdict.verdict, margin, y);

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 120);
    doc.text(`Confidence: ${verdict.confidence}%`, margin + 40, y);

    if (verdict.priceTarget) {
      doc.text(`Target: ${verdict.priceTarget}`, margin + 100, y);
    }

    y += 10;
    doc.setTextColor(0, 0, 0);

    // Thesis
    addWrappedText(verdict.thesis, margin, y, contentWidth, 11, "italic");
    y += 4;
  }

  // ═══════════════════════════════════
  // 2. FINANCIAL SNAPSHOT
  // ═══════════════════════════════════
  if (fin?.available) {
    addSectionHeader("Financial Snapshot", [8, 145, 178]);

    const fmtCap = (v: number | null) => {
      if (v === null) return "N/A";
      if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
      if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
      if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
      return `$${v.toLocaleString()}`;
    };
    const fmtPct = (v: number | null) => v === null ? "N/A" : `${(v * 100).toFixed(1)}%`;
    const fmtNum = (v: number | null) => v === null ? "N/A" : v.toFixed(2);
    const cur = fin.currency === "INR" ? "₹" : "$";

    const metricsData = [
      ["Price", fin.currentPrice ? `${cur}${fin.currentPrice.toLocaleString()}` : "N/A"],
      ["Market Cap", fmtCap(fin.marketCap)],
      ["P/E Ratio", fmtNum(fin.peRatio)],
      ["Forward P/E", fmtNum(fin.forwardPE)],
      ["EPS", fmtNum(fin.eps)],
      ["Revenue Growth", fmtPct(fin.revenueGrowth)],
      ["Gross Margin", fmtPct(fin.grossMargin)],
      ["Net Margin", fmtPct(fin.netMargin)],
      ["Debt/Equity", fmtNum(fin.debtToEquity)],
      ["52W High", fin.fiftyTwoWeekHigh ? `${cur}${fin.fiftyTwoWeekHigh.toLocaleString()}` : "N/A"],
      ["52W Low", fin.fiftyTwoWeekLow ? `${cur}${fin.fiftyTwoWeekLow.toLocaleString()}` : "N/A"],
      ["Beta", fmtNum(fin.beta)],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: metricsData,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: { fillColor: [8, 145, 178], textColor: 255, fontStyle: "bold", fontSize: 10 },
      bodyStyles: { fontSize: 10, cellPadding: 3 },
      alternateRowStyles: { fillColor: [245, 247, 252] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ═══════════════════════════════════
  // 3. SENTIMENT ANALYSIS
  // ═══════════════════════════════════
  if (sentiment) {
    addSectionHeader("Sentiment Analysis", [234, 88, 12]);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const sentColor: [number, number, number] =
      sentiment.overallLabel === "Bullish" ? [5, 150, 105] :
      sentiment.overallLabel === "Bearish" ? [220, 38, 38] :
      [217, 119, 6];
    doc.setTextColor(...sentColor);
    doc.text(`Overall: ${sentiment.overallLabel} (Score: ${sentiment.overallScore.toFixed(2)})`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    if (sentiment.summary) {
      addWrappedText(sentiment.summary, margin, y, contentWidth, 10);
      y += 4;
    }

    // Red Flags
    if (sentiment.redFlags.length > 0) {
      checkPage(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(220, 38, 38);
      doc.text("Red Flags:", margin, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
      doc.setFont("helvetica", "normal");
      for (const flag of sentiment.redFlags) {
        checkPage(6);
        addWrappedText(`• ${flag}`, margin + 4, y, contentWidth - 4, 10);
        y += 1;
      }
      y += 3;
    }

    // Catalysts
    if (sentiment.catalysts.length > 0) {
      checkPage(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(5, 150, 105);
      doc.text("Catalysts:", margin, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
      doc.setFont("helvetica", "normal");
      for (const cat of sentiment.catalysts) {
        checkPage(6);
        addWrappedText(`• ${cat}`, margin + 4, y, contentWidth - 4, 10);
        y += 1;
      }
      y += 3;
    }
  }

  // ═══════════════════════════════════
  // 4. BULL CASE
  // ═══════════════════════════════════
  if (verdict?.bullCase?.length) {
    addSectionHeader("Bull Case", [5, 150, 105]);
    for (let i = 0; i < verdict.bullCase.length; i++) {
      addWrappedText(`${i + 1}. ${verdict.bullCase[i]}`, margin, y, contentWidth, 10);
      y += 3;
    }
  }

  // ═══════════════════════════════════
  // 5. BEAR CASE
  // ═══════════════════════════════════
  if (verdict?.bearCase?.length) {
    addSectionHeader("Bear Case", [220, 38, 38]);
    for (let i = 0; i < verdict.bearCase.length; i++) {
      addWrappedText(`${i + 1}. ${verdict.bearCase[i]}`, margin, y, contentWidth, 10);
      y += 3;
    }
  }

  // ═══════════════════════════════════
  // 6. KEY RISKS
  // ═══════════════════════════════════
  if (verdict?.keyRisks?.length) {
    addSectionHeader("Key Risks", [217, 119, 6]);
    for (let i = 0; i < verdict.keyRisks.length; i++) {
      addWrappedText(`${i + 1}. ${verdict.keyRisks[i]}`, margin, y, contentWidth, 10);
      y += 3;
    }
  }

  // ═══════════════════════════════════
  // 7. KEY CATALYSTS
  // ═══════════════════════════════════
  if (verdict?.keyCatalysts?.length) {
    addSectionHeader("Key Catalysts", [8, 145, 178]);
    for (let i = 0; i < verdict.keyCatalysts.length; i++) {
      addWrappedText(`${i + 1}. ${verdict.keyCatalysts[i]}`, margin, y, contentWidth, 10);
      y += 3;
    }
  }

  // ═══════════════════════════════════
  // 8. FULL REASONING
  // ═══════════════════════════════════
  if (verdict?.fullReasoning) {
    addSectionHeader("Full Reasoning", [124, 58, 237]);
    addWrappedText(verdict.fullReasoning, margin, y, contentWidth, 10);
    y += 4;
  }

  // ═══════════════════════════════════
  // 9. NEWS ARTICLES
  // ═══════════════════════════════════
  if (data.newsData?.length) {
    addSectionHeader("News Articles Analyzed", [234, 88, 12]);

    const newsRows = data.newsData.slice(0, 10).map((n, i) => [
      `${i + 1}`,
      n.title.length > 70 ? n.title.slice(0, 70) + "…" : n.title,
      n.source || "—",
      n.sentimentLabel || "—",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["#", "Title", "Source", "Sentiment"]],
      body: newsRows,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [255, 249, 245] },
      columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 85 }, 2: { cellWidth: 35 }, 3: { cellWidth: 25 } },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ═══════════════════════════════════
  // 10. SOURCES
  // ═══════════════════════════════════
  if (data.sources?.length) {
    addSectionHeader("Research Sources", [37, 99, 235]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(37, 99, 235);
    for (const src of data.sources) {
      checkPage(5);
      const truncated = src.length > 100 ? src.slice(0, 100) + "…" : src;
      doc.textWithLink(truncated, margin, y, { url: src });
      y += 4;
    }
    doc.setTextColor(0, 0, 0);
  }

  // ═══════════════════════════════════
  // FOOTER on all pages
  // ═══════════════════════════════════
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 180);
    doc.text(
      `InvestorAI · AI-Powered Investment Research · Page ${i}/${pageCount}`,
      pageWidth / 2,
      290,
      { align: "center" }
    );
    doc.text("InsideIIM × Altuni AI Labs", pageWidth / 2, 294, { align: "center" });
  }

  // ═══════════════════════════════════
  // SAVE
  // ═══════════════════════════════════
  const filename = `InvestorAI-Report-${ticker || companyName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
