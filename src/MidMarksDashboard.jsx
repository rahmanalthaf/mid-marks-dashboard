import { useState, useEffect, useMemo, useRef } from "react";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";

const TOTAL_STUDENTS = 72;
const DEFAULT_SUBJECTS = [
  "Subject 1",
  "Subject 2",
  "Subject 3",
  "Subject 4",
  "Subject 5",
  "Subject 6",
];

const INK = "#1B2A4A";
const PAPER = "#FAF9F5";
const LINE = "#DAD6C9";
const PASS = "#3B6D11";
const WARN = "#854F0B";
const FAIL = "#A32D2D";
const MUTED = "#6B6A63";
const CARD_BG = "#F3F1EA";

const STORAGE_KEY = "mentee-marks-dataset";

function blankStudents() {
  return Array.from({ length: TOTAL_STUDENTS }, (_, i) => ({
    id: i + 1,
    name: `Student ${i + 1}`,
    mentee: false,
    marks: [null, null, null, null, null, null],
  }));
}

function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Competition ranking (1,2,2,4...) over a subset of students, by a value getter.
// Returns a Map(studentId -> rank) covering only students with a non-null value.
function rankBy(students, getValue) {
  const entries = students
    .map((s) => ({ id: s.id, v: getValue(s) }))
    .filter((e) => e.v !== null);
  entries.sort((a, b) => b.v - a.v);
  const ranks = new Map();
  let rank = 0;
  let prevValue = null;
  let seen = 0;
  entries.forEach((e) => {
    seen++;
    if (e.v !== prevValue) {
      rank = seen;
      prevValue = e.v;
    }
    ranks.set(e.id, rank);
  });
  return ranks;
}

