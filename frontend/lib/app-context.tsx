"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { api, ApiError, clerkAuthEnabled, setAuthTokenGetter } from "./api";
import type {
  ActivityEntry,
  Assessment,
  DashboardStats,
  NodeStatus,
  Roadmap,
  User,
} from "./types";

interface AppState {
  roadmaps: Roadmap[];
  assessments: Assessment[];
  user: User | null;
  stats: DashboardStats | null;
  activity: ActivityEntry[];
  activeRoadmapId: string | null;
  loading: boolean;
  error: string | null;
  setActiveRoadmapId: (id: string) => void;
  updateNodeStatus: (
    roadmapId: string,
    nodeId: string,
    status: NodeStatus,
    confidence?: number,
  ) => Promise<void>;
  updateAssessmentScore: (assessmentId: string, score: number, userResponse?: string) => Promise<void>;
  addRoadmap: (roadmap: Roadmap) => Promise<Roadmap>;
  startTaskSession: (roadmapId: string, nodeId: string, taskId: string) => Promise<void>;
  extendTaskSession: (roadmapId: string, nodeId: string, taskId: string) => Promise<void>;
  pauseTaskSession: (roadmapId: string, nodeId: string, taskId: string) => Promise<void>;
  resumeTaskSession: (roadmapId: string, nodeId: string, taskId: string) => Promise<void>;
  refresh: () => Promise<void>;
  dismissedTaskIds: string[];
  dismissTask: (taskId: string) => void;
  undismissTask: (taskId: string) => void;
}

const AppContext = createContext<AppState | null>(null);

