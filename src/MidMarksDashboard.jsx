import { useState, useEffect } from "react";
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

const DEFAULT_SUBJECTS = [
  { id: 1, name: "Subject 1", max: 50, obtained: "" },
  { id: 2, name: "Subject 2", max: 50, obtained: "" },
  { id: 3, name: "Subject 3", max: 50, obtained: "" },
  { id: 4, name: "Subject 4", max: 50, obtained: "" },
  { id: 5, name: "Subject 5", max: 50, obtained: "" },
  { id: 6, name: "Subject 6", max: 50, obtained: "" },
];

const INK = "#1B2A4A";
const PAPER = "#FAF9F5";
const LINE = "#DAD6C9";
const PASS = "#3B6D11";
const PASS_BG = "#EAF3DE";
const FAIL = "#A32D2D";
const FAIL_BG = "#FAECE7";
const MUTED = "#6B6A63";

function gradeFor(pct) {
  if (pct === null) return { label: "—", color: MUTED };
  if (pct >= 90) return { label: "O", color: PASS };
  if (pct >= 80) return { label: "A+", color: PASS };
  if (pct >= 70) return { label: "A", color: PASS };
  if (pct >= 60) return { label: "B+", color: PASS };
  if (pct >= 50) return { label: "B", color: PASS };
  if (pct >= 40) return { label: "C", color: "#854F0B" };
  return { label: "F", color: FAIL };
}

const STORAGE_KEY = "mid-marks-subjects";

