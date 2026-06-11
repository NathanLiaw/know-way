import type {
  ActivityEntry,
  Assessment,
  DashboardStats,
  NodeStatus,
  Roadmap,
  User,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export const clerkAuthEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

let authTokenGetter: (() => Promise<string | null>) | null = null;

/** Register Clerk session token provider (from useAuth().getToken). */
export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  authTokenGetter = getter;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (authTokenGetter) {
    const token = await authTokenGetter();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string; database: string }>("/api/health"),

  seed: (force = false) =>
    request<{ skipped?: boolean; roadmaps?: number }>(`/api/seed?force=${force}`, {
      method: "POST",
    }),

  getUser: () => request<User>("/api/users/me"),
  getLearnerProfile: () => request<any>("/api/users/profile"),

  getRoadmaps: () => request<Roadmap[]>("/api/roadmaps"),

  getRoadmap: (id: string) => request<Roadmap>(`/api/roadmaps/${id}`),

  createRoadmap: (body: Omit<Roadmap, "id" | "createdAt" | "updatedAt">) =>
    request<Roadmap>("/api/roadmaps", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  generateRoadmap: (topic: string, profile?: Record<string, any>) =>
    request<Roadmap>("/api/roadmaps/generate", {
      method: "POST",
      body: JSON.stringify({ topic, profile }),
    }),

  startOnboarding: (topic: string) =>
    request<{ session_id: string; complete: boolean; question?: string; default_answers?: string[]; profile?: any }>(
      "/api/onboarding/start",
      {
        method: "POST",
        body: JSON.stringify({ topic }),
      }
    ),

  sendOnboardingMessage: (sessionId: string, message: string) =>
    request<{ session_id: string; complete: boolean; question?: string; default_answers?: string[]; profile?: any }>(
      "/api/onboarding/message",
      {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, message }),
      }
    ),

  enrichNode: (roadmapId: string, nodeId: string) =>
    request<Roadmap>(`/api/roadmaps/${roadmapId}/nodes/${nodeId}/enrich`, {
      method: "POST",
    }),

  generateSubNodes: (roadmapId: string, confidenceScores: Record<string, number>) =>
    request<Roadmap>(`/api/roadmaps/${roadmapId}/generate_sub`, {
      method: "POST",
      body: JSON.stringify({ confidence_scores: confidenceScores }),
    }),

  generateSubSubNodes: (roadmapId: string, confidenceScores: Record<string, number>) =>
    request<Roadmap>(`/api/roadmaps/${roadmapId}/generate_sub_sub`, {
      method: "POST",
      body: JSON.stringify({ confidence_scores: confidenceScores }),
    }),

  generateQuiz: (roadmapId: string, nodeId: string, taskId: string, bypassTimer = false) =>
    request<Assessment>("/api/assessments/generate", {
      method: "POST",
      body: JSON.stringify({ roadmap_id: roadmapId, node_id: nodeId, task_id: taskId, bypass_timer: bypassTimer }),
    }),

  generateRoadmapAssessment: (roadmapId: string) =>
    request<Assessment>(`/api/assessments/roadmap/${roadmapId}/generate`, {
      method: "POST",
    }),

  updateNodeStatus: (
    roadmapId: string,
    nodeId: string,
    status: NodeStatus,
    confidence?: number,
  ) =>
    request<Roadmap>(`/api/roadmaps/${roadmapId}/nodes/${nodeId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, confidence }),
    }),

  getAssessments: () => request<Assessment[]>("/api/assessments"),

  updateAssessmentScore: (assessmentId: string, score: number, userResponse?: string) =>
    request<Assessment>(`/api/assessments/${assessmentId}`, {
      method: "PATCH",
      body: JSON.stringify({ score, userResponse }),
    }),

  getDashboardStats: () => request<DashboardStats>("/api/dashboard/stats"),
  
  getActivity: () => request<ActivityEntry[]>("/api/dashboard/activity"),

  deleteRoadmap: (id: string) =>
    request<void>(`/api/roadmaps/${id}`, {
      method: "DELETE",
    }),

  updateRoadmapStatus: (id: string, status: string) =>
    request<Roadmap>(`/api/roadmaps/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  getPlannerSchedule: (roadmapId?: string) =>
    request<any[]>(`/api/planner${roadmapId ? `?roadmap_id=${roadmapId}` : ""}`),

  startTaskSession: (roadmapId: string, nodeId: string, taskId: string) =>
    request<Roadmap>(`/api/roadmaps/${roadmapId}/nodes/${nodeId}/tasks/${taskId}/session/start`, {
      method: "POST",
    }),

  extendTaskSession: (roadmapId: string, nodeId: string, taskId: string) =>
    request<Roadmap>(`/api/roadmaps/${roadmapId}/nodes/${nodeId}/tasks/${taskId}/session/extend`, {
      method: "POST",
    }),

  pauseTaskSession: (roadmapId: string, nodeId: string, taskId: string) =>
    request<Roadmap>(`/api/roadmaps/${roadmapId}/nodes/${nodeId}/tasks/${taskId}/session/pause`, {
      method: "POST",
    }),

  resumeTaskSession: (roadmapId: string, nodeId: string, taskId: string) =>
    request<Roadmap>(`/api/roadmaps/${roadmapId}/nodes/${nodeId}/tasks/${taskId}/session/resume`, {
      method: "POST",
    }),

  chatTaskSession: (roadmapId: string, nodeId: string, taskId: string, message: string) =>
    request<{ response: string }>(`/api/roadmaps/${roadmapId}/nodes/${nodeId}/tasks/${taskId}/session/chat`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  getTaskSession: (roadmapId: string, nodeId: string, taskId: string) =>
    request<{ messages: any[] }>(`/api/roadmaps/${roadmapId}/nodes/${nodeId}/tasks/${taskId}/session`),

  forkNode: (roadmapId: string, nodeId: string) =>
    request<Roadmap>(`/api/roadmaps/${roadmapId}/nodes/${nodeId}/fork`, {
      method: "POST",
    }),


  getCommitments: () =>
    request<any[]>("/api/planner/commitments"),

  updateCommitment: (eventId: string, date: string, pinned: boolean) =>
    request<any>("/api/planner/commitments", {
      method: "POST",
      body: JSON.stringify({ eventId, date, pinned }),
    }),

  deleteCommitment: (eventId: string) =>
    request<any>(`/api/planner/commitments/${eventId}`, {
      method: "DELETE",
    }),
};

