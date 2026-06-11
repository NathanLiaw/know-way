"use client";
import { RoadmapNode, Roadmap } from "@/lib/types";
import { useApp } from "@/lib/app-context";
import { 
  X, Video, FileText, BookOpen, GraduationCap, Play, Loader2, Search,
  MessageSquare, Send, AlertCircle, CheckCircle, GitFork, ChevronDown, ChevronUp
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { createPortal } from "react-dom";

const resourceIcon = {
  video:         <Video size={14} color="var(--accent)" />,
  article:       <FileText size={14} color="var(--purple)" />,
  course:        <GraduationCap size={14} color="var(--teal)" />,
  book:          <BookOpen size={14} color="var(--amber)" />,
  documentation: <FileText size={14} color="var(--blue)" />,
  interactive:   <Play size={14} color="var(--green)" />,
};

// Inline helper for markdown parsing
function renderMarkdown(text: string) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];
  
  const parseBold = (str: string): React.ReactNode[] => {
    const parts = str.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} style={{ fontWeight: "700" }}>{part}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      const content = trimmed.substring(2);
      listItems.push(<li key={idx} style={{ marginBottom: 4 }}>{parseBold(content)}</li>);
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      const content = trimmed.replace(/^\d+\.\s/, "");
      listItems.push(<li key={idx} style={{ marginBottom: 4 }}>{parseBold(content)}</li>);
    } else {
      if (inList) {
        elements.push(
          <ul key={`list-${idx}`} style={{ margin: "0 0 10px 0", paddingLeft: 20 }}>
            {listItems}
          </ul>
        );
        inList = false;
      }
      if (trimmed === "") {
        elements.push(<div key={`br-${idx}`} style={{ height: 8 }} />);
      } else {
        elements.push(<p key={idx} style={{ margin: "0 0 8px 0", lineHeight: 1.5 }}>{parseBold(line)}</p>);
      }
    }
  });
  if (inList) {
    elements.push(
      <ul key="list-end" style={{ margin: "0 0 10px 0", paddingLeft: 20 }}>
        {listItems}
      </ul>
    );
  }
  return <>{elements}</>;
}

interface Props { node: RoadmapNode; roadmap: Roadmap; onClose: () => void; onTakeQuiz?: (nodeId: string) => void; onSelectNode?: (nodeId: string) => void; }

