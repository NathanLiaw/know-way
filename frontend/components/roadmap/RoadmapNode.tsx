"use client";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { RoadmapNode, Assessment } from "@/lib/types";
import { CheckCircle2, Lock, Play, Circle, Clock, Trophy, AlertCircle } from "lucide-react";

const statusConfig = {
  success:     { border: "#1a9e5c", bg: "rgba(26,158,92,0.07)",   pill: "#e8f7f0", pillText: "#1a9e5c", label: "Done"    },
  completed:   { border: "#1a9e5c", bg: "rgba(26,158,92,0.07)",   pill: "#e8f7f0", pillText: "#1a9e5c", label: "Done"    },
  in_progress: { border: "#e8520a", bg: "rgba(232,82,10,0.07)",   pill: "#fff1eb", pillText: "#e8520a", label: "Active"  },
  failed:      { border: "#dc3545", bg: "rgba(220,53,69,0.07)",   pill: "#fdf2f2", pillText: "#dc3545", label: "Failed"  },
  not_started: { border: "#c8bfb0", bg: "#ffffff",                 pill: "#f4efe6", pillText: "#6b5f50", label: "Ready"   },
  unlocked:    { border: "#c8bfb0", bg: "#ffffff",                 pill: "#f4efe6", pillText: "#6b5f50", label: "Ready"   },
  locked:      { border: "#e2d9cc", bg: "#faf7f2",                 pill: "#f4efe6", pillText: "#a89880", label: "Locked"  },
};

export default function RoadmapNodeComponent({ data, selected }: NodeProps) {
  const node = data as unknown as RoadmapNode & { onClick: () => void; isNew?: boolean; assessments?: Assessment[] };
  const assessments = node.assessments || [];
  const hasTaskInProgress = node.tasks?.some(t => t.sessionStartedAt && !t.completed);
  
  const nodeStatus = hasTaskInProgress ? "in_progress" : node.status;
  const isLocked = nodeStatus === "locked";
  const baseCfg = statusConfig[nodeStatus] || statusConfig.locked;

  // Calculate task counts and average task score
  const nodeTasks = node.tasks || [];
  const completedTasksList = nodeTasks.filter(t => t.completed);
  const completedCount = completedTasksList.length;
  const totalCount = nodeTasks.length;

  let avgConfidence: number | null = null;
  if (completedCount > 0) {
    const completedTaskIds = completedTasksList.map(t => t.id);
    const completedAssessments = assessments.filter(a => 
      a.nodeId === node.id && 
      a.taskId && 
      completedTaskIds.includes(a.taskId) &&
      (a.status === "completed" || a.status === "completed" as any) && 
      a.score !== undefined
    );
    if (completedAssessments.length > 0) {
      const totalScores = completedAssessments.reduce((sum, a) => sum + (a.score || 0), 0);
      avgConfidence = Math.round(totalScores / completedAssessments.length);
    }
  }

  // Calculate skill check completed score
  let skillCheckScore: number | null = null;
  if (node.isSkillCheck) {
    const scAss = assessments.find(a => a.nodeId === node.id && (a.status === "completed" || a.status === "completed" as any));
    if (scAss && scAss.score !== undefined) {
      skillCheckScore = scAss.score;
    }
  }
  
  const cfg = node.isSkillCheck
    ? {
        border: isLocked ? "#d8d4fc" : "#6366f1",
        bg: isLocked ? "rgba(99,102,241,0.02)" : "rgba(99,102,241,0.07)",
        pill: "#e0e7ff",
        pillText: "#4f46e5",
        label: isLocked ? "Locked" : ((node.status === "completed" || node.status === "success") ? (skillCheckScore !== null ? `${skillCheckScore}%` : "Passed") : "Skill Check"),
      }
    : {
        ...baseCfg,
        label: isLocked ? "Locked" : (totalCount > 0 ? `${completedCount}/${totalCount}` : baseCfg.label)
      };

  return (
    <div
      onClick={!isLocked ? node.onClick : undefined}
      className={`${node.isNew ? "unlock-pop" : ""} ${hasTaskInProgress ? "pulse" : ""}`}
      style={{
        width: 186,
        background: cfg.bg,
        border: `1.5px solid ${selected ? "var(--accent)" : cfg.border}`,
        borderRadius: "var(--radius-lg)",
        padding: "14px 16px",
        cursor: isLocked ? "not-allowed" : "pointer",
        opacity: isLocked ? 0.5 : 1,
        transition: "box-shadow 0.2s, border-color 0.2s, transform 0.15s",
        boxShadow: selected
          ? "0 0 0 3px rgba(232,82,10,0.2), var(--shadow-card)"
          : isLocked ? "none" : "var(--shadow-sm)",
        transform: selected ? "scale(1.02)" : "scale(1)",
        fontFamily: "var(--font-body)",
      }}
      onMouseEnter={e => { if (!isLocked && !selected) (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)"; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.boxShadow = isLocked ? "none" : "var(--shadow-sm)"; }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      {/* Status indicator + title row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.35, flex: 1 }}>
          {node.title}
        </div>
        <div style={{ flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
          {node.isSkillCheck && <Trophy size={14} color="#6366f1" fill="rgba(99,102,241,0.2)" />}
          {(node.status === "completed" || node.status === "success") && <CheckCircle2 size={15} color="var(--green)"  />}
          {node.status === "in_progress" && <Play size={13} color="var(--accent)" fill="var(--accent)" />}
          {(node.status === "unlocked" || node.status === "not_started") && <Circle size={14} color="var(--border-strong)" />}
          {node.status === "failed"      && <AlertCircle size={14} color="#dc3545" />}
          {node.status === "locked"      && <Lock size={13} color="var(--text-muted)" />}
        </div>
      </div>

      {/* Confidence bar (average score of completed tasks) */}
      {!node.isSkillCheck && avgConfidence !== null && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
            <div style={{
              width: `${avgConfidence}%`, height: 4, borderRadius: 2,
              background: "var(--green)",
              transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)",
            }} />
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3, textAlign: "right" }}>{avgConfidence}% average score</div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
        <span style={{
          fontSize: 10, padding: "2px 8px", borderRadius: 20,
          background: cfg.pill, color: cfg.pillText, fontWeight: 600,
        }}>{cfg.label}</span>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}