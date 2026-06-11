/** Demo roadmap id (Home Cooking Mastery) — sample graph for browsing */
export const DEMO_ROADMAP_ID = "rm_cooking";

export const roadmapPaths = {
  list: "/roadmap",
  /** Create a new learning path */
  new: "/onboarding",
  detail: (id: string) => `/roadmap/${id}`,
  /** Optional: open the bundled demo graph */
  demo: `/roadmap/${DEMO_ROADMAP_ID}`,
} as const;
