"use client";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { roadmapPaths } from "@/lib/routes";
import { api } from "@/lib/api";
import { Flame, TrendingUp, BookOpen, CheckCircle2, Clock, Sparkles, ArrowRight, Plus, BarChart3, Play, Pause, Trash2, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";


const activityIcon = (type: string) => {
  switch (type) {
    case "completed": return <CheckCircle2 size={14} color="var(--green)" />;
    case "quiz": return <BarChart3 size={14} color="var(--accent)" />;
    case "new_roadmap": return <BookOpen size={14} color="var(--purple)" />;
    default: return <Plus size={14} color="var(--amber)" />;
  }
};

const formatActivityTimestamp = (timestampStr: string) => {
  if (!timestampStr) return "";
  const date = new Date(timestampStr);
  if (isNaN(date.getTime())) {
    return timestampStr;
  }
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};


export default function DashboardPage() {
  const router = useRouter();
  const { roadmaps, stats, activity, assessments, refresh } = useApp();

  const [showMondayModal, setShowMondayModal] = useState(false);
  const [weeklyCommitment, setWeeklyCommitment] = useState(8);
  const [milestoneNode, setMilestoneNode] = useState<any>(null);
  const [loadingMilestone, setLoadingMilestone] = useState(false);

  // Planner schedule state
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  useEffect(() => {
    const savedGoal = localStorage.getItem("knowway_weekly_goal_hours");
    if (!savedGoal) {
      setShowMondayModal(true);
    } else {
      setWeeklyCommitment(parseInt(savedGoal, 10));
    }

    const findMilestoneNode = async () => {
      const coreNode = roadmaps
        .flatMap(r => r.nodes)
        .find(n => (n.depth === 0 || n.depth === "0" || n.depth === "CoreNode") && n.status === "completed");
      
      if (coreNode) {
        const taken = assessments.some(a => a.nodeId === coreNode.id && a.taskId === "milestone" && a.status === "completed");
        const dismissed = localStorage.getItem(`knowway_milestone_dismissed_${coreNode.id}`);
        if (!taken && !dismissed) {
          const parentRoadmap = roadmaps.find(r => r.nodes.some(n => n.id === coreNode.id));
          if (parentRoadmap) {
            setMilestoneNode({ ...coreNode, roadmapId: parentRoadmap.id });
          }
        }
      }
    };
    findMilestoneNode();
  }, [roadmaps, assessments]);

  // Load planner schedule
  useEffect(() => {
    const loadSchedule = async () => {
      setLoadingSchedule(true);
      try {
        const data = await api.getPlannerSchedule();
        setSchedule(data);
      } catch (e) {
        console.error("Failed to load planner schedule:", e);
      } finally {
        setLoadingSchedule(false);
      }
    };
    loadSchedule();
  }, []);

  const handleCommitWeeklyGoal = () => {
    localStorage.setItem("knowway_weekly_goal_hours", weeklyCommitment.toString());
    setShowMondayModal(false);
  };

  const handleLaunchMilestoneQuiz = async () => {
    if (!milestoneNode) return;
    setLoadingMilestone(true);
    try {
      const quiz = await api.generateQuiz(milestoneNode.roadmapId, milestoneNode.id, "milestone");
      if (refresh) await refresh();
      router.push(`/assessment?id=${quiz.id}`);
    } catch (e) {
      console.error("Failed to generate milestone quiz:", e);
    } finally {
      setLoadingMilestone(false);
    }
  };

  const handleDismissMilestone = () => {
    if (milestoneNode) {
      localStorage.setItem(`knowway_milestone_dismissed_${milestoneNode.id}`, "true");
      setMilestoneNode(null);
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent, id: string, currentStatus: string) => {
    e.stopPropagation();
    e.preventDefault();
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    try {
      await api.updateRoadmapStatus(id, nextStatus);
      if (refresh) await refresh();
    } catch (err: any) {
      alert(err.message || "Failed to update roadmap status.");
    }
  };

  const handleDeleteRoadmap = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this roadmap? This action cannot be undone.")) {
      return;
    }
    try {
      await api.deleteRoadmap(id);
      if (refresh) await refresh();
    } catch (err: any) {
      alert(err.message || "Failed to delete roadmap.");
    }
  };

  // Sort: active first, then paused/completed, sorted by date desc, limited to 4
  const sortedRoadmaps = useMemo(() => {
    const list = [...roadmaps];
    list.sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (a.status !== "active" && b.status === "active") return 1;
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });
    return list.slice(0, 4);
  }, [roadmaps]);

  // Combine assessments and in-progress tasks
  const assessmentsAndTasks = useMemo(() => {
    const items: { id: string; name: string; score?: number; status: "completed" | "failed" | "in_progress" | "pending"; updatedAt: number }[] = [];

    // 1. Add all assessments (completed, failed, pending)
    assessments.forEach(a => {
      items.push({
        id: a.id,
        name: a.nodeTitle,
        score: a.score,
        status: a.status === "completed" ? "completed" : a.status === "failed" ? "failed" : "pending",
        updatedAt: new Date(a.completedAt || a.createdAt || Date.now()).getTime()
      });
    });

    // 2. Add tasks that are in progress but don't have assessments yet
    roadmaps.forEach(rm => {
      rm.nodes.forEach(node => {
        node.tasks?.forEach(task => {
          if (task.sessionStartedAt && !task.completed) {
            const hasAssessment = assessments.some(a => a.taskId === task.id);
            if (!hasAssessment) {
              items.push({
                id: task.id,
                name: `${node.title}: ${task.name}`,
                status: "in_progress",
                updatedAt: new Date(task.sessionStartedAt).getTime()
              });
            }
          }
        });
      });
    });

    // Sort: in progress tasks first, then the rest by updatedAt descending
    items.sort((a, b) => {
      const aProgress = a.status === "in_progress";
      const bProgress = b.status === "in_progress";
      if (aProgress && !bProgress) return -1;
      if (!aProgress && bProgress) return 1;
      return b.updatedAt - a.updatedAt;
    });
    return items.slice(0, 10);
  }, [assessments, roadmaps]);

  const statCards = [
    { label: "Active roadmaps", value: stats?.activeRoadmaps ?? 0, hint: `${roadmaps.length} total`, icon: <BookOpen size={16} color="var(--text-muted)" /> },
    { label: "Nodes completed", value: stats?.nodesCompleted ?? 0, hint: "Across all paths", icon: <CheckCircle2 size={16} color="var(--green)" /> },
    { label: "Avg confidence", value: `${stats?.avgConfidence ?? 0}%`, hint: "Across all topics", icon: <TrendingUp size={16} color="var(--accent)" /> },
    { label: "Day streak", value: stats?.streak ?? 0, hint: "Days active", icon: <Flame size={16} color="var(--amber)" /> },
  ];

  return (
    <div className="fade-up" style={{ padding: "20px 24px", maxWidth: "100%" }}>
      {/* Monday Check-in Modal */}
      {showMondayModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)"
        }}>
          <div className="scale-in" style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", padding: "24px 28px",
            width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 16,
            boxShadow: "var(--shadow-card)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={16} color="var(--accent)" />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Monday Check-in</h2>
            </div>
            
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45, margin: 0 }}>
              Set your study target for this week. How many hours are you aiming to spend learning across all active roadmaps?
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)" }}>Weekly Study Target</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>{weeklyCommitment} hours</span>
              </div>
              <input 
                type="range" 
                min="2" 
                max="25" 
                value={weeklyCommitment} 
                onChange={e => setWeeklyCommitment(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "var(--accent)" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
                <span>2 hours</span>
                <span>25 hours</span>
              </div>
            </div>

            <button
              onClick={handleCommitWeeklyGoal}
              style={{
                background: "var(--accent)", color: "#fff", border: "none",
                borderRadius: "var(--radius-md)", padding: "10px",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                boxShadow: "0 2px 6px rgba(232,82,10,0.2)",
                transition: "opacity 0.15s"
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              Commit to this week
            </button>
          </div>
        </div>
      )}

      {/* Milestone Splash Banner */}
      {milestoneNode && (
        <div className="fade-down" style={{
          background: "linear-gradient(135deg, var(--accent-light) 0%, rgba(168,85,247,0.08) 100%)",
          border: "1px solid var(--accent)",
          borderRadius: "var(--radius-lg)",
          padding: "16px 20px",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase" }}>Milestone Quiz</span>
              <span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontWeight: 500 }}>Optional Challenge</span>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px 0" }}>
              Validate your mastery in {milestoneNode.title}!
            </h3>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.35, margin: 0 }}>
              You've completed all tasks under Know-Way core concept. Challenge yourself with a milestone quiz.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={handleDismissMilestone}
              style={{
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)", padding: "8px 12px",
                fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)", cursor: "pointer"
              }}
            >
              Maybe Later
            </button>
            <button
              onClick={handleLaunchMilestoneQuiz}
              disabled={loadingMilestone}
              style={{
                background: "var(--accent)", color: "#fff", border: "none",
                borderRadius: "var(--radius-md)", padding: "8px 16px",
                fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                boxShadow: "0 2px 6px rgba(232,82,10,0.15)"
              }}
            >
              {loadingMilestone ? (
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Sparkles size={13} fill="#fff" />
              )}
              Start quiz
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: 4 }}>
            My Workspace
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Overview of your current learning paths and active study sessions
          </p>
        </div>
        <button
          onClick={() => {
            const activeCount = roadmaps.filter(r => r.status === "active").length;
            if (activeCount >= 3) {
              alert("You have reached the limit of 3 active roadmaps. Please pause or delete an existing roadmap before creating a new one.");
            } else {
              router.push(roadmapPaths.new);
            }
          }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: "var(--radius-md)",
            background: "var(--accent)", color: "#fff",
            border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 500,
            textDecoration: "none", fontFamily: "var(--font-body)",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <Plus size={14} /> New roadmap
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {statCards.map(s => (
          <div key={s.label} style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", padding: "12px 16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>
              {s.icon}
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{s.value}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{s.hint}</div>
          </div>
        ))}
      </div>

      {/* 2-Column Split Dashboard Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 0.65fr", gap: 16, alignItems: "start" }}>
        {/* Left Column: Roadmaps list */}
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "16px 18px",
          boxShadow: "var(--shadow-sm)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>My roadmaps</span>
            <button onClick={() => router.push("/roadmap")} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: "var(--accent)", fontSize: 11.5, cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 600 }}>
              View all <ArrowRight size={11} />
            </button>
          </div>

          {sortedRoadmaps.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 12.5 }}>
              No roadmaps created yet. Click "New roadmap" above to start!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sortedRoadmaps.map((rm, i) => {
                const total = rm.nodes.length;
                const done = rm.nodes.filter(n => n.status === "completed").length;
                const pct = Math.round((done / total) * 100);
                const colors = ["var(--accent)", "var(--purple)", "var(--teal)"];
                const c = colors[i % colors.length];

                // Filter upcoming uncompleted planner tasks for this roadmap
                const roadmapTasks = schedule
                  .filter(item => item.roadmapId === rm.id && !item.completed)
                  .sort((a, b) => {
                    if (a.date && !b.date) return -1;
                    if (!a.date && b.date) return 1;
                    if (a.date && b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
                    return 0;
                  });
                const displayedTasks = roadmapTasks.slice(0, 3);

                return (
                  <div
                    key={rm.id}
                    style={{
                      padding: "12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                      background: rm.status === "active" ? "transparent" : "var(--bg-surface)",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div
                      onClick={() => router.push(`/roadmap/${rm.id}`)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: `${c}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <BookOpen size={14} color={c} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rm.topic}</span>
                          <span style={{
                            fontSize: 8.5, padding: "1px 4px", borderRadius: 6,
                            background: rm.status === "active" ? "var(--accent-dim)" : "var(--border)",
                            color: rm.status === "active" ? "var(--accent)" : "var(--text-secondary)",
                            fontWeight: 600, textTransform: "uppercase"
                          }}>
                            {rm.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{done} of {total} nodes complete</div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 10 }}>
                        <button
                          onClick={(e) => handleToggleStatus(e, rm.id, rm.status)}
                          title={rm.status === "active" ? "Pause Roadmap" : "Activate Roadmap"}
                          style={{
                            padding: "3px 5px", borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border)", background: rm.status === "active" ? "transparent" : "var(--bg-card)",
                            color: rm.status === "active" ? "var(--amber)" : "var(--green)", cursor: "pointer",
                            display: "flex", alignItems: "center"
                          }}
                        >
                          {rm.status === "active" ? <Pause size={10} /> : <Play size={10} />}
                        </button>
                        <button
                          onClick={(e) => handleDeleteRoadmap(e, rm.id)}
                          title="Delete Roadmap"
                          style={{
                            padding: "3px 5px", borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border)", background: rm.status === "active" ? "transparent" : "var(--bg-card)",
                            color: "var(--red)", cursor: "pointer",
                            display: "flex", alignItems: "center"
                          }}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>

                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: c, marginBottom: 4 }}>{pct}%</div>
                        <div style={{ width: 70, height: 3, background: "var(--border)", borderRadius: 1.5 }}>
                          <div style={{ width: `${pct}%`, height: 3, background: c, borderRadius: 1.5, transition: "width 0.4s ease" }} />
                        </div>
                      </div>
                    </div>

                    {/* Nested Tasks for Active Roadmaps */}
                    {rm.status === "active" && (
                      <div style={{
                        marginTop: 10,
                        marginLeft: 46,
                        paddingLeft: 10,
                        borderLeft: "2px solid var(--border)",
                      }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                          <Clock size={10} /> Up Next
                        </div>
                        
                        {loadingSchedule ? (
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Loading schedule...</div>
                        ) : displayedTasks.length === 0 ? (
                          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                            No upcoming tasks scheduled.
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {displayedTasks.map(t => (
                              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5 }}>
                                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                                  {t.title}
                                </span>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                                    {t.durationMins}m
                                  </span>
                                  {t.date && (
                                    <span style={{
                                      fontSize: 9,
                                      padding: "0.5px 4px",
                                      borderRadius: 4,
                                      background: "var(--accent-dim)",
                                      color: "var(--accent)",
                                      fontWeight: 600
                                    }}>
                                      {t.date}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                            {roadmapTasks.length > 3 && (
                              <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontStyle: "italic", marginTop: 2 }}>
                                + {roadmapTasks.length - 3} more tasks.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Activity and Assessments & Tasks stacked vertically */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Recent Activity */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px 18px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
              <Clock size={12} color="var(--text-muted)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Recent activity</span>
            </div>
            {activity.length === 0 ? (
              <div style={{ padding: "12px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 12.5 }}>
                No recent activity recorded.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {activity.map((a, i) => (
                  <div key={a.id} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: i < activity.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ marginTop: 2, flexShrink: 0 }}>{activityIcon(a.type)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>{a.label}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                        {formatActivityTimestamp(a.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assessments & Tasks */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px 18px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
              <BarChart3 size={12} color="var(--text-muted)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Assessments & Tasks</span>
            </div>
            {assessmentsAndTasks.length === 0 ? (
              <div style={{ padding: "12px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 12.5 }}>
                No active or completed items.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {assessmentsAndTasks.map((item, i) => (
                  <div
                    key={item.id}
                    onClick={() => router.push(item.status === "in_progress" ? "/roadmap" : "/assessment")}
                    style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: i < assessmentsAndTasks.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer" }}
                  >
                    <div style={{ flex: 1, fontSize: 12, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>{item.name}</div>
                    
                    {item.status === "completed" && item.score !== undefined ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", flexShrink: 0 }}>{item.score}%</span>
                    ) : item.status === "failed" && item.score !== undefined ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--red)", flexShrink: 0 }}>{item.score}%</span>
                    ) : item.status === "pending" ? (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: "var(--amber-dim)", color: "var(--amber)", fontWeight: 600, flexShrink: 0 }}>pending</span>
                    ) : (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 600, flexShrink: 0 }}>in progress</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
