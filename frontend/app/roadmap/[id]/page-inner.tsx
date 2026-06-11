"use client";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import RoadmapCanvas from "@/components/roadmap/RoadmapCanvas";
import AgentChatPanel from "@/components/ui/AgentChatPanel";
import { ArrowLeft, LayoutDashboard, Map } from "lucide-react";
import LogoMark from "@/components/brand/LogoMark";

export default function RoadmapDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { roadmaps } = useApp();
  const roadmap = roadmaps.find(r => r.id === id);

  if (!roadmap) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}>
      Roadmap not found.
    </div>
  );

  const done  = roadmap.nodes.filter(n => n.status === "completed").length;
  const total = roadmap.nodes.length;
  const pct   = Math.round((done / total) * 100);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      flex: 1,
      height: "100%",
      minHeight: 0,
      overflow: "hidden",
      fontFamily: "var(--font-body)",
      background: "var(--bg)",
    }}>
      {/* Top bar — fixed height so canvas gets the remainder */}
      <div style={{
        height: 52,
        flexShrink: 0,
        background: "var(--bg-card)", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", padding: "0 18px", gap: 14,
      }}>
        <button onClick={() => router.push("/roadmap")} style={{
          display: "flex", alignItems: "center", gap: 6, background: "transparent",
          border: "none", cursor: "pointer", color: "var(--text-secondary)",
          fontSize: 13, fontFamily: "var(--font-body)", padding: "4px 8px",
          borderRadius: "var(--radius-sm)", transition: "all 0.15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
        >
          <ArrowLeft size={14} /> Roadmaps
        </button>

        <div style={{ width: 1, height: 18, background: "var(--border)" }} />
        <h1 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{roadmap.topic}</h1>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{done}/{total} nodes</span>
          <div style={{ width: 80, height: 4, background: "var(--border)", borderRadius: 2 }}>
            <div style={{ width: `${pct}%`, height: 4, background: "var(--accent)", borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{pct}%</span>
        </div>
      </div>

      {/* Canvas — flex:1 + minHeight:0 so React Flow gets a real height */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
      }}>
        <RoadmapCanvas roadmap={roadmap} />
      </div>
    </div>
  );
}