export default function MidMarksDashboard() {
  const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle");

  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length === 6) {
            setSubjects(parsed);
          }
        }
      } catch (e) {
        // no saved data yet
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(async () => {
      try {
        setSaveState("saving");
        localStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [subjects, loaded]);

  function updateSubject(id, field, value) {
    setSubjects((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }

  function resetAll() {
    setSubjects(DEFAULT_SUBJECTS);
  }

  const rows = subjects.map((s) => {
    const max = Number(s.max) || 0;
    const obtained = s.obtained === "" ? null : Number(s.obtained);
    const pct =
      obtained === null || max === 0 ? null : (obtained / max) * 100;
    const grade = gradeFor(pct);
    return { ...s, max, obtained, pct, grade };
  });

  const entered = rows.filter((r) => r.obtained !== null);
  const totalMax = rows.reduce((a, r) => a + (Number(r.max) || 0), 0);
  const totalObtained = entered.reduce((a, r) => a + r.obtained, 0);
  const overallPct = entered.length
    ? (totalObtained /
        entered.reduce((a, r) => a + (Number(r.max) || 0), 0)) *
      100
    : null;
  const overallGrade = gradeFor(overallPct);
  const passedCount = entered.filter((r) => r.pct >= 40).length;
  const failedSubjects = entered.filter((r) => r.pct < 40);
  const allEntered = entered.length === 6;
  const overallStatus = !allEntered
    ? null
    : failedSubjects.length === 0
    ? "pass"
    : "fail";

  const strongest = entered.length
    ? entered.reduce((a, b) => (b.pct > a.pct ? b : a))
    : null;
  const weakest = entered.length
    ? entered.reduce((a, b) => (b.pct < a.pct ? b : a))
    : null;

  const chartData = rows.map((r) => ({
    name: r.name || "Untitled",
    percentage: r.pct === null ? 0 : Math.round(r.pct * 10) / 10,
    entered: r.pct !== null,
  }));

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        background: PAPER,
        minHeight: "100vh",
        padding: "32px 20px 64px",
        color: INK,
      }}
    >
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <header style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 0.3,
              color: MUTED,
              marginBottom: 6,
            }}
          >
            Mid-term evaluation
          </div>
          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 30,
              fontWeight: 400,
              margin: 0,
              color: INK,
              lineHeight: 1.25,
            }}
          >
            Six-subject mark sheet
          </h1>
          <p style={{ fontSize: 14, color: MUTED, marginTop: 8, maxWidth: 480 }}>
            Enter marks for each subject to see your percentage, grade, and
            overall standing update automatically.
          </p>
        </header>

        {/* Entry table */}
        <section
          style={{
            background: "#fff",
            border: `1px solid ${LINE}`,
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 90px 90px 70px 60px",
              gap: 8,
              padding: "10px 16px",
              background: "#F3F1EA",
              fontSize: 12,
              color: MUTED,
              borderBottom: `1px solid ${LINE}`,
            }}
          >
            <span>Subject</span>
            <span>Obtained</span>
            <span>Max</span>
            <span>%</span>
            <span>Grade</span>
          </div>
          {rows.map((r, idx) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 90px 70px 60px",
                gap: 8,
                alignItems: "center",
                padding: "10px 16px",
                borderBottom:
                  idx === rows.length - 1 ? "none" : `1px solid ${LINE}`,
              }}
            >
              <input
                value={r.name}
                onChange={(e) => updateSubject(r.id, "name", e.target.value)}
                placeholder={`Subject ${idx + 1}`}
                style={{
                  border: "none",
                  borderBottom: "1px solid transparent",
                  padding: "4px 0",
                  fontSize: 14,
                  background: "transparent",
                  color: INK,
                  outline: "none",
                }}
              />
              <input
                type="number"
                min="0"
                value={r.obtained === null ? "" : r.obtained}
                onChange={(e) =>
                  updateSubject(r.id, "obtained", e.target.value)
                }
                placeholder="—"
                style={{
                  border: `1px solid ${LINE}`,
                  borderRadius: 6,
                  padding: "5px 8px",
                  fontSize: 14,
                  width: "100%",
                }}
              />
              <input
                type="number"
                min="1"
                value={r.max}
                onChange={(e) => updateSubject(r.id, "max", e.target.value)}
                style={{
                  border: `1px solid ${LINE}`,
                  borderRadius: 6,
                  padding: "5px 8px",
                  fontSize: 14,
                  width: "100%",
                }}
              />
              <span style={{ fontSize: 14, color: r.pct === null ? MUTED : INK }}>
                {r.pct === null ? "—" : `${Math.round(r.pct * 10) / 10}`}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: r.grade.color,
                }}
              >
                {r.grade.label}
              </span>
            </div>
          ))}
        </section>

        {/* Summary cards */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 28,
          }}
        >
          <MetricCard label="Marks" value={`${totalObtained}/${entered.reduce((a,r)=>a+(Number(r.max)||0),0)}`} />
          <MetricCard
            label="Overall %"
            value={overallPct === null ? "—" : `${Math.round(overallPct * 10) / 10}%`}
          />
          <MetricCard label="Grade" value={overallGrade.label} color={overallGrade.color} />
          <MetricCard
            label="Status"
            value={
              overallStatus === null
                ? "Pending"
                : overallStatus === "pass"
                ? "Pass"
                : "At risk"
            }
            color={
              overallStatus === "pass"
                ? PASS
                : overallStatus === "fail"
                ? FAIL
                : MUTED
            }
          />
        </section>

        {!allEntered && (
          <div
            style={{
              fontSize: 13,
              color: MUTED,
              marginBottom: 20,
              marginTop: -12,
            }}
          >
            {6 - entered.length} subject{6 - entered.length === 1 ? "" : "s"} still
            need marks for a full overall picture.
          </div>
        )}

        {allEntered && (
          <div
            style={{
              display: "flex",
              gap: 24,
              marginBottom: 28,
              flexWrap: "wrap",
            }}
          >
            {strongest && (
              <div style={{ fontSize: 13, color: MUTED }}>
                Strongest: <strong style={{ color: INK, fontWeight: 500 }}>{strongest.name || "Untitled"}</strong> ({Math.round(strongest.pct * 10) / 10}%)
              </div>
            )}
            {weakest && (
              <div style={{ fontSize: 13, color: MUTED }}>
                Needs attention: <strong style={{ color: INK, fontWeight: 500 }}>{weakest.name || "Untitled"}</strong> ({Math.round(weakest.pct * 10) / 10}%)
              </div>
            )}
          </div>
        )}

        {/* Chart */}
        <section style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 13,
              color: MUTED,
              marginBottom: 10,
            }}
          >
            Percentage by subject — 40% pass line shown
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: MUTED }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: MUTED }}
                  width={34}
                />
                <Tooltip
                  formatter={(v, n, p) =>
                    p.payload.entered ? [`${v}%`, "Percentage"] : ["No data", ""]
                  }
                  contentStyle={{
                    fontSize: 13,
                    borderRadius: 8,
                    border: `1px solid ${LINE}`,
                  }}
                />
                <ReferenceLine
                  y={40}
                  stroke={FAIL}
                  strokeDasharray="4 4"
                  label={{ value: "40%", position: "right", fontSize: 11, fill: FAIL }}
                />
                <Bar dataKey="percentage" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {chartData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={!d.entered ? "#E2E0D6" : d.percentage < 40 ? "#D85A30" : INK}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 24,
          }}
        >
          <button
            onClick={resetAll}
            style={{
              border: `1px solid ${LINE}`,
              background: "#fff",
              borderRadius: 6,
              padding: "7px 14px",
              fontSize: 13,
              color: MUTED,
              cursor: "pointer",
            }}
          >
            Clear all
          </button>
          <span style={{ fontSize: 12, color: MUTED }}>
            {saveState === "saving"
              ? "Saving…"
              : saveState === "error"
              ? "Could not save"
              : loaded
              ? "Saved automatically"
              : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${LINE}`,
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 500,
          color: color || INK,
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        {value}
      </div>
    </div>
  );
}