function AppProviderInner({ children }: { children: ReactNode }) {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activeRoadmapId, setActiveRoadmapId] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [hasAutoDismissed, setHasAutoDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedTaskIds, setDismissedTaskIds] = useState<string[]>([]);
  const [dismissedLoaded, setDismissedLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("knowway_dismissed_tasks");
      if (stored) {
        setDismissedTaskIds(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
    setDismissedLoaded(true);
  }, []);

  useEffect(() => {
    if (dismissedLoaded) {
      try {
        localStorage.setItem("knowway_dismissed_tasks", JSON.stringify(dismissedTaskIds));
      } catch (e) {
        console.error(e);
      }
    }
  }, [dismissedTaskIds, dismissedLoaded]);

  // Once roadmaps load, auto-dismiss any active tasks that are already in progress so they don't force-pop on load
  useEffect(() => {
    if (initialLoaded && roadmaps.length > 0 && !hasAutoDismissed) {
      const inProgressIds: string[] = [];
      for (const rm of roadmaps) {
        for (const node of rm.nodes) {
          if (node.tasks) {
            for (const task of node.tasks) {
              if (task.sessionStartedAt && !task.completed) {
                inProgressIds.push(task.id);
              }
            }
          }
        }
      }
      setDismissedTaskIds(prev => {
        const next = [...prev];
        let changed = false;
        inProgressIds.forEach(id => {
          if (!next.includes(id)) {
            next.push(id);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      setHasAutoDismissed(true);
    }
  }, [initialLoaded, roadmaps, hasAutoDismissed]);

  const dismissTask = useCallback((taskId: string) => {
    setDismissedTaskIds(prev => prev.includes(taskId) ? prev : [...prev, taskId]);
  }, []);

  const undismissTask = useCallback((taskId: string) => {
    setDismissedTaskIds(prev => prev.filter(id => id !== taskId));
  }, []);

  const loadAll = useCallback(async () => {
    if (!initialLoaded) {
      setLoading(true);
    }
    setError(null);
    try {
      const [roadmapList, assessmentList, me, dashStats, activityList] = await Promise.all([
        api.getRoadmaps(),
        api.getAssessments(),
        api.getUser(),
        api.getDashboardStats(),
        api.getActivity(),
      ]);
      setRoadmaps(roadmapList);
      setAssessments(assessmentList);
      setUser(me);
      setStats(dashStats);
      setActivity(activityList);
      setInitialLoaded(true);
    } catch (e) {
      if (!clerkAuthEnabled && e instanceof ApiError && e.status === 404) {
        try {
          await api.seed(false);
          return loadAll();
        } catch (seedErr) {
          setError(
            seedErr instanceof Error
              ? seedErr.message
              : "Failed to seed database. Is the API running?",
          );
        }
      } else if (e instanceof ApiError && e.status === 401) {
        setError("Please sign in to continue.");
      } else {
        setError(
          e instanceof Error
            ? e.message
            : "Could not reach API. Start backend on port 8000.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [initialLoaded]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const updateNodeStatus = useCallback(
    async (
      roadmapId: string,
      nodeId: string,
      status: NodeStatus,
      confidence?: number,
    ) => {
      const updated = await api.updateNodeStatus(roadmapId, nodeId, status, confidence);
      setRoadmaps(prev => prev.map(rm => (rm.id === roadmapId ? updated : rm)));
      const dashStats = await api.getDashboardStats();
      setStats(dashStats);
    },
    [],
  );

  const updateAssessmentScore = useCallback(async (assessmentId: string, score: number, userResponse?: string) => {
    const updated = await api.updateAssessmentScore(assessmentId, score, userResponse);
    setAssessments(prev => prev.map(a => (a.id === assessmentId ? updated : a)));
    
    // Immediately re-fetch roadmaps & dashboard stats to synchronize node status and confidence
    try {
      const [roadmapList, dashStats] = await Promise.all([
        api.getRoadmaps(),
        api.getDashboardStats()
      ]);
      setRoadmaps(roadmapList);
      setStats(dashStats);
    } catch (e) {
      console.error("Failed to refresh roadmaps after quiz score update:", e);
    }
  }, []);

  const addRoadmap = useCallback(async (roadmap: Roadmap) => {
    const created = await api.createRoadmap({
      topic: roadmap.topic,
      description: roadmap.description,
      status: roadmap.status,
      nodes: roadmap.nodes,
      edges: roadmap.edges,
    });
    setRoadmaps(prev => [...prev, created]);
    const dashStats = await api.getDashboardStats();
    setStats(dashStats);
    return created;
  }, []);

  const startTaskSession = useCallback(async (roadmapId: string, nodeId: string, taskId: string) => {
    try {
      const updated = await api.startTaskSession(roadmapId, nodeId, taskId);
      setRoadmaps(prev => prev.map(rm => (rm.id === roadmapId ? updated : rm)));
      setDismissedTaskIds(prev => prev.filter(id => id !== taskId));
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && e.message.includes("active")) {
        // Find the active task session across all roadmaps
        let activeTask = null;
        for (const rm of roadmaps) {
          for (const node of rm.nodes) {
            if (node.tasks) {
              for (const task of node.tasks) {
                if (task.sessionStartedAt && !task.completed) {
                  activeTask = task;
                  break;
                }
              }
            }
            if (activeTask) break;
          }
          if (activeTask) break;
        }
        if (activeTask) {
          alert(`Another study session is currently active: "${activeTask.name}". Resuming it now.`);
          setDismissedTaskIds(prev => prev.filter(id => id !== activeTask.id));
        } else {
          alert(e.message);
        }
      } else {
        alert(e instanceof Error ? e.message : "Failed to start study session.");
      }
    }
  }, [roadmaps]);

  const extendTaskSession = useCallback(async (roadmapId: string, nodeId: string, taskId: string) => {
    const updated = await api.extendTaskSession(roadmapId, nodeId, taskId);
    setRoadmaps(prev => prev.map(rm => (rm.id === roadmapId ? updated : rm)));
  }, []);

  const pauseTaskSession = useCallback(async (roadmapId: string, nodeId: string, taskId: string) => {
    const updated = await api.pauseTaskSession(roadmapId, nodeId, taskId);
    setRoadmaps(prev => prev.map(rm => (rm.id === roadmapId ? updated : rm)));
  }, []);

  const resumeTaskSession = useCallback(async (roadmapId: string, nodeId: string, taskId: string) => {
    const updated = await api.resumeTaskSession(roadmapId, nodeId, taskId);
    setRoadmaps(prev => prev.map(rm => (rm.id === roadmapId ? updated : rm)));
  }, []);

  const value = useMemo<AppState>(
    () => ({
      roadmaps,
      assessments,
      user,
      stats,
      activity,
      activeRoadmapId,
      loading,
      error,
      setActiveRoadmapId,
      updateNodeStatus,
      updateAssessmentScore,
      addRoadmap,
      refresh: loadAll,
      startTaskSession,
      extendTaskSession,
      pauseTaskSession,
      resumeTaskSession,
      dismissedTaskIds,
      dismissTask,
      undismissTask,
    }),
    [
      roadmaps,
      assessments,
      user,
      stats,
      activity,
      activeRoadmapId,
      loading,
      error,
      updateNodeStatus,
      updateAssessmentScore,
      addRoadmap,
      loadAll,
      startTaskSession,
      extendTaskSession,
      pauseTaskSession,
      resumeTaskSession,
      dismissedTaskIds,
      dismissTask,
      undismissTask,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      {loading && !initialLoaded && (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: 14,
          background: "var(--bg)"
        }}>
          Loading your learning data…
        </div>
      )}
      {!initialLoaded && error && (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 12, padding: 24, fontFamily: "var(--font-body)",
          background: "var(--bg)"
        }}>
          <p style={{ color: "var(--red)", fontSize: 14, textAlign: "center", maxWidth: 420 }}>{error}</p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
            Start the API: <code>cd backend &amp;&amp; uvicorn app.main:app --reload --port 8000</code>
          </p>
          <button
            type="button"
            onClick={() => loadAll()}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 13,
            }}
          >
            Retry
          </button>
        </div>
      )}
      {(initialLoaded || (!loading && !error)) && children}
    </AppContext.Provider>
  );
}

function AppProviderWithClerk({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setAuthTokenGetter(async () => null);
      return;
    }
    setAuthTokenGetter(() => getToken());
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded) {
    return (
      <div style={{
        minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: 14,
      }}>
        Loading…
      </div>
    );
  }

  if (!isSignedIn) {
    return <>{children}</>;
  }

  return <AppProviderInner>{children}</AppProviderInner>;
}

export function AppProvider({ children }: { children: ReactNode }) {
  if (clerkAuthEnabled) {
    return <AppProviderWithClerk>{children}</AppProviderWithClerk>;
  }
  return <AppProviderInner>{children}</AppProviderInner>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
