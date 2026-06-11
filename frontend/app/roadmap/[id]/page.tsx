import RoadmapDetailInner from "./page-inner";

export default function RoadmapDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <RoadmapDetailInner params={params} />;
}