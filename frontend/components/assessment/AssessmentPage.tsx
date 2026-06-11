"use client";
import { useState, useEffect, Suspense, useMemo } from "react";
import { useApp } from "@/lib/app-context";
import QuizRunner from "./QuizRunner";
import { ProjectRunner, SimulationRunner } from "./ProjectSimRunner";
import { Assessment } from "@/lib/types";
import { ClipboardCheck, CheckCircle2, XCircle, Play, Clock, ArrowLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";

const typeConfig = {
  quiz:       { label: "Quiz",       color: "var(--accent)", dim: "var(--accent-dim)"  },
  project:    { label: "Project",    color: "var(--teal)",   dim: "var(--teal-dim)"    },
  simulation: { label: "Simulation", color: "var(--amber)",  dim: "var(--amber-dim)"   },
};

function AssessmentPageInner() {
  const { assessments, roadmaps } = useApp();
  const [active, setActive] = useState<Assessment | null>(null);
  const searchParams = useSearchParams();
  const autoStartId = searchParams.get("id");

  useEffect(() => {
    if (autoStartId && assessments.length > 0) {
      const found = assessments.find(a => a.id === autoStartId);
      if (found) {
        setActive(found);
      }
    }
  }, [autoStartId, assessments]);

  const roadmapTopics = useMemo(() => {
    const map: Record<string, string> = {};
    roadmaps.forEach(r => {
      map[r.id] = r.topic;
    });
    return map;
  }, [roadmaps]);

  const roadmapWideAssessments = useMemo(() => {
    return assessments.filter(a => a.nodeId === "roadmap_wide");
  }, [assessments]);

  // Group assessments by roadmap
  const roadmapsWithAssessments = useMemo(() => {
    const map: Record<string, { topic: string; pending: Assessment[]; done: Assessment[] }> = {};
    
    // Initialize with existing roadmaps
    roadmaps.forEach(r => {
      map[r.id] = { topic: r.topic, pending: [], done: [] };
    });
    
    // Populate assessments
    roadmapWideAssessments.forEach(a => {
      const rid = a.roadmapId;
      if (!map[rid]) {
        map[rid] = { topic: roadmapTopics[rid] || "Other Topic", pending: [], done: [] };
      }
      if (a.status === "pending") {
        map[rid].pending.push(a);
      } else {
        map[rid].done.push(a);
      }
    });
    
    // Return only those with assessments
    return Object.entries(map)
      .map(([id, data]) => ({ id, ...data }))
      .filter(r => r.pending.length > 0 || r.done.length > 0);
  }, [roadmaps, roadmapWideAssessments, roadmapTopics]);

  const finish = () => setActive(null);

  if (active) {
    return (
      <div className="fade-up" style={{ padding: "32px 36px", width: "100%", boxSizing: "border-box" }}>
        <button onClick={finish} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, marginBottom: 28, display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)" }}>
          <ArrowLeft size={14} /> Back to assessments
        </button>
        {active.type === "quiz"       && <QuizRunner      assessment={active} onFinish={finish} />}
        {active.type === "project"    && <ProjectRunner   assessment={active} onFinish={finish} />}
        {active.type === "simulation" && <SimulationRunner assessment={active} onFinish={finish} />}
      </div>
    );
  }

  const globalPendingCount = roadmapWideAssessments.filter(a => a.status === "pending").length;
  const globalDoneCount = roadmapWideAssessments.filter(a => a.status !== "pending").length;

  return (
    <div className="fade-up" style={{ padding: "32px 36px", width: "100%", boxSizing: "border-box" }}>
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 6 }}>Roadmap Assessments</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>{globalPendingCount} pending</span> &bull; {globalDoneCount} completed
        </p>
      </div>

      {roadmapsWithAssessments.length === 0 ? (
        <div style={{
          padding: "48px 24px",
          textAlign: "center",
          background: "var(--bg-card)",
          border: "1.5px dashed var(--border)",
          borderRadius: "var(--radius-lg)",
          color: "var(--text-muted)",
          fontSize: 14
        }}>
          No assessments generated yet. Select a task in one of your roadmaps and begin a study session to start testing your knowledge!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          {roadmapsWithAssessments.map(rm => (
            <div key={rm.id} style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "24px 28px",
              boxShadow: "var(--shadow-sm)"
            }}>
              {/* Roadmap Header */}
              <div style={{
                borderBottom: "1px solid var(--border)",
                paddingBottom: 14,
                marginBottom: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-display)", margin: 0 }}>
                  {rm.topic}
                </h2>
                <span style={{ fontSize: 11, background: "var(--bg-surface)", border: "1px solid var(--border)", padding: "3px 8px", borderRadius: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                  {rm.pending.length} Active &bull; {rm.done.length} Finished
                </span>
              </div>

              {/* Pending Assessments */}
              {rm.pending.length > 0 && (
                <div style={{ marginBottom: rm.done.length > 0 ? 24 : 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Pending Checkpoints</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {rm.pending.map(a => {
                      const tc = typeConfig[a.type] || typeConfig.quiz;
                      return (
                        <div key={a.id} style={{
                          background: "var(--bg-surface)", border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md)", padding: "14px 18px",
                          display: "flex", alignItems: "center", gap: 14,
                          transition: "border-color 0.15s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = tc.color; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                        >
                          <div style={{ width: 34, height: 34, borderRadius: 8, background: tc.dim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <ClipboardCheck size={16} color={tc.color} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nodeTitle}</div>
                              <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: tc.dim, color: tc.color, fontWeight: 600, textTransform: "uppercase" }}>Roadmap Quiz</span>
                            </div>
                            <div style={{ fontSize: 11.5, color: "var(--text-secondary)", display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                              <span>Questions: {a.questions?.length ?? 0}</span>
                              <span>&bull;</span>
                              <span>Pass score: {a.passingScore}%</span>
                              {a.numCompletedNodes !== undefined && (
                                <>
                                  <span>&bull;</span>
                                  <span>Nodes completed: {a.numCompletedNodes}</span>
                                </>
                              )}
                              {a.createdAt && (
                                <>
                                  <span>&bull;</span>
                                  <span>Generated: {new Date(a.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <button onClick={() => setActive(a)} style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "8px 14px", borderRadius: "var(--radius-md)",
                            background: tc.color, color: "#fff", border: "none",
                            fontSize: 12, fontWeight: 600, cursor: "pointer",
                            boxShadow: `0 2px 6px ${tc.color}22`,
                            transition: "opacity 0.15s",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                          >
                            <Play size={11} fill="#fff" /> Start
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Completed Assessments */}
              {rm.done.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Completed</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {rm.done.map(a => (
                      <div key={a.id} style={{
                        background: "var(--bg-surface)", border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)", padding: "12px 16px",
                        display: "flex", alignItems: "center", gap: 12,
                      }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: a.score! >= a.passingScore ? "var(--green-dim)" : "var(--red-dim)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {a.score! >= a.passingScore ? <CheckCircle2 size={14} color="var(--green)" /> : <XCircle size={14} color="var(--red)" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nodeTitle}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-secondary)", display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={10} /> {a.completedAt ? new Date(a.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
                            {a.numCompletedNodes !== undefined && (
                              <>
                                <span>&bull;</span>
                                <span>Nodes completed: {a.numCompletedNodes}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: a.score! >= a.passingScore ? "var(--green)" : "var(--red)", marginRight: 8 }}>{a.score}%</div>
                        <button onClick={() => setActive(a)} style={{ padding: "6px 12px", borderRadius: "var(--radius-md)", background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 11.5, cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 500 }}>
                          Retake
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AssessmentPage() {
  return (
    <Suspense fallback={<div style={{ padding: "32px 36px", color: "var(--text-muted)" }}>Loading assessments...</div>}>
      <AssessmentPageInner />
    </Suspense>
  );
}