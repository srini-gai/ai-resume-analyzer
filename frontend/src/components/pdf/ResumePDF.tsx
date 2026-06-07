import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer";
import type { OptimizedResume, ResumeSection, LayoutType } from "../../types";

// ─── Shared tokens ────────────────────────────────────────────────────────────
const C = {
  indigo: "#4F46E5",
  indigoLight: "#EEF2FF",
  indigoDark: "#3730A3",
  slate900: "#0F172A",
  slate700: "#334155",
  slate500: "#64748B",
  slate200: "#E2E8F0",
  slate50: "#F8FAFC",
  white: "#FFFFFF",
  green: "#16A34A",
};

// ─── Section renderer (shared across templates) ───────────────────────────────

const sharedStyles = StyleSheet.create({
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.indigo,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginTop: 14,
    marginBottom: 5,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: C.slate200,
  },
  bulletRow: { flexDirection: "row", marginBottom: 4, alignItems: "flex-start" },
  bulletDot: { width: 10, fontSize: 12, color: C.indigo, marginTop: -1, lineHeight: 1.2 },
  bulletText: { flex: 1, fontSize: 9.5, color: C.slate700, lineHeight: 1.5 },
  bodyText: { fontSize: 9.5, color: C.slate700, lineHeight: 1.6 },
  skillPill: { fontSize: 8.5, color: C.indigo, marginRight: 8, marginBottom: 3 },
});

function SectionBlock({ section }: { section: ResumeSection }) {
  if (section.type === "header") return null;

  const hasBullets = section.rewrittenBullets.length > 0;
  const content = hasBullets ? null : section.rewrittenContent;

  return (
    <View>
      <Text style={sharedStyles.sectionTitle}>{section.originalTitle}</Text>
      {hasBullets
        ? section.rewrittenBullets.map((b, i) => (
          <View key={i} style={sharedStyles.bulletRow}>
            <Text style={sharedStyles.bulletDot}>•</Text>
            <Text style={sharedStyles.bulletText}>{b}</Text>
          </View>
        ))
        : <Text style={sharedStyles.bodyText}>{content}</Text>
      }
    </View>
  );
}

// ─── Template A: Single Column Clean ─────────────────────────────────────────

const singleStyles = StyleSheet.create({
  page: { backgroundColor: C.white, padding: 36, fontFamily: "Helvetica" },
  nameBar: { marginBottom: 12 },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold", color: C.slate900 },
  contactLine: { fontSize: 9, color: C.slate500, marginTop: 3 },
  divider: { height: 2, backgroundColor: C.indigo, marginBottom: 4 },
});

function SingleColumnTemplate({ data }: { data: OptimizedResume }) {
  const headerSection = data.sections.find(s => s.type === "header");
  const contactLine = headerSection
    ? headerSection.originalContent.split("\n").slice(1).join("  •  ").trim()
    : "";

  return (
    <Document>
      <Page size="A4" style={singleStyles.page}>
        <View style={singleStyles.nameBar}>
          <Text style={singleStyles.name}>{data.candidateName}</Text>
          {!!contactLine && <Text style={singleStyles.contactLine}>{contactLine}</Text>}
        </View>
        <View style={singleStyles.divider} />
        {data.sections
          .filter(s => s.type !== "header")
          .map((s, i) => <SectionBlock key={i} section={s} />)}
      </Page>
    </Document>
  );
}

// ─── Template B: Two Column Sidebar ──────────────────────────────────────────

const twoColStyles = StyleSheet.create({
  page: { flexDirection: "row", fontFamily: "Helvetica" },
  sidebar: { width: "31%", backgroundColor: C.indigoDark, padding: 18, minHeight: "100%" },
  main: { width: "69%", padding: 24, backgroundColor: C.white },
  sidebarName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.white, marginBottom: 3 },
  sidebarContact: { fontSize: 8, color: "#C7D2FE", marginBottom: 2 },
  sidebarDivider: { height: 1, backgroundColor: "#6366F1", marginVertical: 10 },
  sidebarLabel: {
    fontSize: 8, fontFamily: "Helvetica-Bold", color: "#A5B4FC",
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, marginTop: 10,
  },
  sidebarItem: { fontSize: 8.5, color: "#E0E7FF", marginBottom: 2 },
});

