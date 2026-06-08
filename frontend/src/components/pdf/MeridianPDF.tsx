import {
  Document, Page, Text, View, StyleSheet,
  PDFDownloadLink, PDFViewer,
} from "@react-pdf/renderer";

// ─── Data type ────────────────────────────────────────────────────────────────

export interface SkillCategory {
  label: string;
  skills: string[];
}

export interface MeridianData {
  name: string;
  jobTitle: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  summary: string;
  experience: Array<{
    company: string;
    role: string;
    startDate: string;
    endDate: string;
    bullets: [string, string, string];
  }>;
  skillCategories: SkillCategory[];
  education: Array<{ institution: string; degree: string; year: string }>;
  certifications: string[];
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  indigo:    "#4338CA",
  indigoMid: "#6366F1",
  indigoFg:  "#A5B4FC",
  indigoPale:"#EEF2FF",
  slate900:  "#0F172A",
  slate700:  "#334155",
  slate500:  "#64748B",
  slate300:  "#CBD5E1",
  white:     "#FFFFFF",
};

const s = StyleSheet.create({
  page:         { backgroundColor: C.white, fontFamily: "Helvetica" },
  // ─ Page 1 header
  header:       { backgroundColor: C.indigo, paddingHorizontal: 40, paddingTop: 30, paddingBottom: 22 },
  hName:        { fontSize: 28, fontFamily: "Helvetica-Bold", color: C.white, letterSpacing: 0.4, marginBottom: 5 },
  hTitle:       { fontSize: 11.5, color: C.indigoFg, marginBottom: 12, letterSpacing: 0.2 },
  hContact:     { fontSize: 8.5, color: "#C7D2FE", lineHeight: 1.5 },
  // ─ Page 2 slim bar
  p2Bar:        { backgroundColor: C.indigo, paddingHorizontal: 40, paddingVertical: 9 },
  p2BarName:    { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: C.white },
  p2BarSub:     { fontSize: 8, color: C.indigoFg },
  // ─ Body
  body:         { paddingHorizontal: 40, paddingTop: 22, paddingBottom: 24 },
  // ─ Section wrapper
  sec:          { marginBottom: 16 },
  secRow:       { flexDirection: "row", alignItems: "center", marginBottom: 9, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.slate300 },
  secTitle:     { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.indigo, textTransform: "uppercase", letterSpacing: 1.8 },
  // ─ Summary
  summAccent:   { borderLeftWidth: 2.5, borderLeftColor: C.indigo, paddingLeft: 11 },
  summText:     { fontSize: 9.5, color: C.slate700, lineHeight: 1.65 },
  // ─ Experience entry
  expEntry:     { marginBottom: 13 },
  expRole:      { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: C.slate900, marginBottom: 2 },
  expMeta:      { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  expCompany:   { fontSize: 9, color: C.slate500 },
  expDates:     { fontSize: 9, color: C.slate500 },
  bulletRow:    { flexDirection: "row", alignItems: "flex-start", marginBottom: 4 },
  bulletDot:    { width: 4.5, height: 4.5, borderRadius: 2.5, backgroundColor: C.indigo, marginTop: 4.5, marginRight: 8, flexShrink: 0 },
  bulletText:   { flex: 1, fontSize: 9.5, color: C.slate700, lineHeight: 1.6 },
  // ─ Skills 2×2 grid
  skillGrid:    { flexDirection: "row", flexWrap: "wrap" },
  skillGroup:   { width: "50%", paddingRight: 12, marginBottom: 10 },
  skillCatTitle:{ fontSize: 8, fontFamily: "Helvetica-Bold", color: C.indigo, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 },
  skillPills:   { flexDirection: "row", flexWrap: "wrap" },
  skillPill:    { fontSize: 8, color: C.indigo, backgroundColor: C.indigoPale, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, marginRight: 5, marginBottom: 5 },
  // ─ Education
  eduEntry:     { marginBottom: 8 },
  eduDeg:       { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.slate900 },
  eduSub:       { fontSize: 8.5, color: C.slate500 },
  // ─ Certifications
  certRow:      { flexDirection: "row", alignItems: "flex-start", marginBottom: 5 },
  certCheck:    { fontSize: 9, color: C.indigo, marginRight: 7, fontFamily: "Helvetica-Bold" },
  certText:     { fontSize: 9, color: C.slate700, flex: 1 },
  // ─ Footer
  footer:       { borderTopWidth: 1, borderTopColor: C.slate300, paddingTop: 8, marginTop: 10, alignItems: "center" },
  footerText:   { fontSize: 7.5, color: C.slate500, letterSpacing: 0.3 },
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ title }: { title: string }) {
  return (
    <View style={s.secRow}>
      <Text style={s.secTitle}>{title}</Text>
    </View>
  );
}

function ExpBlock({ exp }: { exp: MeridianData["experience"][0] }) {
  const bullets = exp.bullets.filter(Boolean);
  if (!exp.company && !exp.role && bullets.length === 0) return null;
  const dates = [exp.startDate, exp.endDate].filter(Boolean).join(" – ");
  return (
    <View style={s.expEntry} wrap={false}>
      <Text style={s.expRole}>{exp.role || "Role"}</Text>
      <View style={s.expMeta}>
        <Text style={s.expCompany}>{exp.company}</Text>
        {dates ? <Text style={s.expDates}>{dates}</Text> : null}
      </View>
      {bullets.map((b, i) => (
        <View key={i} style={s.bulletRow}>
          <View style={s.bulletDot} />
          <Text style={s.bulletText}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

function SkillsGrid({ categories }: { categories: SkillCategory[] }) {
  const filled = categories.filter(c => c.skills.length > 0);
  if (filled.length === 0) return null;
  return (
    <View style={s.skillGrid}>
      {filled.map((cat, i) => (
        <View key={i} style={s.skillGroup}>
          <Text style={s.skillCatTitle}>{cat.label}</Text>
          <View style={s.skillPills}>
            {cat.skills.map((sk, j) => (
              <Text key={j} style={s.skillPill}>{sk}</Text>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Document ─────────────────────────────────────────────────────────────────

export function MeridianResumeDocument({ data }: { data: MeridianData }) {
  const contact = [data.email, data.phone, data.location, data.linkedin, data.website]
    .filter(Boolean)
    .join("   •   ");

  const validExp = data.experience.filter(e => e.company || e.role || e.bullets.some(Boolean));
  const page1Exp = validExp.slice(0, 3);
  const page2Exp = validExp.slice(3);
  const hasPage2Exp = page2Exp.length > 0;
  const hasSkills = data.skillCategories.some(c => c.skills.length > 0);
  const hasEdu = data.education.some(e => e.institution || e.degree);
  const hasCerts = data.certifications.length > 0;

  return (
    <Document title={`${data.name || "Resume"} — ResumeIQ`} author="ResumeIQ">

      {/* ── PAGE 1 ───────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        {/* Full-bleed indigo header */}
        <View style={s.header}>
          <Text style={s.hName}>{data.name || "Your Name"}</Text>
          {data.jobTitle ? <Text style={s.hTitle}>{data.jobTitle}</Text> : null}
          {contact ? <Text style={s.hContact}>{contact}</Text> : null}
        </View>

        <View style={s.body}>
          {/* Professional Summary */}
          {data.summary ? (
            <View style={s.sec}>
              <SectionHeading title="Professional Summary" />
              <View style={s.summAccent}>
                <Text style={s.summText}>{data.summary}</Text>
              </View>
            </View>
          ) : null}

          {/* Experience — first 3 roles */}
          {page1Exp.length > 0 ? (
            <View style={s.sec}>
              <SectionHeading title="Experience" />
              {page1Exp.map((exp, i) => <ExpBlock key={i} exp={exp} />)}
            </View>
          ) : null}
        </View>
      </Page>

      {/* ── PAGE 2 ───────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        {/* Slim bar with name */}
        <View style={s.p2Bar}>
          <Text style={s.p2BarName}>{data.name || "Your Name"}</Text>
          {data.jobTitle ? <Text style={s.p2BarSub}>{data.jobTitle}</Text> : null}
        </View>

        <View style={s.body}>
          {/* Experience continued */}
          {hasPage2Exp ? (
            <View style={s.sec}>
              <SectionHeading title="Experience (Continued)" />
              {page2Exp.map((exp, i) => <ExpBlock key={i} exp={exp} />)}
            </View>
          ) : null}

          {/* Skills — 2×2 category grid */}
          {hasSkills ? (
            <View style={s.sec}>
              <SectionHeading title="Skills" />
              <SkillsGrid categories={data.skillCategories} />
            </View>
          ) : null}

          {/* Education */}
          {hasEdu ? (
            <View style={s.sec}>
              <SectionHeading title="Education" />
              {data.education.filter(e => e.institution || e.degree).map((edu, i) => (
                <View key={i} style={s.eduEntry} wrap={false}>
                  <Text style={s.eduDeg}>{edu.degree}</Text>
                  <Text style={s.eduSub}>
                    {[edu.institution, edu.year].filter(Boolean).join("  •  ")}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Certifications */}
          {hasCerts ? (
            <View style={s.sec}>
              <SectionHeading title="Certifications" />
              {data.certifications.map((cert, i) => (
                <View key={i} style={s.certRow} wrap={false}>
                  <Text style={s.certCheck}>✓</Text>
                  <Text style={s.certText}>{cert}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Footer */}
          <View style={s.footer}>
            <Text style={s.footerText}>Created with ResumeIQ  •  resumeanalyzer.pro</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ─── Viewer (step 5 inline preview) ──────────────────────────────────────────

export function MeridianViewer({ data }: { data: MeridianData }) {
  return (
    <PDFViewer style={{ width: "100%", height: 680, border: "none", borderRadius: 12 }}>
      <MeridianResumeDocument data={data} />
    </PDFViewer>
  );
}

// ─── Download link ────────────────────────────────────────────────────────────

export function MeridianDownloadLink({
  data, filename,
}: {
  data: MeridianData;
  filename: string;
}) {
  return (
    <PDFDownloadLink document={<MeridianResumeDocument data={data} />} fileName={filename}>
      <span className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:brightness-110 transition cursor-pointer">
        ⬇ Download Resume (PDF)
      </span>
    </PDFDownloadLink>
  );
}