export default function NodePanel({ node, roadmap, onClose, onTakeQuiz, onSelectNode }: Props) {
  const router = useRouter();
  const { updateNodeStatus, refresh, startTaskSession, extendTaskSession, assessments, undismissTask } = useApp();
  const [loadingEnrich, setLoadingEnrich] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [enrichStep, setEnrichStep] = useState(0);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, any[]>>({});
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [loadingChatHistory, setLoadingChatHistory] = useState<Record<string, boolean>>({});
  const [timeRemaining, setTimeRemaining] = useState<Record<string, number>>({});
  const [loadingFork, setLoadingFork] = useState(false);
  const [selectedReviewAssessment, setSelectedReviewAssessment] = useState<any | null>(null);
  const [reviewChatMessages, setReviewChatMessages] = useState<any[]>([]);
  const [loadingReviewChat, setLoadingReviewChat] = useState(false);

  useEffect(() => {
    if (selectedReviewAssessment && selectedReviewAssessment.taskId) {
      setLoadingReviewChat(true);
      api.getTaskSession(selectedReviewAssessment.roadmapId, selectedReviewAssessment.nodeId, selectedReviewAssessment.taskId)
        .then(resp => {
          setReviewChatMessages(resp.messages || []);
        })
        .catch(err => {
          console.error("Failed to load review chat:", err);
          setReviewChatMessages([]);
        })
        .finally(() => {
          setLoadingReviewChat(false);
        });
    } else {
      setReviewChatMessages([]);
    }
  }, [selectedReviewAssessment]);

  const isUnenriched = (node.status === "unlocked" || node.status === "in_progress") &&
    (!node.resources || node.resources.length === 0) &&
    (!node.tasks || node.tasks.length === 0);

  const skillCheckNode = roadmap.nodes.find(n => n.parent === node.id && n.isSkillCheck);
  const isOnboardingCompleted = node.status === "completed" && !node.isSkillCheck;

  // Countdown timers updater
  useEffect(() => {
    const updateTimers = () => {
      const next: Record<string, number> = {};
      node.tasks?.forEach(t => {
        if (t.sessionStartedAt && !t.completed) {
          const started = new Date(t.sessionStartedAt).getTime();
          const durationMins = t.sessionDurationMins ?? t.durationMins ?? 30;
          const extendedMins = t.sessionExtendedMins ?? 0;
          const totalDurationMs = (durationMins + extendedMins) * 60 * 1000;
          const elapsedMs = Date.now() - started;
          const remainSecs = Math.max(0, Math.ceil((totalDurationMs - elapsedMs) / 1000));
          next[t.id] = remainSecs;
        }
      });
      setTimeRemaining(next);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [node.tasks]);

  const handleStartTaskSession = async (taskId: string) => {
    try {
      await startTaskSession(roadmap.id, node.id, taskId);
    } catch (e) {
      console.error("Failed to start task session:", e);
    }
  };

  const handleExtendTaskSession = async (taskId: string) => {
    try {
      await extendTaskSession(roadmap.id, node.id, taskId);
    } catch (e) {
      console.error("Failed to extend task session:", e);
    }
  };

  const toggleTutorChat = async (taskId: string) => {
    if (activeTaskId === taskId) {
      setActiveTaskId(null);
      return;
    }
    setActiveTaskId(taskId);
    if (!chatMessages[taskId]) {
      setLoadingChatHistory(prev => ({ ...prev, [taskId]: true }));
      try {
        const resp = await api.getTaskSession(roadmap.id, node.id, taskId);
        setChatMessages(prev => ({ ...prev, [taskId]: resp.messages || [] }));
      } catch (e) {
        console.error("Failed to load chat history:", e);
      } finally {
        setLoadingChatHistory(prev => ({ ...prev, [taskId]: false }));
      }
    }
  };

  const handleSendChatMessage = async (taskId: string) => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput("");
    const userMsg = { role: "user", content: msg, timestamp: new Date().toISOString() };
    setChatMessages(prev => ({
      ...prev,
      [taskId]: [...(prev[taskId] || []), userMsg]
    }));
    setSendingChat(true);
    try {
      const resp = await api.chatTaskSession(roadmap.id, node.id, taskId, msg);
      const assistantMsg = { role: "assistant", content: resp.response, timestamp: new Date().toISOString() };
      setChatMessages(prev => ({
        ...prev,
        [taskId]: [...(prev[taskId] || []), assistantMsg]
      }));
    } catch (e) {
      console.error("Failed to send chat message:", e);
    } finally {
      setSendingChat(false);
    }
  };

  const handleTakeTaskQuiz = async (taskId: string) => {
    setLoadingQuiz(true);
    try {
      const quiz = await api.generateQuiz(roadmap.id, node.id, taskId);
      await refresh();
      router.push(`/assessment?id=${quiz.id}`);
    } catch (e) {
      console.error("Failed to generate task quiz:", e);
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleForkNode = async () => {
    setLoadingFork(true);
    try {
      await api.forkNode(roadmap.id, node.id);
      await refresh();
    } catch (e) {
      console.error("Failed to fork node:", e);
    } finally {
      setLoadingFork(false);
    }
  };

  const handleRetakeAssessmentDirectly = async (taskId: string) => {
    try {
      await startTaskSession(roadmap.id, node.id, taskId);
      const quiz = await api.generateQuiz(roadmap.id, node.id, taskId, true);
      undismissTask(taskId);
      await refresh();
      router.push(`/assessment?id=${quiz.id}`);
    } catch (e) {
      console.error("Failed to retake assessment directly:", e);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const markInProgress = async () => {
    setLoadingEnrich(true);
    setEnrichStep(0);
    const interval = setInterval(() => {
      setEnrichStep(prev => (prev < 2 ? prev + 1 : prev));
    }, 2500);

    try {
      await updateNodeStatus(roadmap.id, node.id, "in_progress");
    } catch (e) {
      console.error("Failed to start learning:", e);
    } finally {
      clearInterval(interval);
      setLoadingEnrich(false);
    }
  };

  const manuallyEnrich = async () => {
    setLoadingEnrich(true);
    setEnrichStep(0);
    const interval = setInterval(() => {
      setEnrichStep(prev => (prev < 2 ? prev + 1 : prev));
    }, 2500);

    try {
      await api.enrichNode(roadmap.id, node.id);
      await refresh();
    } catch (e) {
      console.error("Failed to curate resources:", e);
    } finally {
      clearInterval(interval);
      setLoadingEnrich(false);
    }
  };

  return (
    <div className="slide-in-right" style={{
      width: 350, background: "var(--bg-card)",
      borderLeft: "1px solid var(--border)",
      height: "100%", overflowY: "auto",
      padding: "24px 22px",
      display: "flex", flexDirection: "column", gap: 20,
      flexShrink: 0,
      boxShadow: "-4px 0 20px rgba(80,50,10,0.06)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, paddingRight: 10 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
            {roadmap.topic} {node.isOptionalFork && <span style={{ color: "var(--accent)" }}>(Deep Dive)</span>}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.3, fontFamily: "var(--font-display)" }}>{node.title}</h2>
        </div>
        <button onClick={onClose} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-muted)", padding: "5px 7px", display: "flex", alignItems: "center" }}>
          <X size={15} />
        </button>
      </div>

      {/* Description */}
      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>{node.description}</p>

      {/* Confidence score — read only indicator for completed nodes */}
      {node.status === "completed" && (
        <>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Confidence Score</span>
              <span style={{
                fontSize: 15, fontWeight: 700,
                color: "var(--green)",
              }}>{node.confidence}%</span>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0 0 0" }}>
              {isOnboardingCompleted ? "Onboarding self-evaluation (Pending verification)" : "✓ Verified via Inquisitor Assessment"}
            </p>
          </div>

          {node.summary && node.summary.length > 0 && (
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>💡 What You Learnt</div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 6 }}>
                {node.summary.map((bullet, idx) => (
                  <li key={idx}>{bullet}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Onboarding Mastered Node Card */}
          {isOnboardingCompleted && (
            <div style={{
              background: "linear-gradient(135deg, rgba(232, 82, 10, 0.08) 0%, rgba(240, 128, 64, 0.03) 100%)",
              border: "1.5px solid var(--accent-dim)",
              borderRadius: "var(--radius-lg)",
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              boxShadow: "0 4px 15px rgba(232, 82, 10, 0.05)",
              animation: "fadeIn 0.25s ease-out"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>🎓</span>
                <strong style={{ fontSize: 14, color: "var(--accent)", fontWeight: 600 }}>Concept Already Mastered</strong>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                You marked this concept as completed during onboarding. To verify your knowledge and unlock downstream nodes, please complete the associated Skill Check node.
              </p>
              {skillCheckNode ? (
                <button
                  onClick={() => onSelectNode && onSelectNode(skillCheckNode.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    background: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "opacity 0.15s, transform 0.15s",
                    boxShadow: "0 2px 8px rgba(232, 82, 10, 0.2)",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.opacity = "0.9";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  Go to Skill Check
                </button>
              ) : (
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>
                  Note: Associated Skill Check node not found.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Resources */}
      {!isOnboardingCompleted && !node.isSkillCheck && (
        isUnenriched ? (
          <div style={{
            padding: "40px 20px",
            borderRadius: "var(--radius-md)",
            border: "1px dashed var(--border)",
            background: "var(--bg-surface)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            textAlign: "center"
          }}>
            <Loader2 size={32} color="var(--accent)" style={{ animation: "spin 1.5s linear infinite" }} />
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 4 }}>
                Generating learning materials...
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
                The background agent is curating resources and custom tasks. Please wait.
              </span>
            </div>
          </div>
        ) : loadingEnrich ? (
          <div style={{
            padding: "20px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Loader2 size={16} color="var(--accent)" style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Curating Learning Bundle...</span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Librarian is querying Google Search...", stage: 0 },
                { label: "Resource Curator is parsing matched links...", stage: 1 },
                { label: "Teaching Assistant is compiling tasks...", stage: 2 }
              ].map((item, idx) => {
                const active = enrichStep >= item.stage;
                const done = enrichStep > item.stage;
                return (
                  <div key={idx} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 12, color: active ? "var(--text-secondary)" : "var(--text-muted)",
                    transition: "color 0.3s"
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: done ? "var(--green)" : active ? "var(--accent)" : "var(--border)",
                      transition: "background 0.3s"
                    }} />
                    <span style={{ fontWeight: active ? 500 : 400 }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : node.resources && node.resources.length > 0 ? (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Resources</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {node.resources.map(r => (
                <div
                  key={r.id}
                  onClick={() => window.open(r.url, '_blank')}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: "var(--radius-md)",
                    background: "var(--bg-surface)", border: "1px solid var(--border)",
                    textAlign: "left", cursor: "pointer", transition: "all 0.15s",
                    fontFamily: "var(--font-body)", width: "100%",
                    position: "relative",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.background = "var(--accent-light)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)"; }}
                >
                  <div style={{ flexShrink: 0 }}>{resourceIcon[r.type]}</div>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 24 }}>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                    {r.why && (
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, fontStyle: "italic", lineHeight: 1.3 }}>
                        {r.why}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{r.website}</div>
                  </div>
                  
                  <button
                    title="Search on Google"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://www.google.com/search?q=${encodeURIComponent(r.title)}`, '_blank');
                    }}
                    style={{
                      position: "absolute",
                      right: 10,
                      bottom: 10,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 4,
                      borderRadius: "var(--radius-sm)",
                      transition: "color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <Search size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}

      {/* Practical Tasks */}
      {!isOnboardingCompleted && node.tasks && node.tasks.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Practical Tasks</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {node.tasks.map(t => {
              const secondsLeft = timeRemaining[t.id] ?? 0;
              const isSessionActive = t.sessionStartedAt !== null && t.sessionStartedAt !== undefined;
              const isTimerRunning = secondsLeft > 0;
              const isCompleted = t.completed;
              const isChatOpen = activeTaskId === t.id;

              return (
                <div key={t.id} style={{
                  padding: "14px 16px", borderRadius: "var(--radius-md)",
                  background: isSessionActive && !isCompleted ? "linear-gradient(135deg, rgba(232,82,10,0.04), rgba(212,134,10,0.04))" : isCompleted ? "var(--bg-surface)" : "var(--bg-card)",
                  border: isSessionActive && !isCompleted ? "2px solid var(--accent)" : "1px solid var(--border)",
                  display: "flex", flexDirection: "column", gap: 10,
                  transition: "all 0.2s ease"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textDecoration: isCompleted ? "line-through" : "none" }}>{t.name}</span>
                        {isSessionActive && !isCompleted && (
                          <span className="pulse" style={{
                            fontSize: 9,
                            padding: "2px 6px",
                            borderRadius: 8,
                            fontWeight: 600,
                            background: "var(--accent-dim)",
                            color: "var(--accent)"
                          }}>
                            In Progress
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{t.description}</span>
                    </div>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 12, fontWeight: 600,
                      background: t.difficulty === "stretch" ? "var(--purple-dim)" : t.difficulty === "applied" ? "var(--accent-dim)" : "var(--green-dim)",
                      color: t.difficulty === "stretch" ? "var(--purple)" : t.difficulty === "applied" ? "var(--accent)" : "var(--green)",
                      textTransform: "capitalize", flexShrink: 0
                    }}>{t.difficulty}</span>
                  </div>

                  <div style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", gap: 12 }}>
                    <span>Type: <strong style={{ textTransform: "capitalize" }}>{t.type}</strong></span>
                    <span>Est. Time: <strong>{t.durationMins} mins</strong></span>
                  </div>

                  {/* Task session actions */}
                  {node.status !== "locked" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      {isCompleted ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--green)", display: "flex", alignItems: "center", gap: 4 }}>
                            <CheckCircle size={14} /> Task Completed {(() => {
                              const score = assessments.find(a => a.roadmapId === roadmap.id && a.nodeId === node.id && a.taskId === t.id && a.status === "completed")?.score;
                              return score !== undefined ? `(${score}%)` : "";
                            })()}
                          </span>
                          {(() => {
                            const taskAss = assessments.find(a => a.roadmapId === roadmap.id && a.nodeId === node.id && a.taskId === t.id && a.status === "completed");
                            return taskAss ? (
                              <button
                                onClick={() => setSelectedReviewAssessment(taskAss)}
                                style={{
                                  background: "transparent", border: "1px solid var(--border)",
                                  borderRadius: "var(--radius-sm)", padding: "4px 8px",
                                  fontSize: 11, color: "var(--text-secondary)", cursor: "pointer",
                                  transition: "all 0.15s"
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.borderColor = "var(--accent)";
                                  e.currentTarget.style.color = "var(--accent)";
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.borderColor = "var(--border)";
                                  e.currentTarget.style.color = "var(--text-secondary)";
                                }}
                              >
                                Review Assessment
                              </button>
                            ) : null;
                          })()}
                        </div>
                      ) : (t.status === "failed" || assessments.some(a => a.roadmapId === roadmap.id && a.nodeId === node.id && a.taskId === t.id && a.status === "failed")) ? (
                        (() => {
                          const failedAss = assessments.find(a => a.roadmapId === roadmap.id && a.nodeId === node.id && a.taskId === t.id && a.status === "failed");
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--red)", display: "flex", alignItems: "center", gap: 4 }}>
                                <AlertCircle size={14} /> Assessment Failed {failedAss?.score !== undefined ? `(${failedAss.score}%)` : ""}
                              </span>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                  onClick={() => handleRetakeAssessmentDirectly(t.id)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    background: "var(--red)", color: "#fff", border: "none",
                                    borderRadius: "var(--radius-sm)", padding: "6px 12px",
                                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                                    transition: "opacity 0.15s"
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
                                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                                >
                                  Retake Assessment
                                </button>
                                {failedAss && (
                                  <button
                                    onClick={() => setSelectedReviewAssessment(failedAss)}
                                    style={{
                                      background: "transparent", border: "1px solid var(--border)",
                                      borderRadius: "var(--radius-sm)", padding: "4px 8px",
                                      fontSize: 11, color: "var(--text-secondary)", cursor: "pointer",
                                      transition: "all 0.15s"
                                    }}
                                    onMouseEnter={e => {
                                      e.currentTarget.style.borderColor = "var(--accent)";
                                      e.currentTarget.style.color = "var(--accent)";
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.borderColor = "var(--border)";
                                      e.currentTarget.style.color = "var(--text-secondary)";
                                    }}
                                  >
                                    Review Assessment
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()
                      ) : !isSessionActive ? (
                        <button 
                          onClick={() => node.isSkillCheck ? handleRetakeAssessmentDirectly(t.id) : handleStartTaskSession(t.id)} 
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            background: "var(--accent)", color: "#fff", border: "none",
                            borderRadius: "var(--radius-sm)", padding: "6px 12px",
                            fontSize: 12, fontWeight: 500, cursor: "pointer",
                            transition: "opacity 0.15s"
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
                          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                        >
                          <Play size={10} fill="#fff" /> {node.isSkillCheck ? "Take Assessment" : "Begin Study Session"}
                        </button>
                      ) : (
                        <button 
                          onClick={() => undismissTask(t.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            background: "var(--accent)", color: "#fff", border: "none",
                            borderRadius: "var(--radius-sm)", padding: "6px 12px",
                            fontSize: 12, fontWeight: 600, cursor: "pointer",
                            transition: "opacity 0.15s"
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
                          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                        >
                          <Play size={10} fill="#fff" /> Resume Session
                        </button>
                      )}
                    </div>
                  )}

                  {/* Expanding Chat Widget */}
                  {isChatOpen && (
                    <div style={{
                      marginTop: 8,
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-card)",
                      display: "flex",
                      flexDirection: "column",
                      height: 250,
                      overflow: "hidden"
                    }}>
                      <div style={{ background: "var(--bg-surface)", padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                        <span>Study Tutor Agent</span>
                        {sendingChat && <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />}
                      </div>

                      {/* Chat Messages */}
                      <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        {loadingChatHistory[t.id] ? (
                          <div style={{ color: "var(--text-muted)", fontSize: 11, textAlign: "center", padding: 20 }}>
                            Loading session log...
                          </div>
                        ) : (chatMessages[t.id] || []).length === 0 ? (
                          <div style={{ color: "var(--text-muted)", fontSize: 11, textAlign: "center", padding: 20 }}>
                            Ask a question about this task to get started!
                          </div>
                        ) : (
                          (chatMessages[t.id] || []).map((m, idx) => {
                            const isUser = m.role === "user";
                            return (
                              <div key={idx} style={{
                                alignSelf: isUser ? "flex-end" : "flex-start",
                                background: isUser ? "var(--accent)" : "var(--bg-surface)",
                                color: isUser ? "#fff" : "var(--text-primary)",
                                padding: "6px 10px",
                                borderRadius: isUser ? "10px 10px 0 10px" : "10px 10px 10px 0",
                                fontSize: 12,
                                maxWidth: "85%",
                                lineHeight: 1.4,
                                wordBreak: "break-word"
                              }}>
                                {m.content}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Chat Input */}
                      <div style={{ display: "flex", borderTop: "1px solid var(--border)", padding: 4, background: "var(--bg-surface)" }}>
                        <input
                          type="text"
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleSendChatMessage(t.id); }}
                          placeholder="Ask study assistant..."
                          disabled={sendingChat}
                          style={{
                            flex: 1, background: "transparent", border: "none", outline: "none",
                            fontSize: 12, color: "var(--text-primary)", padding: "4px 8px"
                          }}
                        />
                        <button
                          onClick={() => handleSendChatMessage(t.id)}
                          disabled={sendingChat || !chatInput.trim()}
                          style={{
                            background: "transparent", border: "none", cursor: "pointer",
                            color: "var(--accent)", display: "flex", alignItems: "center", padding: 4
                          }}
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      {!isOnboardingCompleted && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", paddingTop: 8 }}>
          {!isUnenriched && node.status === "unlocked" && (!node.tasks || node.tasks.length === 0) && (
            <button onClick={markInProgress} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px", borderRadius: "var(--radius-md)",
              background: "var(--accent)", border: "none", color: "#fff",
              fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%",
              boxShadow: "0 2px 8px rgba(232,82,10,0.3)", transition: "opacity 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              <Play size={14} fill="#fff" /> Start learning / Curate Tasks
            </button>
          )}

          {(node.status === "in_progress" || node.status === "completed") && (
            <>
              <button 
                onClick={handleForkNode} 
                disabled={loadingFork} 
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px", borderRadius: "var(--radius-md)",
                  background: "var(--bg-surface)", border: "1px solid var(--border)",
                  color: "var(--text-primary)", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.background = "var(--accent-light)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)"; }}
              >
                {loadingFork ? (
                  <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Generating optional deep dive...</>
                ) : (
                  <><GitFork size={14} /> Fork Concept (Add Deep Dive)</>
                )}
              </button>

              <button onClick={manuallyEnrich} disabled={loadingEnrich} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px", borderRadius: "var(--radius-md)",
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                color: "var(--text-secondary)", fontSize: 13, fontWeight: 500, cursor: "pointer", width: "100%",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
              >
                {loadingEnrich ? (
                  <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Curating resources...</>
                ) : (
                  <>Find / refresh resources</>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Review Modal */}
      {selectedReviewAssessment && typeof window !== "undefined" && createPortal(
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "var(--bg-card)",
          display: "flex",
          zIndex: 9999,
          color: "var(--text-primary)",
          fontFamily: "var(--font-body)",
          animation: "fadeIn 0.2s ease"
        }}>
          <div style={{
            width: "100%",
            height: "100%",
            background: "var(--bg-card)",
            display: "flex",
            overflow: "hidden",
            position: "relative",
          }}>
            {/* Close ("X") button */}
            <button
              onClick={() => setSelectedReviewAssessment(null)}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
                cursor: "pointer",
                zIndex: 99,
                transition: "all 0.15s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.color = "var(--accent)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              <X size={16} />
            </button>

            {/* Left Column: Assessment Details & Resources */}
            <div style={{
              flex: 1.3,
              borderRight: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              padding: "40px",
              overflowY: "auto",
              background: "linear-gradient(to bottom, var(--bg-card), var(--bg-surface))"
            }}>
              {/* Header */}
              <div style={{ marginBottom: 32 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  display: "block",
                  marginBottom: 6
                }}>
                  {roadmap.topic} &bull; {node.title}
                </span>
                <h2 style={{
                  fontSize: 26,
                  fontFamily: "var(--font-display)",
                  fontWeight: 400,
                  lineHeight: 1.2,
                  marginBottom: 10
                }}>
                  Reviewing: {selectedReviewAssessment.nodeTitle}
                </h2>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8 }}>
                  Score: <strong style={{ color: "var(--green)", fontSize: 16 }}>{selectedReviewAssessment.score}%</strong> (Passing Score: {selectedReviewAssessment.passingScore}%)
                </div>
              </div>

              {/* Node Resources used for this task */}
              {node.resources && node.resources.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <BookOpen size={16} /> Curated Resources
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                    {node.resources.map((res) => (
                      <a
                         key={res.id}
                         href={res.url}
                         target="_blank"
                         rel="noopener noreferrer"
                         style={{
                           display: "block",
                           padding: "12px",
                           borderRadius: "var(--radius-md)",
                           background: "var(--bg-surface)",
                           border: "1px solid var(--border)",
                           textDecoration: "none",
                           color: "inherit",
                           transition: "transform 0.2s, border-color 0.2s",
                         }}
                         onMouseEnter={(e) => {
                           e.currentTarget.style.borderColor = "var(--accent)";
                           e.currentTarget.style.transform = "translateY(-2px)";
                         }}
                         onMouseLeave={(e) => {
                           e.currentTarget.style.borderColor = "var(--border)";
                           e.currentTarget.style.transform = "none";
                         }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          {resourceIcon[res.type] || <FileText size={14} />}
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {res.title}
                          </span>
                        </div>
                        {res.why && (
                          <div style={{ fontSize: 10.5, color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.3, marginBottom: 4 }}>
                            {res.why}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{res.website || "Resource"}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Assessment Question & Feedback */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", paddingBottom: 8, margin: 0 }}>
                  Assessment Details
                </h3>

                {selectedReviewAssessment.format === "free_form" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>PROMPT</span>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 4, background: "var(--bg-surface)", padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                        {selectedReviewAssessment.freeFormPrompt}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>YOUR RESPONSE</span>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 4, background: "var(--bg-surface)", padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", whiteSpace: "pre-wrap" }}>
                        {selectedReviewAssessment.userResponse}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>EVALUATOR FEEDBACK</span>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 4, background: "var(--green-dim)", padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--green)" }}>
                        {renderMarkdown(selectedReviewAssessment.agentFeedback || "")}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {(selectedReviewAssessment.questions || []).map((q: any, idx: number) => (
                      <div key={idx} style={{
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        padding: 14,
                        background: "var(--bg-surface)"
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                          {idx + 1}. {q.question}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {q.options.map((opt: string, optIdx: number) => {
                            const isCorrect = optIdx === q.correctIndex;
                            return (
                              <div key={optIdx} style={{
                                padding: "6px 10px",
                                borderRadius: "var(--radius-sm)",
                                fontSize: 12.5,
                                background: isCorrect ? "var(--green-dim)" : "var(--bg-card)",
                                border: isCorrect ? "1px solid var(--green)" : "1px solid var(--border)",
                                color: isCorrect ? "var(--green)" : "var(--text-primary)"
                              }}>
                                {opt} {isCorrect && "✓"}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 8, fontStyle: "italic" }}>
                          Explanation: {q.explanation}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Tutor Chat history */}
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: "var(--bg-surface)",
              height: "100%"
            }}>
              <div style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "var(--bg-card)"
              }}>
                <MessageSquare size={16} color="var(--accent)" />
                <h4 style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>Study Tutor Chat Log</h4>
              </div>

              <div style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: 14
              }}>
                {loadingReviewChat ? (
                  <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: "var(--text-muted)" }}>
                    <Loader2 size={18} style={{ animation: "spin 1.5s linear infinite" }} />
                    <span style={{ fontSize: 12 }}>Loading chat history...</span>
                  </div>
                ) : reviewChatMessages.length === 0 ? (
                  <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
                    No tutor messages for this session.
                  </div>
                ) : (
                  reviewChatMessages.map((m, idx) => {
                    const isUser = m.role === "user";
                    return (
                      <div key={idx} style={{
                        alignSelf: isUser ? "flex-end" : "flex-start",
                        background: isUser ? "var(--accent)" : "var(--bg-card)",
                        color: isUser ? "#fff" : "var(--text-primary)",
                        padding: "10px 14px",
                        borderRadius: isUser ? "12px 12px 0 12px" : "12px 12px 12px 0",
                        fontSize: 12.5,
                        maxWidth: "85%",
                        lineHeight: 1.45,
                        boxShadow: "var(--shadow-sm)",
                        wordBreak: "break-word"
                      }}>
                        {m.content}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}