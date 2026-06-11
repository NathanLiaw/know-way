import { redirect } from "next/navigation";
import { roadmapPaths } from "@/lib/routes";

/** Legacy URL — new roadmaps are created via onboarding */
export default function NewRoadmapPage() {
  redirect(roadmapPaths.new);
}
