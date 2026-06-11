"use client";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import Sidebar from "./Sidebar";
import AgentChatPanel from "@/components/ui/AgentChatPanel";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Assessment } from "@/lib/types";
import QuizRunner from "@/components/assessment/QuizRunner";
import { 
  Play, Pause, Loader2, Send, Clock, BookOpen, AlertCircle, 
  CheckCircle, MessageSquare, Plus, Check, HelpCircle, X
} from "lucide-react";

// Inline helper for markdown parsing
function renderMarkdown(text: string) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];
  
  const parseInlineMarkdown = (str: string): React.ReactNode[] => {
    const regex = /(\*\*.*?\*\*|\[.*?\]\(.*?\))/g;
    const parts = str.split(regex);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} style={{ fontWeight: "700" }}>{part.slice(2, -2)}</strong>;
      } else if (part.startsWith("[") && part.includes("](")) {
        const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (match) {
          const [, label, url] = match;
          return (
            <a 
              key={i} 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 500 }}
            >
              {label}
            </a>
          );
        }
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
      listItems.push(<li key={idx} style={{ marginBottom: 4 }}>{parseInlineMarkdown(content)}</li>);
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      const content = trimmed.replace(/^\d+\.\s/, "");
      listItems.push(<li key={idx} style={{ marginBottom: 4 }}>{parseInlineMarkdown(content)}</li>);
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
        elements.push(<p key={idx} style={{ margin: "0 0 8px 0", lineHeight: 1.5 }}>{parseInlineMarkdown(line)}</p>);
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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { 
    roadmaps, refresh, assessments,
    startTaskSession, extendTaskSession, pauseTaskSession, resumeTaskSession,
    dismissedTaskIds, dismissTask
  } = useApp();
  const pathname = usePathname();

  // Find active task session across all roadmaps
  const activeSession = useMemo(() => {
    for (const rm of roadmaps) {
      for (const node of rm.nodes) {
        if (node.tasks) {
          for (const task of node.tasks) {
            if (task.sessionStartedAt && !task.completed && !dismissedTaskIds.includes(task.id)) {
              return { roadmap: rm, node, task };
            }
          }
        }
      }
    }
    return null;
  }, [roadmaps, dismissedTaskIds]);

  const [currentSession, setCurrentSession] = useState<any | null>(null);

  // Sync activeSession to currentSession when activeSession is first set
  useEffect(() => {
    if (activeSession) {
      setCurrentSession(activeSession);
    }
  }, [activeSession]);

  // Session timer countdown state
  const [secondsLeft, setSecondsLeft] = useState(0);

  const isTimerOver = useMemo(() => {
    if (!currentSession) return false;
    const started = new Date(currentSession.task.sessionStartedAt!).getTime();
    const durationMins = currentSession.task.sessionDurationMins ?? currentSession.task.durationMins ?? 30;
    const extendedMins = currentSession.task.sessionExtendedMins ?? 0;
    const totalDurationMs = (durationMins + extendedMins) * 60 * 1000;
    
    let elapsedMs;
    if (currentSession.task.sessionIsPaused && currentSession.task.sessionPausedAt) {
      const pausedAt = new Date(currentSession.task.sessionPausedAt).getTime();
      elapsedMs = pausedAt - started;
    } else {
      elapsedMs = Date.now() - started;
    }
    return elapsedMs >= totalDurationMs;
  }, [currentSession, secondsLeft]);

  // Tutor chat states
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  // Assessment states
  const [activeAssessment, setActiveAssessment] = useState<Assessment | null>(null);
  const [generatingAssessment, setGeneratingAssessment] = useState(false);
  const [freeFormText, setFreeFormText] = useState("");
  const [submittingAssessment, setSubmittingAssessment] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<{ score: number; feedback: string } | null>(null);

  // Update timer countdown
  useEffect(() => {
    if (!currentSession) return;
    const updateTimer = () => {
      const started = new Date(currentSession.task.sessionStartedAt!).getTime();
      const durationMins = currentSession.task.sessionDurationMins ?? currentSession.task.durationMins ?? 30;
      const extendedMins = currentSession.task.sessionExtendedMins ?? 0;
      const totalDurationMs = (durationMins + extendedMins) * 60 * 1000;
      
      let elapsedMs;
      if (currentSession.task.sessionIsPaused && currentSession.task.sessionPausedAt) {
        const pausedAt = new Date(currentSession.task.sessionPausedAt).getTime();
        elapsedMs = pausedAt - started;
      } else {
        elapsedMs = Date.now() - started;
      }
      
      const remainSecs = Math.max(0, Math.ceil((totalDurationMs - elapsedMs) / 1000));
      setSecondsLeft(remainSecs);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentSession]);

  // Load Tutor chat history
  useEffect(() => {
    if (!currentSession) {
      setChatMessages([]);
      return;
    }
    const loadChatHistory = async () => {
      setLoadingChat(true);
      try {
        const resp = await api.getTaskSession(currentSession.roadmap.id, currentSession.node.id, currentSession.task.id);
        setChatMessages(resp.messages || []);
      } catch (e) {
        console.error("Failed to load chat history:", e);
      } finally {
        setLoadingChat(false);
      }
    };
    loadChatHistory();
  }, [currentSession?.task.id]);

  // Sync active assessment status
  useEffect(() => {
    if (!currentSession) {
      setActiveAssessment(null);
      setAssessmentResult(null);
      setFreeFormText("");
      return;
    }
    const pending = assessments.find(a => a.taskId === currentSession.task.id && a.status === "pending");
    if (pending) {
      setActiveAssessment(pending);
    }
  }, [currentSession?.task.id, assessments]);

  // Extend active session
  const handleExtend = async () => {
    if (!currentSession) return;
    try {
      await extendTaskSession(currentSession.roadmap.id, currentSession.node.id, currentSession.task.id);
    } catch (e) {
      console.error("Failed to extend session:", e);
    }
  };

  const handlePause = async () => {
    if (!currentSession) return;
    try {
      await pauseTaskSession(currentSession.roadmap.id, currentSession.node.id, currentSession.task.id);
    } catch (e) {
      console.error("Failed to pause session:", e);
    }
  };

  const handleResume = async () => {
    if (!currentSession) return;
    try {
      await resumeTaskSession(currentSession.roadmap.id, currentSession.node.id, currentSession.task.id);
    } catch (e) {
      console.error("Failed to resume session:", e);
    }
  };

  // Send Tutor chat message
  const handleSendChat = async () => {
    if (!chatInput.trim() || !currentSession || sendingChat) return;
    if (currentSession.task.sessionIsPaused) return;
    const msg = chatInput.trim();
    setChatInput("");
    
    const userMsg = { role: "user", content: msg, timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMsg]);
    setSendingChat(true);
    
    try {
      const resp = await api.chatTaskSession(currentSession.roadmap.id, currentSession.node.id, currentSession.task.id, msg);
      const assistantMsg = { role: "assistant", content: resp.response, timestamp: new Date().toISOString() };
      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      console.error("Failed to send chat message:", e);
    } finally {
      setSendingChat(false);
    }
  };

  // Generate assessment on session completion (with Dev Bypass support)
  const handleGenerateAssessment = async (bypassTimer = false) => {
    if (!currentSession) return;
    setGeneratingAssessment(true);
    try {
      const quiz = await api.generateQuiz(currentSession.roadmap.id, currentSession.node.id, currentSession.task.id, bypassTimer);
      setActiveAssessment(quiz);
      await refresh();
    } catch (e) {
      console.error("Failed to generate assessment:", e);
    } finally {
      setGeneratingAssessment(false);
    }
  };

  // Submit free-form text assessment
  const { updateAssessmentScore } = useApp();
  const handleSubmitFreeForm = async () => {
    if (!activeAssessment || !freeFormText.trim() || submittingAssessment) return;
    setSubmittingAssessment(true);
    try {
      const result = await api.updateAssessmentScore(activeAssessment.id, 0, freeFormText.trim());
      setAssessmentResult({
        score: result.score ?? 0,
        feedback: result.agentFeedback ?? "Evaluation complete."
      });
      await refresh();
    } catch (e) {
      console.error("Failed to submit free-form assessment:", e);
    } finally {
      setSubmittingAssessment(false);
    }
  };

  // Complete assessment and dismiss overlay
  const handleFinishAssessment = async () => {
    await refresh();
    setActiveAssessment(null);
    setAssessmentResult(null);
    setFreeFormText("");
    setCurrentSession(null);
  };

  // Format digital clock representation
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Word count evaluation
  const freeFormWords = freeFormText.trim() === "" ? 0 : freeFormText.trim().split(/\s+/).length;
  const isFreeFormOverLimit = freeFormWords > 300;

  const initialDur = currentSession?.task.durationMins ?? 30;
  const extendAmt = Math.min(10, initialDur);
  const currentExt = currentSession?.task.sessionExtendedMins ?? 0;
  const timesExtended = extendAmt > 0 ? Math.floor(currentExt / extendAmt) : 0;

  const isRoadmapCanvas = pathname.startsWith("/roadmap/") && pathname !== "/roadmap/new" && pathname !== "/roadmap";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ 
        flex: 1, 
        height: isRoadmapCanvas ? "100vh" : "auto", 
        display: isRoadmapCanvas ? "flex" : "block", 
        flexDirection: isRoadmapCanvas ? "column" : undefined, 
        overflowY: isRoadmapCanvas ? "hidden" : "auto", 
        minWidth: 0, 
        position: "relative" 
      }}>
        {children}
      </main>

      {/* Global Timed Study overlay */}
      {currentSession && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "var(--bg-card)",
          zIndex: 9999,
          display: "flex",
          color: "var(--text-primary)",
          fontFamily: "var(--font-body)",
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
            {(currentSession.task.sessionIsPaused || isTimerOver || currentSession.task.status === "failed") && (
              <button
                onClick={() => {
                  const confirmClose = window.confirm(
                    "You are leaving the study workspace. You will need to retake the assessment later to complete this task. Exit now?"
                  );
                  if (confirmClose) {
                    dismissTask(currentSession.task.id);
                    setCurrentSession(null);
                  }
                }}
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
            )}
            {/* Left Column: Timer & Study Workspace */}
            <div style={{
              flex: activeAssessment ? 1 : 1.3,
              borderRight: activeAssessment ? "none" : "1px solid var(--border)",
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
                  {currentSession.roadmap.topic} &bull; {currentSession.node.title}
                </span>
                <h2 style={{
                  fontSize: 26,
                  fontFamily: "var(--font-display)",
                  fontWeight: 400,
                  lineHeight: 1.2,
                  marginBottom: 10
                }}>
                  {currentSession.task.name}
                </h2>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                  {currentSession.task.description}
                </p>
              </div>

              {/* Curated Resources Section */}
              {currentSession.node.resources && currentSession.node.resources.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                     <BookOpen size={16} /> Curated Resources
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                    {currentSession.node.resources.map((res: any) => (
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
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.3 }}>
                           {res.title}
                        </div>
                        <div style={{ display: "flex", gap: 8, fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 500 }}>
                          <span>{res.type}</span>
                          <span>&bull;</span>
                          <span>{res.difficulty}</span>
                          <span>&bull;</span>
                          <span>{res.durationMins}m</span>
                        </div>
                        {res.why && (
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6, fontStyle: "italic", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.3 }}>
                             "{res.why}"
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Study Area: Timer Countdown or Assessment */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                {currentSession.task.status === "failed" && !activeAssessment ? (
                  <div style={{ textAlign: "center", padding: "24px 0" }}>
                    <div style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 120,
                      height: 120,
                      borderRadius: "50%",
                      background: "rgba(220, 53, 69, 0.05)",
                      border: "3px solid var(--red-dim)",
                      boxShadow: "0 0 30px rgba(220, 53, 69, 0.08)",
                      marginBottom: 24,
                    }}>
                      <AlertCircle size={48} color="var(--red)" />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Retake Assessment</h3>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 360, margin: "0 auto 24px auto", lineHeight: 1.5 }}>
                      You failed the previous assessment. You can retake it directly without waiting for the timer.
                    </p>
                    <button
                      disabled={generatingAssessment}
                      onClick={() => handleGenerateAssessment(true)}
                      style={{
                        padding: "12px 32px",
                        borderRadius: "var(--radius-md)",
                        background: "var(--accent)",
                        color: "#fff",
                        border: "none",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: generatingAssessment ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        boxShadow: "0 4px 12px rgba(232, 82, 10, 0.2)",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                      onMouseLeave={e => e.currentTarget.style.transform = "none"}
                    >
                      {generatingAssessment ? (
                        <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                      ) : (
                        <Play size={12} fill="#fff" />
                      )}
                      Take Assessment
                    </button>
                  </div>
                ) : !activeAssessment ? (
                  // Countdown timer layout
                  <div style={{ textAlign: "center", padding: "24px 0" }}>
                    <div style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 180,
                      height: 180,
                      borderRadius: "50%",
                      background: "rgba(232, 82, 10, 0.04)",
                      border: "3px solid var(--accent-dim)",
                      boxShadow: "0 0 30px rgba(232, 82, 10, 0.08)",
                      marginBottom: 24,
                      position: "relative"
                    }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <Clock size={24} color="var(--accent)" style={{ marginBottom: 6 }} />
                        <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em" }}>
                          {formatTime(secondsLeft)}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>
                          {currentSession.task.sessionIsPaused ? "Paused" : "Remaining"}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={currentSession.task.sessionIsPaused ? handleResume : handlePause}
                        disabled={isTimerOver}
                        style={{
                          padding: "10px 20px",
                          borderRadius: "var(--radius-md)",
                          background: isTimerOver ? "var(--border)" : (currentSession.task.sessionIsPaused ? "var(--green)" : "var(--bg-surface)"),
                          border: "1px solid var(--border)",
                          color: isTimerOver ? "var(--text-muted)" : (currentSession.task.sessionIsPaused ? "#fff" : "var(--text-secondary)"),
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: isTimerOver ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          opacity: isTimerOver ? 0.5 : 1,
                          transition: "all 0.15s"
                        }}
                      >
                        {currentSession.task.sessionIsPaused ? (
                          <>
                            <Play size={14} fill="#fff" /> Resume Session
                          </>
                        ) : (
                          <>
                            <Pause size={14} /> Pause Session
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleExtend}
                        disabled={currentSession.task.sessionIsPaused || timesExtended >= 2 || isTimerOver}
                        style={{
                          padding: "10px 20px",
                          borderRadius: "var(--radius-md)",
                          background: "var(--bg-surface)",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: (currentSession.task.sessionIsPaused || timesExtended >= 2 || isTimerOver) ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          opacity: (currentSession.task.sessionIsPaused || timesExtended >= 2 || isTimerOver) ? 0.5 : 1,
                          transition: "all 0.15s"
                        }}
                      >
                        <Plus size={14} /> Extend (+{extendAmt}m)
                      </button>

                      {secondsLeft > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <button
                            disabled={generatingAssessment || currentSession.task.sessionIsPaused}
                            onClick={() => handleGenerateAssessment(true)}
                            style={{
                              padding: "10px 22px",
                              borderRadius: "var(--radius-md)",
                              background: "var(--accent)",
                              color: "#fff",
                              border: "none",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: (generatingAssessment || currentSession.task.sessionIsPaused) ? "not-allowed" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              opacity: (generatingAssessment || currentSession.task.sessionIsPaused) ? 0.5 : 1
                            }}
                          >
                            {generatingAssessment ? (
                              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                            ) : (
                              <Play size={12} fill="#fff" />
                            )}
                            Start Quiz (Dev Bypass)
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={generatingAssessment || currentSession.task.sessionIsPaused}
                          onClick={() => handleGenerateAssessment(false)}
                          style={{
                            padding: "10px 24px",
                            borderRadius: "var(--radius-md)",
                            background: "var(--green)",
                            color: "#fff",
                            border: "none",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: (generatingAssessment || currentSession.task.sessionIsPaused) ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            opacity: (generatingAssessment || currentSession.task.sessionIsPaused) ? 0.5 : 1
                          }}
                        >
                          {generatingAssessment ? (
                            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                          ) : (
                            <Play size={12} fill="#fff" />
                          )}
                          Take Assessment
                        </button>
                      )}
                    </div>
                  </div>
                ) : activeAssessment.format === "free_form" ? (
                  // Free-form writing workspace
                  <div style={{ width: "100%", maxWidth: "600px", margin: "0 auto", animation: "fadeIn 0.2s" }}>
                    {!assessmentResult ? (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <BookOpen size={16} color="var(--accent)" />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Writing Assessment Assignment</span>
                        </div>
                        <div style={{
                          fontSize: 14,
                          fontWeight: 500,
                          lineHeight: 1.5,
                          background: "var(--bg-surface)",
                          padding: "14px 18px",
                          borderRadius: "var(--radius-md)",
                          borderLeft: "4px solid var(--accent)",
                          marginBottom: 20
                        }}>
                          {renderMarkdown(activeAssessment.freeFormPrompt || "")}
                        </div>
                        
                        <textarea
                          placeholder="Paste or write your response here..."
                          value={freeFormText}
                          onChange={e => setFreeFormText(e.target.value)}
                          disabled={submittingAssessment}
                          style={{
                            width: "100%",
                            height: 160,
                            borderRadius: "var(--radius-md)",
                            background: "var(--bg-card)",
                            border: `1.5px solid ${isFreeFormOverLimit ? "var(--red)" : "var(--border)"}`,
                            color: "var(--text-primary)",
                            padding: "12px 14px",
                            fontSize: 13.5,
                            fontFamily: "var(--font-body)",
                            outline: "none",
                            resize: "none",
                            lineHeight: 1.5,
                            marginBottom: 8
                          }}
                        />

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                          <span style={{ fontSize: 12, color: isFreeFormOverLimit ? "var(--red)" : "var(--text-muted)", fontWeight: 500 }}>
                            {freeFormWords} / 300 words
                          </span>
                          {isFreeFormOverLimit && (
                            <span style={{ fontSize: 11, color: "var(--red)", fontWeight: 600 }}>
                              Word limit exceeded (Max 300)
                            </span>
                          )}
                        </div>

                        <button
                          onClick={handleSubmitFreeForm}
                          disabled={!freeFormText.trim() || isFreeFormOverLimit || submittingAssessment}
                          style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: "var(--radius-md)",
                            background: submittingAssessment ? "var(--border)" : "var(--accent)",
                            color: "#fff",
                            border: "none",
                            fontSize: 13.5,
                            fontWeight: 600,
                            cursor: submittingAssessment || !freeFormText.trim() || isFreeFormOverLimit ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8
                          }}
                        >
                          {submittingAssessment ? (
                            <>
                              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                              Grading with Evaluator Agent...
                            </>
                          ) : (
                            <>Submit Response</>
                          )}
                        </button>
                      </div>
                    ) : (
                      // Grading Feedback result
                      <div style={{ textAlign: "center", animation: "fadeIn 0.2s" }}>
                        <div style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background: assessmentResult.score >= 80 ? "var(--green-dim)" : "var(--red-dim)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 16
                        }}>
                          {assessmentResult.score >= 80 ? <Check size={20} color="var(--green)" /> : <AlertCircle size={20} color="var(--red)" />}
                        </div>
                        
                        <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
                          {assessmentResult.score >= 80 ? "Assignment Approved!" : "Retry Assessment"}
                        </h3>
                        <div style={{ fontSize: 36, fontWeight: 700, color: assessmentResult.score >= 80 ? "var(--green)" : "var(--red)", marginBottom: 16 }}>
                          {assessmentResult.score}%
                        </div>

                        <div style={{
                          background: "var(--bg-surface)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md)",
                          padding: "16px 20px",
                          textAlign: "left",
                          fontSize: 13,
                          lineHeight: 1.6,
                          color: "var(--text-secondary)",
                          marginBottom: 32
                        }}>
                          <strong style={{ display: "block", color: "var(--text-primary)", marginBottom: 6 }}>Evaluator Feedback:</strong>
                          {renderMarkdown(assessmentResult.feedback || "")}
                        </div>

                        <button
                          onClick={handleFinishAssessment}
                          style={{
                            padding: "10px 24px",
                            borderRadius: "var(--radius-md)",
                            background: "var(--accent)",
                            color: "#fff",
                            border: "none",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer"
                          }}
                        >
                          {assessmentResult.score >= 80 ? "Finish Session" : "Close & Try Again"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  // MCQ Quiz Runner
                  <div style={{ width: "100%", maxWidth: "600px", margin: "0 auto", animation: "fadeIn 0.2s" }}>
                    <QuizRunner assessment={activeAssessment} onFinish={handleFinishAssessment} />
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Tutor Lounge Chat */}
            {!activeAssessment && (
              <div style={{
                flex: 0.7,
                display: "flex",
                flexDirection: "column",
                background: "var(--bg-card)",
                position: "relative"
              }}>
                {/* Overlay blocking tutor chat when timer is over */}
                {isTimerOver && (
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(10, 10, 14, 0.85)",
                    backdropFilter: "blur(6px)",
                    zIndex: 10,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "20px",
                    textAlign: "center"
                  }}>
                    <Clock size={32} color="var(--accent)" style={{ marginBottom: 12 }} />
                    <h5 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Study Time Over</h5>
                    <p style={{ fontSize: 12.5, color: "var(--text-secondary)", maxWidth: 200, margin: 0, lineHeight: 1.4 }}>
                      Your study timer has expired. Please take the assessment to complete this task.
                    </p>
                  </div>
                )}

                {/* Tutor Header */}
                <div style={{
                  padding: "20px 24px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12
                }}>
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "var(--accent-dim)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <MessageSquare size={16} color="var(--accent)" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>Study Tutor Agent</h4>
                    <span style={{ fontSize: 11, color: currentSession.task.sessionIsPaused ? "var(--text-muted)" : "var(--green)", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: currentSession.task.sessionIsPaused ? "var(--text-muted)" : "var(--green)" }} />
                      {currentSession.task.sessionIsPaused ? "Paused" : "Active in focus session"}
                    </span>
                  </div>
                </div>

                {/* Chat history */}
                <div style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14
                }}>
                  {loadingChat ? (
                    <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: "var(--text-muted)" }}>
                      <Loader2 size={18} style={{ animation: "spin 1.5s linear infinite" }} />
                      <span style={{ fontSize: 12 }}>Loading chat history...</span>
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, padding: "20px", color: "var(--text-muted)", textAlign: "center" }}>
                      <HelpCircle size={24} color="var(--border-strong)" />
                      <span style={{ fontSize: 12, maxWidth: 220, lineHeight: 1.5 }}>
                        Ask the Study Tutor any questions about this task!
                      </span>
                    </div>
                  ) : (
                    chatMessages.map((m, idx) => {
                      const isUser = m.role === "user";
                      return (
                        <div key={idx} style={{
                          alignSelf: isUser ? "flex-end" : "flex-start",
                          background: isUser ? "var(--accent)" : "var(--bg-surface)",
                          color: isUser ? "#fff" : "var(--text-primary)",
                          padding: "10px 14px",
                          borderRadius: isUser ? "12px 12px 0 12px" : "12px 12px 12px 0",
                          fontSize: 12.5,
                          maxWidth: "85%",
                          lineHeight: 1.45,
                          boxShadow: "var(--shadow-sm)",
                          wordBreak: "break-word"
                        }}>
                          {renderMarkdown(m.content)}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Chat input box */}
                <div style={{
                  padding: "16px 20px",
                  borderTop: "1px solid var(--border)",
                  background: "var(--bg-surface)"
                }}>
                  <div style={{
                    display: "flex",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    padding: "4px 8px",
                    alignItems: "center"
                  }}>
                    <input
                      type="text"
                      placeholder={currentSession.task.sessionIsPaused ? "Session paused — resume to chat" : "Ask a question..."}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSendChat(); }}
                      disabled={sendingChat || currentSession.task.sessionIsPaused || isTimerOver}
                      style={{
                        flex: 1,
                        border: "none",
                        background: "transparent",
                        color: "var(--text-primary)",
                        fontSize: 12.5,
                        padding: "8px",
                        outline: "none"
                      }}
                    />
                    <button
                      onClick={handleSendChat}
                      disabled={sendingChat || !chatInput.trim() || currentSession.task.sessionIsPaused || isTimerOver}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--accent)",
                        cursor: "pointer",
                        padding: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: (!chatInput.trim() || currentSession.task.sessionIsPaused || isTimerOver) ? 0.3 : 1,
                        transition: "opacity 0.15s"
                      }}
                    >
                      {sendingChat ? (
                        <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                      ) : (
                        <Send size={15} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}</div>
        </div>
      )}
    </div>
  );
}