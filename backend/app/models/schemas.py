from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

NodeStatus = Literal["locked", "unlocked", "not_started", "in_progress", "failed", "completed", "success"]
RoadmapStatus = Literal["active", "completed", "paused"]
AssessmentStatus = Literal["pending", "completed", "failed"]
ActivityType = Literal["completed", "started", "resource", "quiz", "new_roadmap"]


class Resource(BaseModel):
    id: str
    title: str
    url: str
    type: Literal["video", "article", "course", "book", "documentation", "interactive"]
    qualityScore: int
    difficulty: Literal["beginner", "intermediate", "advanced"]
    durationMins: int
    why: str | None = None
    website: str | None = None


class NodeTask(BaseModel):
    id: str
    name: str
    description: str
    difficulty: Literal["Foundational", "Applied", "Stretch"]
    type: Literal["Build", "Explain", "Analyse", "Research", "Apply"]
    durationMins: int
    completed: bool = False
    status: Literal["not_started", "in_progress", "failed", "success"] = "not_started"
    score: int | None = None
    
    # Session contract fields
    sessionStartedAt: str | None = None
    sessionDurationMins: int | None = None
    sessionExtendedMins: int = 0
    sessionTimeSpentMins: int = 0
    sessionPausedAt: str | None = None
    sessionIsPaused: bool = False


class RoadmapNode(BaseModel):
    id: str
    title: str
    description: str
    status: NodeStatus
    confidence: int = Field(ge=0, le=100)
    prerequisites: list[str] = []
    estimatedHours: int
    resources: list[Resource] = []
    position: dict[str, float]
    depth: int | str = 0
    parent: str | None = None
    tasks: list[NodeTask] = []  # Using typed NodeTask schema
    isSkillCheck: bool = False
    summary: list[str] = []
    
    # Forking and intervention helper indicators
    isOptionalFork: bool = False
    forkParentId: str | None = None


class ConceptLog(BaseModel):
    concept: str
    masteryScore: int  # 0 to 100
    lastTested: str  # ISO Date
    status: Literal["mastered", "learning", "struggling"]


class DetailedLogEntry(BaseModel):
    taskId: str
    taskName: str
    nodeId: str
    roadmapId: str
    completedAt: str
    score: int
    demonstratedConcepts: list[str]
    detectedGaps: list[str]
    specificMistakes: list[str]
    confidenceSignals: list[str] = []


class BehavioralPatterns(BaseModel):
    preferredDays: list[int] = []  # 0=Mon, etc.
    avgSessionMins: float = 0.0
    streakCount: int = 0
    actualVsIntendedRatio: float = 1.0


class LearnerModel(BaseModel):
    userId: str
    compressedSummary: str  # 500-800 token profile for real-time prompt inject
    concepts: list[ConceptLog] = []
    detailedLogs: list[DetailedLogEntry] = []
    behavioralPatterns: BehavioralPatterns = Field(default_factory=BehavioralPatterns)
    updatedAt: str


class RoadmapEdge(BaseModel):
    id: str
    source: str
    target: str


class Roadmap(BaseModel):
    id: str
    userId: str | None = None
    topic: str
    description: str
    status: RoadmapStatus
    nodes: list[RoadmapNode]
    edges: list[RoadmapEdge]
    createdAt: str
    updatedAt: str
    advisor_metadata: dict | None = None


class RoadmapCreate(BaseModel):
    topic: str
    description: str | None = None
    nodes: list[RoadmapNode]
    edges: list[RoadmapEdge]
    status: RoadmapStatus = "active"
    advisor_metadata: dict | None = None


class RoadmapGenerateRequest(BaseModel):
    topic: str
    profile: dict | None = None


class RoadmapExpandRequest(BaseModel):
    confidence_scores: dict[str, int]



class NodeStatusUpdate(BaseModel):
    status: NodeStatus
    confidence: int | None = Field(default=None, ge=0, le=100)
    summary: list[str] | None = None


class RoadmapStatusUpdate(BaseModel):
    status: RoadmapStatus



class QuizQuestion(BaseModel):
    id: str
    question: str
    options: list[str]
    correctIndex: int
    explanation: str


class Assessment(BaseModel):
    id: str
    userId: str | None = None
    nodeId: str
    nodeTitle: str
    roadmapId: str
    taskId: str | None = None  # NEW: Scoped to specific task
    type: Literal["quiz", "project", "simulation"]
    score: int | None = None
    passingScore: int
    status: AssessmentStatus
    questions: list[QuizQuestion] | None = None
    completedAt: str | None = None
    summary: list[str] = []
    format: Literal["mcq", "free_form"] = "mcq"
    freeFormPrompt: str | None = None
    userResponse: str | None = None
    agentFeedback: str | None = None
    numCompletedNodes: int | None = None
    completedNodesTitles: list[str] = []
    createdAt: str | None = None


class AssessmentScoreUpdate(BaseModel):
    score: int | None = Field(default=None, ge=0, le=100)
    userResponse: str | None = None


class User(BaseModel):
    id: str
    name: str
    email: str
    streak: int
    joinedAt: str


class ActivityEntry(BaseModel):
    id: str
    type: ActivityType
    label: str
    subLabel: str
    timestamp: str


class DashboardStats(BaseModel):
    activeRoadmaps: int
    nodesCompleted: int
    avgConfidence: int
    streak: int


class HealthResponse(BaseModel):
    status: str
    database: str
