"use client";

export function StatSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 88, borderRadius: "var(--radius-lg)" }} />
      ))}
    </div>
  );
}

export function CardSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="skeleton" style={{ height, borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }} />
  );
}

export function RoadmapNodeSkeleton() {
  return (
    <div className="skeleton" style={{ width: 186, height: 96, borderRadius: "var(--radius-lg)" }} />
  );
}