import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer";
import type { OptimizedResume, ResumeSection, LayoutType } from "../../types";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  indigo:      "#4338CA",
  indigoMid:   "#6366F1",
  indigoLight: "#EEF2FF",
  indigoPale:  "#F5F3FF",
  slate900:    "#0F172A",
  slate800:    "#1E293B",
  slate700:    "#334155",
  slate500:    "#64748B",
  slate300:    "#CBD5E1",
  slate100:    "#F1F5F9",
  white:       "#FFFFFF",
  teal:        "#0D9488",
  amber:       "#D97706",
  charcoal:    "#1C1C2E",
  charcoalMid: "#2D2D44",
};

// ─── Shared section renderer ──────────────────────────────────────────────────

function BulletItem({ text, accentColor }: { text: string; accentColor: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 5, alignItems: "flex-start" }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: accentColor, marginTop: 4, marginRight: 8, flexShrink: 0 }} />
      <Text style={{ flex: 1, fontSize: 9.5, color: T.slate700, lineHeight: 1.55 }}>{text}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE A — "Atlas" Modern Executive (single-column)
// Full-bleed indigo header · accent-bar section titles · clean typography
// ═══════════════════════════════════════════════════════════════════════════════

const atlasStyles = StyleSheet.create({
  page:        { backgroundColor: T.white, fontFamily: "Helvetica" },
  header:      { backgroundColor: T.indigo, paddingHorizontal: 40, paddingTop: 28, paddingBottom: 22 },
  name:        { fontSize: 26, fontFamily: "Helvetica-Bold", color: T.white, letterSpacing: 0.5, marginBottom: 6 },
  tagline:     { fontSize: 10, color: "#A5B4FC", marginBottom: 10 },
  contactRow:  { flexDirection: "row", flexWrap: "wrap", gap: 0 },
  contactItem: { fontSize: 8.5, color: "#C7D2FE", marginRight: 18, marginBottom: 2 },
  body:        { paddingHorizontal: 40, paddingTop: 24, paddingBottom: 32 },
  sectionWrap: { marginBottom: 18 },
  sectionBar:  { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  sectionLine: { flex: 1, height: 1, backgroundColor: T.slate300, marginLeft: 8 },
  sectionTitle:{ fontSize: 9, fontFamily: "Helvetica-Bold", color: T.indigo, textTransform: "uppercase", letterSpacing: 1.5 },
  bodyText:    { fontSize: 9.5, color: T.slate700, lineHeight: 1.6 },
  skillsWrap:  { flexDirection: "row", flexWrap: "wrap" },
  skillPill:   { fontSize: 8.5, color: T.indigo, backgroundColor: T.indigoPale, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginRight: 6, marginBottom: 5 },
  eduEntry:    { marginBottom: 8 },
  eduDegree:   { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: T.slate800 },
  eduSub:      { fontSize: 8.5, color: T.slate500 },
});

function AtlasTemplate({ data }: { data: OptimizedResume }) {
  const header = data.sections.find(s => s.type === "header");
  const contactLines = header ? header.originalContent.split("\n").filter(Boolean) : [];
  const name = contactLines[0] ?? data.candidateName;
  const contacts = contactLines.slice(1);

  return (
    <Document>
      <Page size="A4" style={atlasStyles.page}>
        {/* ── Header ── */}
        <View style={atlasStyles.header}>
          <Text style={atlasStyles.name}>{name}</Text>
          <View style={atlasStyles.contactRow}>
            {contacts.map((c, i) => (
              <Text key={i} style={atlasStyles.contactItem}>{c.trim()}</Text>
            ))}
          </View>
        </View>

        {/* ── Body ── */}
        <View style={atlasStyles.body}>
          {data.sections.filter(s => s.type !== "header").map((section, idx) => (
            <View key={idx} style={atlasStyles.sectionWrap}>
              <View style={atlasStyles.sectionBar}>
                <Text style={atlasStyles.sectionTitle}>{section.originalTitle}</Text>
                <View style={atlasStyles.sectionLine} />
              </View>

              {section.type === "skills" ? (
                <View style={atlasStyles.skillsWrap}>
                  {(section.rewrittenBullets.length ? section.rewrittenBullets
                    : section.rewrittenContent.split(/[•,\n]+/).map(s => s.trim()).filter(Boolean)
                  ).map((skill, i) => (
                    <Text key={i} style={atlasStyles.skillPill}>{skill}</Text>
                  ))}
                </View>
              ) : section.rewrittenBullets.length > 0 ? (
                section.rewrittenBullets.map((b, i) => (
                  <BulletItem key={i} text={b} accentColor={T.indigoMid} />
                ))
              ) : section.type === "education" ? (
                section.originalContent.split("\n").filter(Boolean).map((line, i) => (
                  <Text key={i} style={i % 2 === 0 ? atlasStyles.eduDegree : atlasStyles.eduSub}>{line.trim()}</Text>
                ))
              ) : (
                <Text style={atlasStyles.bodyText}>{section.rewrittenContent}</Text>
              )}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE B — "Meridian" Dark Sidebar Executive (two-column)
// Charcoal sidebar with skill dots · white spacious main · teal accents
// ═══════════════════════════════════════════════════════════════════════════════

const meridianStyles = StyleSheet.create({
  page:         { flexDirection: "row", fontFamily: "Helvetica" },
  sidebar:      { width: "32%", backgroundColor: T.charcoal, paddingHorizontal: 18, paddingTop: 28, paddingBottom: 28 },
  avatarWrap:   { alignItems: "center", marginBottom: 18 },
  avatarCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: T.charcoalMid, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: T.teal },
  avatarText:   { fontSize: 22, fontFamily: "Helvetica-Bold", color: T.teal },
  sName:        { fontSize: 13, fontFamily: "Helvetica-Bold", color: T.white, textAlign: "center", marginTop: 8 },
  sContact:     { fontSize: 8, color: "#94A3B8", textAlign: "center", marginTop: 3, lineHeight: 1.5 },
  sDivider:     { height: 1, backgroundColor: "#3D3D5C", marginVertical: 14 },
  sLabel:       { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: T.teal, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 },
  sSkillRow:    { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  sSkillName:   { fontSize: 8.5, color: "#CBD5E1", flex: 1 },
  sSkillDots:   { flexDirection: "row" },
  sDot:         { width: 6, height: 6, borderRadius: 3, marginLeft: 3 },
  sEduEntry:    { marginBottom: 7 },
  sEduDeg:      { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: T.white },
  sEduSub:      { fontSize: 7.5, color: "#94A3B8" },
  main:         { flex: 1, backgroundColor: T.white, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 28 },
  mSectionWrap: { marginBottom: 16 },
  mSectionTitle:{ fontSize: 10, fontFamily: "Helvetica-Bold", color: T.slate900, textTransform: "uppercase", letterSpacing: 1, borderBottomWidth: 2, borderBottomColor: T.teal, paddingBottom: 4, marginBottom: 8 },
  mBodyText:    { fontSize: 9.5, color: T.slate700, lineHeight: 1.6 },
  mExpEntry:    { marginBottom: 10 },
  mExpTitle:    { fontSize: 10, fontFamily: "Helvetica-Bold", color: T.slate900 },
  mExpSub:      { fontSize: 8.5, color: T.slate500, marginBottom: 4 },
});

function SkillDots({ level = 4, color }: { level?: number; color: string }) {
  return (
    <View style={meridianStyles.sSkillDots}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={[meridianStyles.sDot, { backgroundColor: i <= level ? color : "#3D3D5C" }]} />
      ))}
    </View>
  );
}

function MeridianTemplate({ data }: { data: OptimizedResume }) {
  const header = data.sections.find(s => s.type === "header");
  const contactLines = header ? header.originalContent.split("\n").filter(Boolean) : [];
  const name = contactLines[0] ?? data.candidateName;
  const initials = name.split(/\s+/).map(w => w[0] ?? "").slice(0, 2).join("").toUpperCase();
  const contacts = contactLines.slice(1);

  const skillsSection = data.sections.find(s => s.type === "skills");
  const eduSection = data.sections.find(s => s.type === "education");
  const certSection = data.sections.find(s => s.type === "certifications");

  const mainSections = data.sections.filter(
    s => !["header", "skills", "education", "certifications"].includes(s.type)
  );

  const skills = skillsSection
    ? (skillsSection.rewrittenBullets.length
      ? skillsSection.rewrittenBullets
      : skillsSection.originalContent.split(/[,|•\n]+/).map(s => s.trim()).filter(Boolean))
    : data.skills;

  return (
    <Document>
      <Page size="A4" style={meridianStyles.page}>
        {/* ── Sidebar ── */}
        <View style={meridianStyles.sidebar}>
          <View style={meridianStyles.avatarWrap}>
            <View style={meridianStyles.avatarCircle}>
              <Text style={meridianStyles.avatarText}>{initials}</Text>
            </View>
            <Text style={meridianStyles.sName}>{name}</Text>
            {contacts.map((c, i) => <Text key={i} style={meridianStyles.sContact}>{c.trim()}</Text>)}
          </View>

          <View style={meridianStyles.sDivider} />

          {skills.length > 0 && (
            <View>
              <Text style={meridianStyles.sLabel}>Core Skills</Text>
              {skills.slice(0, 12).map((skill, i) => (
                <View key={i} style={meridianStyles.sSkillRow}>
                  <Text style={meridianStyles.sSkillName}>{skill}</Text>
                  <SkillDots level={5 - (i % 2)} color={T.teal} />
                </View>
              ))}
            </View>
          )}

          {eduSection && (
            <View>
              <View style={meridianStyles.sDivider} />
              <Text style={meridianStyles.sLabel}>Education</Text>
              {eduSection.originalContent.split("\n").filter(Boolean).map((line, i) => (
                <Text key={i} style={i % 2 === 0 ? meridianStyles.sEduDeg : meridianStyles.sEduSub}>
                  {line.trim()}
                </Text>
              ))}
            </View>
          )}

          {certSection && certSection.bullets.length > 0 && (
            <View>
              <View style={meridianStyles.sDivider} />
              <Text style={meridianStyles.sLabel}>Certifications</Text>
              {certSection.bullets.map((c, i) => (
                <Text key={i} style={meridianStyles.sEduSub}>• {c}</Text>
              ))}
            </View>
          )}
        </View>

        {/* ── Main ── */}
        <View style={meridianStyles.main}>
          {mainSections.map((section, idx) => (
            <View key={idx} style={meridianStyles.mSectionWrap}>
              <Text style={meridianStyles.mSectionTitle}>{section.originalTitle}</Text>
              {section.rewrittenBullets.length > 0
                ? section.rewrittenBullets.map((b, i) => (
                  <BulletItem key={i} text={b} accentColor={T.teal} />
                ))
                : <Text style={meridianStyles.mBodyText}>{section.rewrittenContent}</Text>
              }
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE C — "Apex" Centered Executive (executive header style)
// Large centered name · amber accent · two-column body grid
// ═══════════════════════════════════════════════════════════════════════════════

const apexStyles = StyleSheet.create({
  page:          { backgroundColor: T.white, fontFamily: "Helvetica" },
  topStripe:     { height: 6, backgroundColor: T.amber },
  header:        { paddingHorizontal: 44, paddingTop: 22, paddingBottom: 18, alignItems: "center" },
  name:          { fontSize: 28, fontFamily: "Helvetica-Bold", color: T.slate900, textAlign: "center", letterSpacing: 1.5 },
  nameUnderline: { width: 60, height: 3, backgroundColor: T.amber, marginTop: 6, marginBottom: 10 },
  contactRow:    { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  contactItem:   { fontSize: 8.5, color: T.slate500, marginHorizontal: 10 },
  divider:       { height: 1, backgroundColor: T.slate300, marginHorizontal: 44, marginBottom: 0 },
  body:          { paddingHorizontal: 44, paddingTop: 20, paddingBottom: 32 },
  twoCol:        { flexDirection: "row" },
  colLeft:       { flex: 6, paddingRight: 20 },
  colRight:      { flex: 4, paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: T.slate100 },
  sectionWrap:   { marginBottom: 18 },
  sectionTitle:  { fontSize: 9, fontFamily: "Helvetica-Bold", color: T.amber, textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 7 },
  bodyText:      { fontSize: 9.5, color: T.slate700, lineHeight: 1.6 },
  skillItem:     { fontSize: 9, color: T.slate700, marginBottom: 4, paddingLeft: 6, borderLeftWidth: 2, borderLeftColor: T.amber },
  eduDegree:     { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: T.slate800 },
  eduSub:        { fontSize: 8.5, color: T.slate500 },
});

function ApexSection({ section }: { section: ResumeSection }) {
  return (
    <View style={apexStyles.sectionWrap}>
      <Text style={apexStyles.sectionTitle}>{section.originalTitle}</Text>
      {section.type === "skills"
        ? (section.rewrittenBullets.length ? section.rewrittenBullets
            : section.rewrittenContent.split(/[•,\n]+/).map(s => s.trim()).filter(Boolean)
          ).map((s, i) => <Text key={i} style={apexStyles.skillItem}>{s}</Text>)
        : section.type === "education"
          ? section.originalContent.split("\n").filter(Boolean).map((l, i) => (
              <Text key={i} style={i % 2 === 0 ? apexStyles.eduDegree : apexStyles.eduSub}>{l.trim()}</Text>
            ))
          : section.rewrittenBullets.length > 0
            ? section.rewrittenBullets.map((b, i) => <BulletItem key={i} text={b} accentColor={T.amber} />)
            : <Text style={apexStyles.bodyText}>{section.rewrittenContent}</Text>
      }
    </View>
  );
}

function ApexTemplate({ data }: { data: OptimizedResume }) {
  const header = data.sections.find(s => s.type === "header");
  const contactLines = header ? header.originalContent.split("\n").filter(Boolean) : [];
  const name = contactLines[0] ?? data.candidateName;
  const contacts = contactLines.slice(1);

  const bodySections = data.sections.filter(s => s.type !== "header");

  // Primary sections left (summary, experience, projects), secondary right (skills, education, certs)
  const leftTypes: (typeof bodySections[0]["type"])[] = ["summary", "experience", "projects", "other"];
  const leftSections = bodySections.filter(s => leftTypes.includes(s.type));
  const rightSections = bodySections.filter(s => !leftTypes.includes(s.type));

  return (
    <Document>
      <Page size="A4" style={apexStyles.page}>
        <View style={apexStyles.topStripe} />
        <View style={apexStyles.header}>
          <Text style={apexStyles.name}>{name}</Text>
          <View style={apexStyles.nameUnderline} />
          <View style={apexStyles.contactRow}>
            {contacts.map((c, i) => (
              <Text key={i} style={apexStyles.contactItem}>{c.trim()}</Text>
            ))}
          </View>
        </View>
        <View style={apexStyles.divider} />

        <View style={apexStyles.body}>
          <View style={apexStyles.twoCol}>
            <View style={apexStyles.colLeft}>
              {leftSections.map((s, i) => <ApexSection key={i} section={s} />)}
            </View>
            {rightSections.length > 0 && (
              <View style={apexStyles.colRight}>
                {rightSections.map((s, i) => <ApexSection key={i} section={s} />)}
              </View>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ─── Auto template selector ───────────────────────────────────────────────────

function ResumePDFDocument({ data }: { data: OptimizedResume }) {
  const layout: LayoutType = data.layout?.type ?? "single-column";
  if (layout === "two-column") return <MeridianTemplate data={data} />;
  if (layout === "executive")  return <ApexTemplate data={data} />;
  return <AtlasTemplate data={data} />;
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
