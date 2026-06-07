import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer";
import type { OptimizedResume } from "../../types";

const styles = StyleSheet.create({
  page: { flexDirection: "row", fontFamily: "Helvetica" },
  sidebar: { width: "30%", backgroundColor: "#4F46E5", padding: 20, color: "white" },
  main: { width: "70%", padding: 24, backgroundColor: "#ffffff" },
  name: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "white", marginBottom: 4 },
  sidebarSection: { marginTop: 16 },
  sidebarLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#C7D2FE", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  sidebarText: { fontSize: 9, color: "#E0E7FF", marginBottom: 3 },
  divider: { height: 1, backgroundColor: "#6366F1", marginVertical: 8 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#4F46E5", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, marginTop: 14 },
  summaryText: { fontSize: 10, color: "#334155", lineHeight: 1.6 },
  bulletRow: { flexDirection: "row", marginBottom: 5, alignItems: "flex-start" },
  bullet: { width: 8, fontSize: 14, color: "#4F46E5", marginTop: -2, lineHeight: 1.2 },
  bulletText: { flex: 1, fontSize: 10, color: "#334155", lineHeight: 1.5 },
  skillTag: { fontSize: 9, color: "#4F46E5", marginBottom: 2 },
});

function ResumePDFDocument({ data }: { data: OptimizedResume }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Sidebar */}
        <View style={styles.sidebar}>
          <Text style={styles.name}>{data.candidateName}</Text>
          <View style={styles.divider} />

          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarLabel}>Contact</Text>
            <Text style={styles.sidebarText}>email@example.com</Text>
            <Text style={styles.sidebarText}>+1 (555) 000-0000</Text>
            <Text style={styles.sidebarText}>linkedin.com/in/profile</Text>
          </View>

          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarLabel}>Skills</Text>
            {data.skills.slice(0, 12).map((skill, i) => (
              <Text key={i} style={styles.sidebarText}>• {skill}</Text>
            ))}
          </View>

          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarLabel}>Education</Text>
            <Text style={styles.sidebarText}>Bachelor of Science</Text>
            <Text style={styles.sidebarText}>Computer Science</Text>
            <Text style={styles.sidebarText}>University, 2020</Text>
          </View>
        </View>

        {/* Main content */}
        <View style={styles.main}>
          <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Professional Summary</Text>
          <Text style={styles.summaryText}>{data.summary}</Text>

          <Text style={styles.sectionTitle}>Experience</Text>
          {data.experienceBullets.map((bullet, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{bullet}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Core Skills</Text>
          {data.skills.slice(0, 8).map((skill, i) => (
            <Text key={i} style={styles.skillTag}>• {skill}</Text>
          ))}
        </View>
      </Page>
    </Document>
  );
}

function ResumePDFDownloadLink({ data }: { data: OptimizedResume }) {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = data.candidateName.replace(/\s+/g, "_");
  const filename = `ResumeIQ_Resume_${safeName}_${date}.pdf`;
  return (
    <PDFDownloadLink document={<ResumePDFDocument data={data} />} fileName={filename}>
      Download Optimized Resume (PDF)
    </PDFDownloadLink>
  );
}

export { ResumePDFDocument, ResumePDFDownloadLink };
