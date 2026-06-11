"use client";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { roadmapPaths } from "@/lib/routes";
import { api } from "@/lib/api";
import { BookOpen, Plus, ArrowRight, Play, Pause, Trash2 } from "lucide-react";

const newRoadmapButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "9px 16px",
  borderRadius: "var(--radius-md)",
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
  textDecoration: "none",
  fontFamily: "var(--font-body)",
};

export default function RoadmapListPage() {
  const router = useRouter();
  const { roadmaps, assessments = [], refresh } = useApp();

  const handleToggleStatus = async (e: React.MouseEvent, id: string, currentStatus: string) => {
    e.stopPropagation();
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    try {
      await api.updateRoadmapStatus(id, nextStatus);
      if (refresh) await refresh();
    } catch (err: any) {
      alert(err.message || "Failed to update roadmap status.");
    }
  };

  const handleDeleteRoadmap = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this roadmap? This action cannot be undone.")) {
      return;
    }
    try {
      await api.deleteRoadmap(id);
      if (refresh) await refresh();
    } catch (err: any) {
      alert(err.message || "Failed to delete roadmap.");
    }
  };

  const handleCreateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const activeCount = roadmaps.filter(r => r.status === "active").length;
    if (activeCount >= 3) {
      alert("You have reached the limit of 3 active roadmaps. Please pause or delete an existing roadmap before creating a new one.");
    } else {
      router.push(roadmapPaths.new);
    }
  };

  return (
    <div className="fade-up" style={{ padding: "32px 36px", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 6 }}>My roadmaps</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{roadmaps.length} learning paths</p>
        </div>
        <button onClick={handleCreateClick} style={newRoadmapButtonStyle}>
          <Plus size={15} /> New roadmap
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {roadmaps.map((rm, i) => {
          const total = rm.nodes.length;
          const done = rm.nodes.filter(n => n.status === "completed" || n.status === "success").length;
          const pct = Math.round((done / total) * 100);
          const colors = ["var(--accent)", "var(--amber)"];
          const c = colors[i % colors.length];

          // Percentage-based scaling validation (matching backend)
          const minRequired = Math.max(2, Math.ceil(total * 0.30));
          let isLocked = done < minRequired;
          let lockReason = "";
          
          if (isLocked) {
            lockReason = `You must complete at least ${minRequired} nodes (30% of the roadmap) to take an assessment. Currently completed: ${done}/${total}.`;
          } else {
            // Check subsequent progress since the last completed roadmap-wide assessment
            const completedWide = assessments.filter(
              a => a.roadmapId === rm.id && a.nodeId === "roadmap_wide" && a.status === "completed"
            );
            completedWide.sort(
              (a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()
            );
            const lastAssessment = completedWide[0];
            if (lastAssessment) {
              const lastCompletedCount = lastAssessment.numCompletedNodes || 0;
              const newProgress = done - lastCompletedCount;
              const requiredProgress = Math.max(2, Math.ceil(total * 0.20));
              if (newProgress < requiredProgress) {
                isLocked = true;
                lockReason = `You must complete at least ${requiredProgress} new nodes (20% of the roadmap) since your last assessment. Completed since last: ${newProgress}/${total}.`;
              }
            }
          }

          return (
            <div
              key={rm.id}
              role="link"
              tabIndex={0}
              onClick={() => router.push(roadmapPaths.detail(rm.id))}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(roadmapPaths.detail(rm.id));
                }
              }}
              style={{
                background: rm.status === "active" ? "var(--bg-card)" : "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-xl)", padding: "24px",
                cursor: "pointer", transition: "border-color 0.2s, transform 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = c; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "none"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${c}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <BookOpen size={20} color={c} />
                  </div>
                  <span style={{
                    fontSize: 9, padding: "1px 5px", borderRadius: 8,
                    background: rm.status === "active" ? "var(--accent-dim)" : "var(--bg-surface)",
                    color: rm.status === "active" ? "var(--accent)" : "var(--text-muted)",
                    fontWeight: 600, textTransform: "uppercase"
                  }}>
                    {rm.status}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    onClick={(e) => handleToggleStatus(e, rm.id, rm.status)}
                    title={rm.status === "active" ? "Pause Roadmap" : "Activate Roadmap"}
                    style={{
                      padding: "4px 6px", borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)", background: "transparent",
                      color: rm.status === "active" ? "var(--amber)" : "var(--green)", cursor: "pointer",
                      display: "flex", alignItems: "center"
                    }}
                  >
                    {rm.status === "active" ? <Pause size={12} /> : <Play size={12} />}
                  </button>
                  <button
                    onClick={(e) => handleDeleteRoadmap(e, rm.id)}
                    title="Delete Roadmap"
                    style={{
                      padding: "4px 6px", borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)", background: "transparent",
                      color: "var(--red)", cursor: "pointer",
                      display: "flex", alignItems: "center"
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                  <ArrowRight size={18} color="var(--text-muted)" style={{ marginLeft: 6 }} />
                </div>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>{rm.topic}</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>{rm.description}</p>
              <div style={{ marginBottom: 10 }}>
                <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
                  <div style={{ width: `${pct}%`, height: 4, background: c, borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
                <span>{done}/{total} nodes complete</span>
                <span style={{ color: c, fontWeight: 600 }}>{pct}%</span>
              </div>
              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                <div className={isLocked ? "tooltip-container" : ""}>
                  {isLocked && <div className="tooltip-box">{lockReason}</div>}
                  <button
                    disabled={isLocked}
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const quiz = await api.generateRoadmapAssessment(rm.id);
                        if (refresh) await refresh();
                        router.push(`/assessment?id=${quiz.id}`);
                      } catch (err: any) {
                        alert(err.message || "Failed to generate assessment.");
                      }
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "var(--radius-sm)",
                      background: isLocked ? "var(--bg-surface)" : "var(--accent)",
                      color: isLocked ? "var(--text-muted)" : "#fff",
                      border: "none",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: isLocked ? "not-allowed" : "pointer",
                      boxShadow: isLocked ? "none" : "0 2px 6px rgba(232,82,10,0.15)",
                      transition: "opacity 0.15s"
                    }}
                    onMouseEnter={e => {
                      if (!isLocked) e.currentTarget.style.opacity = "0.9";
                    }}
                    onMouseLeave={e => {
                      if (!isLocked) e.currentTarget.style.opacity = "1";
                    }}
                  >
                    Take Assessment
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        <div
          onClick={handleCreateClick}
          style={{
            background: "transparent", border: "1.5px dashed var(--border)",
            borderRadius: "var(--radius-xl)", padding: "24px",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10,
            minHeight: 180, transition: "border-color 0.2s",
            textDecoration: "none",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
        >
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Plus size={18} color="var(--text-muted)" />
          </div>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Create new roadmap</span>
        </div>
      </div>
    </div>
  );
}
