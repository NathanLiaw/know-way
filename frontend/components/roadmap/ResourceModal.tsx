"use client";
import { Resource } from "@/lib/types";
import { X, ExternalLink, Star, Clock, BarChart2, Video, FileText, BookOpen, GraduationCap, Play } from "lucide-react";

const typeLabel = {
  video: "Video",
  article: "Article",
  course: "Course",
  book: "Book",
  documentation: "Documentation",
  interactive: "Interactive"
};
const typeColor = {
  video: "var(--accent)",
  article: "var(--purple)",
  course: "var(--teal)",
  book: "var(--amber)",
  documentation: "var(--blue)",
  interactive: "var(--green)"
};
const typeIcon = {
  video:         <Video size={20} />,
  article:       <FileText size={20} />,
  course:        <GraduationCap size={20} />,
  book:          <BookOpen size={20} />,
  documentation: <FileText size={20} />,
  interactive:   <Play size={20} />,
};
const difficultyBar = { beginner: 1, intermediate: 2, advanced: 3 };

interface Props { resource: Resource; onClose: () => void; }

export default function ResourceModal({ resource, onClose }: Props) {
  const c = typeColor[resource.type];
  const bars = difficultyBar[resource.difficulty];

  return (
    <div
      className="fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(26,21,16,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, backdropFilter: "blur(4px)",
      }}
    >
      <div className="fade-up" style={{
        width: "100%", maxWidth: 480,
        background: "var(--bg-card)", borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)",
        overflow: "hidden",
      }}>
        {/* Coloured header band */}
        <div style={{ background: `${c}14`, borderBottom: "1px solid var(--border)", padding: "24px 24px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${c}22`, display: "flex", alignItems: "center", justifyContent: "center", color: c }}>
              {typeIcon[resource.type]}
            </div>
            <button onClick={onClose} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-muted)", padding: "5px 7px", display: "flex" }}>
              <X size={15} />
            </button>
          </div>
          <h3 style={{ marginTop: 14, fontSize: 18, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, fontFamily: "var(--font-display)" }}>{resource.title}</h3>
          <span style={{ display: "inline-block", marginTop: 8, fontSize: 11, padding: "3px 10px", borderRadius: 20, background: `${c}22`, color: c, fontWeight: 600 }}>
            {typeLabel[resource.type]}
          </span>
        </div>

        {/* Stats */}
        <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, borderBottom: "1px solid var(--border)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
              <Star size={14} color="var(--amber)" fill="var(--amber)" />
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{resource.qualityScore}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Quality score</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
              <Clock size={14} color="var(--text-muted)" />
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{resource.durationMins}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Minutes</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 4 }}>
              <BarChart2 size={14} color="var(--text-muted)" />
              <div style={{ display: "flex", gap: 2 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ width: 6, height: 16, borderRadius: 3, background: i <= bars ? c : "var(--border)" }} />
                ))}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize" }}>{resource.difficulty}</div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: "20px 24px", display: "flex", gap: 10 }}>
          <a
            href={resource.url} target="_blank" rel="noopener noreferrer"
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px", borderRadius: "var(--radius-md)",
              background: c, color: "#fff", textDecoration: "none",
              fontSize: 14, fontWeight: 600,
              boxShadow: `0 2px 8px ${c}40`,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <ExternalLink size={15} /> Open resource
          </a>
          <button onClick={onClose} style={{
            padding: "12px 18px", borderRadius: "var(--radius-md)",
            background: "transparent", border: "1px solid var(--border)",
            color: "var(--text-secondary)", fontSize: 14, cursor: "pointer",
            transition: "border-color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-strong)")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}