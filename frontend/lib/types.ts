// Shared domain types (API + UI)

export type NodeStatus = "locked" | "unlocked" | "not_started" | "in_progress" | "failed" | "completed" | "success";
export type RoadmapStatus = "active" | "completed" | "paused";

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: "video" | "article" | "course" | "book" | "documentation" | "interactive";
  qualityScore: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  durationMins: number;
  why?: string;
  website?: string;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  difficulty: "Foundational" | "Applied" | "Stretch" | "foundational" | "applied" | "stretch";
  type: string;
  durationMins: number;
  completed?: boolean;
  status?: "not_started" | "in_progress" | "failed" | "success";
  score?: number | null;
  sessionStartedAt?: string | null;
  sessionDurationMins?: number | null;
  sessionExtendedMins?: number;
  sessionTimeSpentMins?: number;
  sessionIsPaused?: boolean;
  sessionPausedAt?: string | null;
}

export interface RoadmapNode {
  id: string;
  title: string;
  description: string;
  status: NodeStatus;
  confidence: number;
  prerequisites: string[];
  estimatedHours: number;
  resources: Resource[];
  position: { x: number; y: number };
  depth?: number | string;
  parent?: string | null;
  tasks?: Task[];
  isSkillCheck?: boolean;
  summary?: string[];
  isOptionalFork?: boolean;
  forkParentId?: string | null;
}

export interface RoadmapEdge {
  id: string;
  source: string;
  target: string;
}

export interface Roadmap {
  id: string;
  topic: string;
  description: string;
  status: RoadmapStatus;
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
  createdAt: string;
  updatedAt: string;
  advisor_metadata?: {
    experience: string;
    time: number;
    learning_goal: string;
    detail: string;
  } | null;
}

export interface Assessment {
  id: string;
  nodeId: string;
  nodeTitle: string;
  roadmapId: string;
  taskId?: string | null;
  type: "quiz" | "project" | "simulation";
  score?: number;
  passingScore: number;
  status: "pending" | "completed" | "failed";
  questions?: QuizQuestion[];
  completedAt?: string;
  summary?: string[];
  format?: "mcq" | "free_form";
  freeFormPrompt?: string | null;
  userResponse?: string | null;
  agentFeedback?: string | null;
  numCompletedNodes?: number;
  completedNodesTitles?: string[];
  createdAt?: string;
}


export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ActivityEntry {
  id: string;
  type: "completed" | "started" | "resource" | "quiz" | "new_roadmap";
  label: string;
  subLabel: string;
  timestamp: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  streak: number;
  joinedAt: string;
}

export interface DashboardStats {
  activeRoadmaps: number;
  nodesCompleted: number;
  avgConfidence: number;
  streak: number;
  currentStreak: number;
}