function TwoColumnTemplate({ data }: { data: OptimizedResume }) {
  const headerSection = data.sections.find(s => s.type === "header");
  const contactLines = headerSection
    ? headerSection.originalContent.split("\n").slice(1).filter(Boolean)
    : [];
  const skillsSection = data.sections.find(s => s.type === "skills");
  const educationSection = data.sections.find(s => s.type === "education");
  const certSection = data.sections.find(s => s.type === "certifications");

  const mainSections = data.sections.filter(
    s => !["header", "skills", "education", "certifications"].includes(s.type)
  );

  return (
    <Document>
      <Page size="A4" style={twoColStyles.page}>
        {/* Sidebar */}
        <View style={twoColStyles.sidebar}>
          <Text style={twoColStyles.sidebarName}>{data.candidateName}</Text>
          {contactLines.map((l, i) => <Text key={i} style={twoColStyles.sidebarContact}>{l.trim()}</Text>)}
          <View style={twoColStyles.sidebarDivider} />

          {skillsSection && (
            <View>
              <Text style={twoColStyles.sidebarLabel}>{skillsSection.originalTitle}</Text>
              {(skillsSection.rewrittenBullets.length
                ? skillsSection.rewrittenBullets
                : skillsSection.rewrittenContent.split(/[•,\n]+/).map(s => s.trim()).filter(Boolean)
              ).slice(0, 14).map((s, i) => (
                <Text key={i} style={twoColStyles.sidebarItem}>• {s}</Text>
              ))}
            </View>
          )}

          {educationSection && (
            <View>
              <Text style={twoColStyles.sidebarLabel}>{educationSection.originalTitle}</Text>
              <Text style={twoColStyles.sidebarItem}>{educationSection.originalContent}</Text>
            </View>
          )}

          {certSection && (
            <View>
              <Text style={twoColStyles.sidebarLabel}>{certSection.originalTitle}</Text>
              {(certSection.bullets.length
                ? certSection.bullets
                : certSection.originalContent.split("\n").filter(Boolean)
              ).map((c, i) => (
                <Text key={i} style={twoColStyles.sidebarItem}>• {c.trim()}</Text>
              ))}
            </View>
          )}
        </View>

        {/* Main */}
        <View style={twoColStyles.main}>
          {mainSections.map((s, i) => <SectionBlock key={i} section={s} />)}
        </View>
      </Page>
    </Document>
  );
}

// ─── Template C: Executive Header ────────────────────────────────────────────

const execStyles = StyleSheet.create({
  page: { backgroundColor: C.white, fontFamily: "Helvetica" },
  header: {
    backgroundColor: C.indigo,
    paddingHorizontal: 36,
    paddingVertical: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  name: { fontSize: 24, fontFamily: "Helvetica-Bold", color: C.white },
  contactBlock: { alignItems: "flex-end" },
  contactLine: { fontSize: 8.5, color: "#C7D2FE", marginBottom: 2 },
  body: { paddingHorizontal: 36, paddingVertical: 20 },
  twoCol: { flexDirection: "row", gap: 20 },
  colLeft: { flex: 1 },
  colRight: { flex: 1 },
});

function ExecutiveTemplate({ data }: { data: OptimizedResume }) {
  const headerSection = data.sections.find(s => s.type === "header");
  const contactLines = headerSection
    ? headerSection.originalContent.split("\n").slice(1).filter(Boolean)
    : [];

  // Split sections into two columns
  const bodySections = data.sections.filter(s => s.type !== "header");
  const midpoint = Math.ceil(bodySections.length / 2);
  const leftSections = bodySections.slice(0, midpoint);
  const rightSections = bodySections.slice(midpoint);

  return (
    <Document>
      <Page size="A4" style={execStyles.page}>
        {/* Header bar */}
        <View style={execStyles.header}>
          <Text style={execStyles.name}>{data.candidateName}</Text>
          <View style={execStyles.contactBlock}>
            {contactLines.map((l, i) => (
              <Text key={i} style={execStyles.contactLine}>{l.trim()}</Text>
            ))}
          </View>
        </View>

        {/* Body — two columns */}
        <View style={execStyles.body}>
          <View style={execStyles.twoCol}>
            <View style={execStyles.colLeft}>
              {leftSections.map((s, i) => <SectionBlock key={i} section={s} />)}
            </View>
            <View style={execStyles.colRight}>
              {rightSections.map((s, i) => <SectionBlock key={i} section={s} />)}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ─── Auto-selector ────────────────────────────────────────────────────────────

function ResumePDFDocument({ data }: { data: OptimizedResume }) {
  const layout: LayoutType = data.layout?.type ?? "single-column";
  if (layout === "two-column") return <TwoColumnTemplate data={data} />;
  if (layout === "executive") return <ExecutiveTemplate data={data} />;
  return <SingleColumnTemplate data={data} />;
}

// ─── Download link ────────────────────────────────────────────────────────────

function ResumePDFDownloadLink({ data }: { data: OptimizedResume }) {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = data.candidateName.replace(/\s+/g, "_");
  const filename = `ResumeIQ_Optimized_${safeName}_${date}.pdf`;
  return (
    <PDFDownloadLink document={<ResumePDFDocument data={data} />} fileName={filename}>
      <span className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110">
        ↓ Download Optimized Resume PDF
      </span>
    </PDFDownloadLink>
  );
}

export { ResumePDFDocument, ResumePDFDownloadLink };
