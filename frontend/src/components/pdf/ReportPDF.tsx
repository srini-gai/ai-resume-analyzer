import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer";
import type { V2AnalysisResult } from "../../types";

const INDIGO = "#4F46E5";
const INDIGO_LIGHT = "#EEF2FF";
const GREEN = "#16A34A";
const GREEN_LIGHT = "#DCFCE7";
const RED = "#DC2626";
const RED_LIGHT = "#FEE2E2";
const SLATE = "#64748B";
const SLATE_LIGHT = "#F8FAFC";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: "#1E293B", paddingBottom: 40 },
  header: { backgroundColor: INDIGO, flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  headerLeft: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "white" },
  headerRight: { fontSize: 11, color: "#C7D2FE" },
  footer: { position: "absolute", bottom: 16, left: 24, right: 24, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: SLATE },
  body: { padding: 24 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: INDIGO, marginBottom: 8, marginTop: 16, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryBox: { backgroundColor: INDIGO_LIGHT, borderLeft: 3, borderLeftColor: INDIGO, padding: 12, borderRadius: 4 },
  summaryText: { fontSize: 10, lineHeight: 1.6, color: "#1E293B" },
  row: { flexDirection: "row", gap: 12 },
  scoreBox: { flex: 1, backgroundColor: INDIGO_LIGHT, borderRadius: 8, padding: 16, alignItems: "center" },
  scoreNumber: { fontSize: 32, fontFamily: "Helvetica-Bold", color: INDIGO },
  scoreLabel: { fontSize: 9, color: SLATE, marginTop: 2 },
  tableHeader: { flexDirection: "row", backgroundColor: SLATE_LIGHT, padding: 6, marginTop: 4 },
  tableHeaderCell: { fontFamily: "Helvetica-Bold", fontSize: 9, flex: 1 },
  tableRow: { flexDirection: "row", padding: 5, borderBottom: 0.5, borderBottomColor: "#E2E8F0" },
  tableCell: { flex: 1, fontSize: 9 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 8, fontFamily: "Helvetica-Bold", alignSelf: "flex-start" },
  keywordGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  keywordPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, fontSize: 8 },
  numberedItem: { flexDirection: "row", marginBottom: 6 },
  itemNum: { fontSize: 10, fontFamily: "Helvetica-Bold", color: INDIGO, width: 20 },
  itemText: { flex: 1, fontSize: 10, lineHeight: 1.5 },
  certCard: { backgroundColor: SLATE_LIGHT, borderRadius: 6, padding: 8, marginBottom: 6 },
  certText: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1E293B" },
});

function ReportPDFDocument({ data }: { data: V2AnalysisResult }) {
  const date = new Date().toLocaleDateString();
  const { gapAnalysis } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLeft}>ResumeIQ</Text>
          <Text style={styles.headerRight}>Resume Analysis Report</Text>
        </View>

        <View style={styles.body}>
          {/* Section 1: Executive Summary */}
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>{gapAnalysis.executiveSummary}</Text>
          </View>

          {/* Section 2: Score Overview */}
          <Text style={styles.sectionTitle}>Score Overview</Text>
          <View style={styles.row}>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreNumber}>{data.matchScore}%</Text>
              <Text style={styles.scoreLabel}>Match Score</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreNumber}>{data.strengthScore}%</Text>
              <Text style={styles.scoreLabel}>Strength Score</Text>
            </View>
          </View>

          {/* Section 3: Skills Analysis */}
          <Text style={styles.sectionTitle}>Skills Analysis</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderCell}>Skill</Text>
            <Text style={styles.tableHeaderCell}>Required</Text>
            <Text style={styles.tableHeaderCell}>Status</Text>
          </View>
          {gapAnalysis.skillsTable.filter(r => r.required || r.category === "bonus").slice(0, 20).map((row, i) => {
            const rowBg = row.category === "matched" ? GREEN_LIGHT : row.category === "missing" ? RED_LIGHT : SLATE_LIGHT;
            const badgeColor = row.category === "matched" ? GREEN : row.category === "missing" ? RED : SLATE;
            return (
              <View key={i} style={[styles.tableRow, { backgroundColor: rowBg }]}>
                <Text style={styles.tableCell}>{row.skill}</Text>
                <Text style={styles.tableCell}>{row.required ? "Yes" : "No"}</Text>
                <Text style={[styles.badge, { backgroundColor: badgeColor, color: "white" }]}>{row.category}</Text>
              </View>
            );
          })}

          {/* Section 4: Keyword Density */}
          <Text style={styles.sectionTitle}>Keyword Density</Text>
          <View style={styles.keywordGrid}>
            {gapAnalysis.keywordDensity.slice(0, 20).map((kw, i) => (
              <View key={i} style={[styles.keywordPill, { backgroundColor: kw.present ? GREEN_LIGHT : SLATE_LIGHT }]}>
                <Text style={{ color: kw.present ? GREEN : SLATE }}>{kw.keyword} ({kw.count})</Text>
              </View>
            ))}
          </View>

          {/* Section 5: Action Items */}
          <Text style={styles.sectionTitle}>Action Items</Text>
          {gapAnalysis.actionItems.map((item, i) => (
            <View key={i} style={styles.numberedItem}>
              <Text style={styles.itemNum}>{i + 1}.</Text>
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}

          {/* Section 6: Certifications */}
          <Text style={styles.sectionTitle}>Recommended Certifications</Text>
          {gapAnalysis.recommendedCertifications.map((cert, i) => (
            <View key={i} style={styles.certCard}>
              <Text style={styles.certText}>• {cert}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated by ResumeIQ • resumeanalyzer.pro • {date}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function ReportPDFDownloadLink({ data }: { data: V2AnalysisResult }) {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = (data.gapAnalysis?.candidateName ?? "Report").replace(/\s+/g, "_");
  const filename = `ResumeIQ_Analysis_${safeName}_${date}.pdf`;
  return (
    <PDFDownloadLink document={<ReportPDFDocument data={data} />} fileName={filename}>
      Download Full Report (PDF)
    </PDFDownloadLink>
  );
}

export { ReportPDFDocument, ReportPDFDownloadLink };