function tierColor(rank, outOf) {
  if (rank === null || rank === undefined || !outOf) return MUTED;
  const pct = rank / outOf;
  if (pct <= 1 / 3) return PASS;
  if (pct <= 2 / 3) return WARN;
  return FAIL;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function MidMarksDashboard() {
  const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS);
  const [students, setStudents] = useState(blankStudents());
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("all"); // "all" | "mentees"
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("overallRank");
  const [sortDir, setSortDir] = useState("asc");
  const [selectedId, setSelectedId] = useState(null);
  const fileInputRef = useRef(null);
  const [importMsg, setImportMsg] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.subjects && parsed.students) {
          setSubjects(parsed.subjects);
          setStudents(parsed.students);
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ subjects, students })
        );
      } catch (e) {
        // ignore
      }
    }, 400);
    return () => clearTimeout(t);
  }, [subjects, students, loaded]);

  // ---- Ranking calculations ----
  const subjectRanksClass = useMemo(
    () => subjects.map((_, idx) => rankBy(students, (s) => toNum(s.marks[idx]))),
    [students, subjects]
  );

  const mentees = useMemo(() => students.filter((s) => s.mentee), [students]);

  const totalOf = (s) => s.marks.reduce((acc, m) => acc + (toNum(m) || 0), 0);
  const enteredCountOf = (s) => s.marks.filter((m) => toNum(m) !== null).length;

  const overallRankClass = useMemo(
    () => rankBy(students, (s) => (enteredCountOf(s) > 0 ? totalOf(s) : null)),
    [students]
  );
  const overallRankMentee = useMemo(
    () => rankBy(mentees, (s) => (enteredCountOf(s) > 0 ? totalOf(s) : null)),
    [mentees]
  );

  const classAvgPct = useMemo(() => {
    const withMarks = students.filter((s) => enteredCountOf(s) > 0);
    if (!withMarks.length) return null;
    const totalMax = subjects.length * 50;
    const avgTotal =
      withMarks.reduce((a, s) => a + totalOf(s), 0) / withMarks.length;
    return (avgTotal / totalMax) * 100;
  }, [students, subjects]);

  const menteeAvgPct = useMemo(() => {
    const withMarks = mentees.filter((s) => enteredCountOf(s) > 0);
    if (!withMarks.length) return null;
    const totalMax = subjects.length * 50;
    const avgTotal =
      withMarks.reduce((a, s) => a + totalOf(s), 0) / withMarks.length;
    return (avgTotal / totalMax) * 100;
  }, [mentees, subjects]);

  const subjectClassAverages = useMemo(
    () =>
      subjects.map((name, idx) => {
        const vals = students
          .map((s) => toNum(s.marks[idx]))
          .filter((v) => v !== null);
        const avg = vals.length
          ? vals.reduce((a, b) => a + b, 0) / vals.length
          : null;
        return { name, avgPct: avg === null ? null : (avg / 50) * 100 };
      }),
    [students, subjects]
  );

  const topScorer = useMemo(() => {
    let best = null;
    students.forEach((s) => {
      if (enteredCountOf(s) === 0) return;
      const t = totalOf(s);
      if (!best || t > best.total) best = { name: s.name, total: t };
    });
    return best;
  }, [students]);

  const menteesNeedingAttention = useMemo(
    () =>
      mentees.filter((s) => {
        if (enteredCountOf(s) === 0) return false;
        const rank = overallRankClass.get(s.id);
        return rank && rank > (2 / 3) * TOTAL_STUDENTS;
      }).length,
    [mentees, overallRankClass]
  );

  // ---- Table rows for current tab ----
  const baseList = tab === "all" ? students : mentees;
  const filtered = baseList.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const decorated = filtered.map((s) => ({
    student: s,
    total: totalOf(s),
    entered: enteredCountOf(s),
    classRank: overallRankClass.get(s.id) ?? null,
    menteeRank: overallRankMentee.get(s.id) ?? null,
  }));

  decorated.sort((a, b) => {
    let av, bv;
    if (sortKey === "name") {
      av = a.student.name.toLowerCase();
      bv = b.student.name.toLowerCase();
    } else if (sortKey === "total") {
      av = a.total;
      bv = b.total;
    } else if (sortKey === "overallRank") {
      av = a.classRank ?? Infinity;
      bv = b.classRank ?? Infinity;
    } else if (sortKey.startsWith("sub")) {
      const idx = Number(sortKey.slice(3));
      av = toNum(a.student.marks[idx]) ?? -1;
      bv = toNum(b.student.marks[idx]) ?? -1;
    } else {
      av = 0;
      bv = 0;
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function updateStudent(id, field, value) {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }

  function updateMark(id, subjectIdx, value) {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const marks = [...s.marks];
        marks[subjectIdx] = value === "" ? null : value;
        return { ...s, marks };
      })
    );
  }

  function addStudent() {
    setStudents((prev) => {
      const nextId = prev.length ? Math.max(...prev.map((s) => s.id)) + 1 : 1;
      return [
        ...prev,
        {
          id: nextId,
          name: `Student ${nextId}`,
          mentee: false,
          marks: [null, null, null, null, null, null],
        },
      ];
    });
  }

  function removeStudent(id) {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      complete: (results) => {
        const rows = results.data.filter(
          (r) => r.length > 1 && r.some((c) => String(c).trim() !== "")
        );
        if (!rows.length) {
          setImportMsg("No rows found in that file.");
          return;
        }
        const dataRows = rows.slice(1); // first row is treated as header
        const parsed = dataRows.map((row, i) => {
          const name = String(row[0] ?? `Student ${i + 1}`).trim();
          const menteeRaw = String(row[1] ?? "").trim().toLowerCase();
          const mentee = ["y", "yes", "true", "1"].includes(menteeRaw);
          const marks = [0, 1, 2, 3, 4, 5].map((k) => toNum(row[2 + k]));
          return { id: i + 1, name, mentee, marks };
        });
        if (
          window.confirm(
            `Import ${parsed.length} students from this file? This replaces the current dataset.`
          )
        ) {
          setStudents(parsed);
          setImportMsg(`Imported ${parsed.length} students.`);
        }
      },
      error: () => setImportMsg("Could not read that file."),
    });
    e.target.value = "";
  }

  function downloadTemplate() {
    const header = ["Name", "Mentee", ...subjects];
    const rows = Array.from({ length: TOTAL_STUDENTS }, (_, i) => [
      `Student ${i + 1}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    const csv = Papa.unparse([header, ...rows]);
    downloadText("marks-template.csv", csv);
  }

  const selected = students.find((s) => s.id === selectedId) || null;
  const chartHeight = 40 + Math.max(mentees.length, 1) * 28;

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        background: PAPER,
        minHeight: "100vh",
        padding: "28px 20px 64px",
        color: INK,
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <header style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>
            Mid-term evaluation · batch of {TOTAL_STUDENTS}
          </div>
          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 28,
              fontWeight: 400,
              margin: 0,
              lineHeight: 1.25,
            }}
          >
            Mentee performance dashboard
          </h1>
          <p style={{ fontSize: 14, color: MUTED, marginTop: 8, maxWidth: 560 }}>
            Track marks for all {TOTAL_STUDENTS} students across{" "}
            {subjects.length} subjects, and see where your mentees rank in
            each subject against the full batch.
          </p>
        </header>

        <section style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            style={{ display: "none" }}
          />
          <ToolButton onClick={handleUploadClick} label="Upload CSV" />
          <ToolButton onClick={downloadTemplate} label="Download template" />
          <ToolButton onClick={addStudent} label="Add student" />
          {importMsg && (
            <span style={{ fontSize: 12, color: MUTED, alignSelf: "center" }}>
              {importMsg}
            </span>
          )}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: 8,
            marginBottom: 22,
          }}
        >
          {subjects.map((name, idx) => (
            <input
              key={idx}
              value={name}
              onChange={(e) =>
                setSubjects((prev) => prev.map((s, i) => (i === idx ? e.target.value : s)))
              }
              style={{
                border: `1px solid ${LINE}`,
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 13,
                background: "#fff",
              }}
            />
          ))}
        </section>

        <section
          style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: `1px solid ${LINE}` }}
        >
          <TabButton active={tab === "all"} onClick={() => setTab("all")} label={`All students (${students.length})`} />
          <TabButton active={tab === "mentees"} onClick={() => setTab("mentees")} label={`My mentees (${mentees.length})`} />
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {tab === "all" ? (
            <>
              <MetricCard label="Students" value={students.length} />
              <MetricCard label="Class average" value={classAvgPct === null ? "—" : `${classAvgPct.toFixed(1)}%`} />
              <MetricCard label="Top scorer" value={topScorer ? topScorer.name : "—"} />
              <MetricCard label="Mentees in batch" value={`${mentees.length}/${students.length}`} />
            </>
          ) : (
            <>
              <MetricCard label="Mentees" value={mentees.length} />
              <MetricCard
                label="Mentee average"
                value={menteeAvgPct === null ? "—" : `${menteeAvgPct.toFixed(1)}%`}
                color={menteeAvgPct !== null && classAvgPct !== null ? (menteeAvgPct >= classAvgPct ? PASS : FAIL) : INK}
              />
              <MetricCard
                label="vs class average"
                value={
                  menteeAvgPct !== null && classAvgPct !== null
                    ? `${menteeAvgPct - classAvgPct >= 0 ? "+" : ""}${(menteeAvgPct - classAvgPct).toFixed(1)} pts`
                    : "—"
                }
                color={menteeAvgPct !== null && classAvgPct !== null ? (menteeAvgPct >= classAvgPct ? PASS : FAIL) : INK}
              />
              <MetricCard label="Need attention" value={menteesNeedingAttention} color={menteesNeedingAttention > 0 ? FAIL : PASS} />
            </>
          )}
        </section>

        <section style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>
            {tab === "all" ? "Class average percentage by subject" : "Mentees ranked by total marks — click a bar to open that student"}
          </div>
          {tab === "all" ? (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart
                  data={subjectClassAverages.map((s) => ({
                    name: s.name,
                    avg: s.avgPct === null ? 0 : Math.round(s.avgPct * 10) / 10,
                  }))}
                  margin={{ top: 8, right: 8, left: -20, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: MUTED }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: MUTED }} width={34} />
                  <Tooltip formatter={(v) => [`${v}%`, "Class average"]} contentStyle={{ fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}` }} />
                  <ReferenceLine y={40} stroke={FAIL} strokeDasharray="4 4" />
                  <Bar dataKey="avg" radius={[4, 4, 0, 0]} maxBarSize={40} fill={INK} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ width: "100%", height: chartHeight }}>
              <ResponsiveContainer>
                <BarChart
                  layout="vertical"
                  data={mentees
                    .map((s) => ({ id: s.id, name: s.name, total: totalOf(s), rank: overallRankClass.get(s.id) ?? null }))
                    .sort((a, b) => b.total - a.total)}
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={LINE} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: MUTED }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: MUTED }} width={110} />
                  <Tooltip
                    formatter={(v, n, p) => [`${v} marks — class rank ${p.payload.rank ?? "—"}/${students.length}`, "Total"]}
                    contentStyle={{ fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}` }}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={18} onClick={(d) => setSelectedId(d.id)} style={{ cursor: "pointer" }}>
                    {mentees.map((s, i) => (
                      <Cell key={i} fill={tierColor(overallRankClass.get(s.id), students.length)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <div style={{ marginBottom: 10 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "7px 10px", fontSize: 13, width: 220 }}
          />
        </div>

        <div style={{ overflowX: "auto", marginBottom: 24 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760 }}>
            <thead>
              <tr style={{ background: CARD_BG }}>
                <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>Name</Th>
                <th style={thStyle}>Mentee</th>
                {subjects.map((name, idx) => (
                  <Th key={idx} onClick={() => toggleSort(`sub${idx}`)} active={sortKey === `sub${idx}`} dir={sortDir}>{name}</Th>
                ))}
                <Th onClick={() => toggleSort("total")} active={sortKey === "total"} dir={sortDir}>Total</Th>
                <Th onClick={() => toggleSort("overallRank")} active={sortKey === "overallRank"} dir={sortDir}>Class rank</Th>
                {tab === "mentees" && <th style={thStyle}>Mentee rank</th>}
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {decorated.map(({ student: s, total, classRank, menteeRank }) => (
                <tr
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  style={{ borderBottom: `1px solid ${LINE}`, background: selectedId === s.id ? "#fff" : "transparent", cursor: "pointer" }}
                >
                  <td style={tdStyle}>
                    <input
                      value={s.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateStudent(s.id, "name", e.target.value)}
                      style={nameInputStyle}
                    />
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={s.mentee}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateStudent(s.id, "mentee", e.target.checked)}
                    />
                  </td>
                  {subjects.map((_, idx) => {
                    const rank = subjectRanksClass[idx].get(s.id);
                    return (
                      <td key={idx} style={tdStyle}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <input
                            type="number"
                            value={s.marks[idx] === null ? "" : s.marks[idx]}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateMark(s.id, idx, e.target.value)}
                            style={markInputStyle}
                          />
                          <span style={{ fontSize: 10, color: tierColor(rank, students.length) }}>
                            {rank ? `#${rank}/${students.length}` : "—"}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{total}</td>
                  <td style={tdStyle}>
                    <span style={{ color: tierColor(classRank, students.length), fontWeight: 500 }}>
                      {classRank ? `${classRank}/${students.length}` : "—"}
                    </span>
                  </td>
                  {tab === "mentees" && <td style={tdStyle}>{menteeRank ? `${menteeRank}/${mentees.length}` : "—"}</td>}
                  <td style={tdStyle}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeStudent(s.id);
                      }}
                      style={deleteBtnStyle}
                      aria-label={`Remove ${s.name}`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <section style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: "16px 18px", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <h3 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400, fontSize: 20, margin: 0 }}>
                {selected.name}
                {selected.mentee && <span style={{ fontSize: 12, color: PASS, marginLeft: 8 }}>mentee</span>}
              </h3>
              <button onClick={() => setSelectedId(null)} style={deleteBtnStyle}>×</button>
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: MUTED }}>
                Class rank:{" "}
                <strong style={{ color: tierColor(overallRankClass.get(selected.id), students.length) }}>
                  {overallRankClass.get(selected.id) ?? "—"}/{students.length}
                </strong>
              </div>
              {selected.mentee && (
                <div style={{ fontSize: 13, color: MUTED }}>
                  Mentee rank: <strong style={{ color: INK }}>{overallRankMentee.get(selected.id) ?? "—"}/{mentees.length}</strong>
                </div>
              )}
              <div style={{ fontSize: 13, color: MUTED }}>
                Total: <strong style={{ color: INK }}>{totalOf(selected)}</strong>
              </div>
            </div>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart
                  data={subjects.map((name, idx) => ({
                    name,
                    marks: toNum(selected.marks[idx]) ?? 0,
                    classAvg:
                      subjectClassAverages[idx].avgPct === null
                        ? 0
                        : Math.round((subjectClassAverages[idx].avgPct / 100) * 50 * 10) / 10,
                  }))}
                  margin={{ top: 8, right: 8, left: -20, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: MUTED }} />
                  <YAxis domain={[0, 50]} tick={{ fontSize: 11, fill: MUTED }} width={30} />
                  <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}` }} />
                  <Bar dataKey="marks" name="This student" fill={INK} radius={[4, 4, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="classAvg" name="Class average" fill="#C3C2B7" radius={[4, 4, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: MUTED }}>
              <LegendDot color={INK} label="This student" />
              <LegendDot color="#C3C2B7" label="Class average" />
            </div>
          </section>
        )}

        <p style={{ fontSize: 12, color: MUTED }}>
          Ranks use competition ranking (ties share a rank). Data is saved to this browser only.
        </p>
      </div>
    </div>
  );
}

function ToolButton({ onClick, label }) {
  return (
    <button onClick={onClick} style={{ border: `1px solid ${LINE}`, background: "#fff", borderRadius: 6, padding: "7px 14px", fontSize: 13, color: INK, cursor: "pointer" }}>
      {label}
    </button>
  );
}

function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        background: "none",
        padding: "8px 4px",
        fontSize: 14,
        color: active ? INK : MUTED,
        fontWeight: active ? 500 : 400,
        borderBottom: active ? `2px solid ${INK}` : "2px solid transparent",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div style={{ background: CARD_BG, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 500, color: color || INK, fontFamily: "Georgia, 'Times New Roman', serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </div>
    </div>
  );
}

function Th({ children, onClick, active, dir }) {
  return (
    <th style={{ ...thStyle, cursor: "pointer" }} onClick={onClick}>
      {children} {active ? (dir === "asc" ? "▲" : "▼") : ""}
    </th>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

const thStyle = { textAlign: "left", fontSize: 11, color: MUTED, padding: "8px 10px", whiteSpace: "nowrap", userSelect: "none" };
const tdStyle = { padding: "6px 10px", fontSize: 13 };
const nameInputStyle = { border: "1px solid transparent", background: "transparent", fontSize: 13, width: "100%", minWidth: 110 };
const markInputStyle = { border: `1px solid ${LINE}`, borderRadius: 4, padding: "3px 5px", fontSize: 12, width: 52 };
const deleteBtnStyle = { border: "none", background: "none", color: MUTED, fontSize: 16, cursor: "pointer", lineHeight: 1 };
