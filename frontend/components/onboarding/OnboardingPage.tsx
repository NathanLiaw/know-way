"use client";
import { useState, useRef, useEffect, useMemo, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Roadmap } from "@/lib/types";
import { useApp } from "@/lib/app-context";
import { ArrowRight, ArrowLeft, Check, Loader2, Bot, User, Send } from "lucide-react";
import LogoMark from "@/components/brand/LogoMark";
import AppWordmark from "@/components/brand/AppWordmark";

const STEPS = ["Topic", "Core pillars", "Sub-topics", "Your roadmap"];

export default function OnboardingPage() {
  const router = useRouter();
  const { roadmaps, refresh } = useApp();
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedRoadmap, setGeneratedRoadmap] = useState<Roadmap | null>(null);
  const [knowledgeMap, setKnowledgeMap] = useState<Record<string, number>>({});
  const [profile, setProfile] = useState<any>(null);

  // Advisor Chat States
  const [onboardingStage, setOnboardingStage] = useState<"topic" | "chat" | "generating">("topic");
  const [sessionId, setSessionId] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<{ id: string; role: "user" | "agent"; text: string }[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [expandingType, setExpandingType] = useState<"sub" | "sub_sub">("sub");
  const [expansionStage, setExpansionStage] = useState(0);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === 0 && onboardingStage === "topic") {
      const activeCount = roadmaps.filter(r => r.status === "active").length;
      if (activeCount >= 3) {
        alert("You have reached the limit of 3 active roadmaps. Please pause or delete an existing roadmap before creating a new one.");
        router.push("/dashboard");
      }
    }
  }, [roadmaps, router, step, onboardingStage]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleStartOnboarding = async () => {
    if (!topic.trim()) return;
    const activeCount = roadmaps.filter(r => r.status === "active").length;
    if (activeCount >= 3) {
      alert("You have reached the limit of 3 active roadmaps. Please pause or delete an existing roadmap before creating a new one.");
      return;
    }
    setGenerating(true);
    setOnboardingStage("chat");
    setChatLoading(true);
    try {
      const res = await api.startOnboarding(topic.trim());
      setSessionId(res.session_id);
      setChatMessages([
        { id: "1", role: "agent", text: `I am your Advisor. Let's customize your roadmap for learning **${topic.trim()}**.` },
        { id: "2", role: "agent", text: res.question || "" }
      ]);
      setSuggestions(res.default_answers || []);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to start onboarding.");
      setOnboardingStage("topic");
    } finally {
      setGenerating(false);
      setChatLoading(false);
    }
  };


  const handleSendMessage = async (text: string) => {
    if (!text.trim() || chatLoading) return;
    const userMsg = { id: Date.now().toString(), role: "user" as const, text: text.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    setSuggestions([]);

    try {
      const res = await api.sendOnboardingMessage(sessionId, text.trim());
      if (res.complete) {
        setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "agent" as const, text: "Excellent! I have compiled your learning profile. Generating your customized roadmap skeleton now..." }]);
        setOnboardingStage("generating");
        setProfile(res.profile);
        
        // Call backend Professor to generate core nodes
        const rm = await api.generateRoadmap(topic.trim(), res.profile);
        setGeneratedRoadmap(rm);
        
        const initial: Record<string, number> = {};
        rm.nodes.forEach(n => { initial[n.id] = 0; });
        setKnowledgeMap(initial);
        setStep(1); // Transition to Knowledge check (Core pillars)
      } else {
        setChatMessages(prev => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: "agent" as const, text: res.question || "" }
        ]);
        setSuggestions(res.default_answers || []);
      }
    } catch (e) {
      console.error(e);
      setChatMessages(prev => [...prev, { id: (Date.now() + 2).toString(), role: "agent" as const, text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateSubNodes = async () => {
    if (!generatedRoadmap) return;
    setExpanding(true);
    setExpandingType("sub");
    setExpansionStage(0);
    
    const interval = setInterval(() => {
      setExpansionStage(prev => (prev < 2 ? prev + 1 : prev));
    }, 1500);

    try {
      const res = await api.generateSubNodes(generatedRoadmap.id, knowledgeMap);
      setGeneratedRoadmap(res);
      
      // Initialize knowledgeMap for new subnodes to 0 if not present
      setKnowledgeMap(prev => {
        const nextMap = { ...prev };
        res.nodes.forEach(n => {
          if (n.depth === "SubNode" && nextMap[n.id] === undefined) {
            nextMap[n.id] = 0;
          }
        });
        return nextMap;
      });
      
      setStep(2); // Go to SubNode rating screen
    } catch (e) {
      console.error("Failed to generate subnodes:", e);
    } finally {
      clearInterval(interval);
      setExpanding(false);
    }
  };

  const handleBuildRoadmap = async () => {
    if (!generatedRoadmap) return;
    setExpanding(true);
    setExpandingType("sub_sub");
    setExpansionStage(0);
    
    const interval = setInterval(() => {
      setExpansionStage(prev => (prev < 2 ? prev + 1 : prev));
    }, 1500);

    try {
      const expanded = await api.generateSubSubNodes(generatedRoadmap.id, knowledgeMap);
      setGeneratedRoadmap(expanded);
      setStep(3);
      if (refresh) {
        await refresh();
      }
      router.push(`/roadmap/${expanded.id}`);
    } catch (e) {
      console.error("Failed to expand roadmap:", e);
      setExpanding(false);
    } finally {
      clearInterval(interval);
    }
  };

  const coreNodes = useMemo(() => {
    if (!generatedRoadmap) return [];
    return generatedRoadmap.nodes.filter(n => n.depth === "CoreNode");
  }, [generatedRoadmap]);

  const groupedNodes = useMemo(() => {
    if (!generatedRoadmap) return [];
    const cores = generatedRoadmap.nodes.filter(n => n.depth === "CoreNode");
    const subs = generatedRoadmap.nodes.filter(n => n.depth === "SubNode");
    
    return cores.map(core => {
      const children = subs.filter(sub => {
        if (sub.parent === core.id) return true;
        const subParentShort = sub.parent?.split("_").pop() || "";
        const coreShort = core.id.split("_").pop() || "";
        return subParentShort === coreShort;
      });
      return { core, children };
    });
  }, [generatedRoadmap]);

  const backButtonStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: "var(--radius-md)",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
    fontSize: 13,
    fontFamily: "var(--font-body)",
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s, border-color 0.15s",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", background: "var(--bg)", position: "relative" }}>
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        style={{
          ...backButtonStyle,
          position: "absolute",
          top: 20,
          left: 20,
        }}
        onMouseEnter={e => {
          const el = e.currentTarget;
          el.style.background = "var(--bg-hover)";
          el.style.color = "var(--text-primary)";
          el.style.borderColor = "var(--border-strong)";
        }}
        onMouseLeave={e => {
          const el = e.currentTarget;
          el.style.background = "var(--bg-card)";
          el.style.color = "var(--text-secondary)";
          el.style.borderColor = "var(--border)";
        }}
      >
        <ArrowLeft size={14} /> Back to home
      </button>

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LogoMark size={17} />
        </div>
        <AppWordmark size="lg" />
      </div>

      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 48 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600,
                background: i < step ? "var(--green)" : i === step ? "var(--accent)" : "var(--bg-card)",
                color: i <= step ? "#fff" : "var(--text-muted)",
                border: `1.5px solid ${i < step ? "var(--green)" : i === step ? "var(--accent)" : "var(--border)"}`,
                transition: "all 0.3s",
              }}>
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span style={{ fontSize: 11, color: i === step ? "var(--text-primary)" : "var(--text-muted)", whiteSpace: "nowrap" }}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 80, height: 1.5, background: i < step ? "var(--green)" : "var(--border)", margin: "0 8px", marginBottom: 22, transition: "background 0.3s" }} />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: 560,
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)", padding: "36px 40px",
        animation: "fadeUp 0.3s ease",
        display: "flex", flexDirection: "column",
        minHeight: onboardingStage === "chat" ? 480 : "auto",
      }}>
        {/* Step 0 — Topic */}
        {step === 0 && onboardingStage === "topic" && (
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, marginBottom: 10 }}>What do you want to learn?</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
              Describe a skill, topic, or field. The Advisor will ask you a few questions to build a highly personalized roadmap.
            </p>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !generating && topic.trim() && handleStartOnboarding()}
              placeholder="e.g. Rust systems programming, GraphQL API design, Music theory..."
              style={{
                width: "100%", padding: "14px 16px",
                background: "var(--bg-surface)", border: "1.5px solid var(--border)",
                borderRadius: "var(--radius-md)", color: "var(--text-primary)",
                fontSize: 15, outline: "none", fontFamily: "var(--font-body)",
                marginBottom: 20,
                transition: "border-color 0.2s",
              }}
              onFocus={e => (e.target.style.borderColor = "var(--accent)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")}
            />
            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
              {["React Native", "System design", "Data engineering", "TypeScript"].map(suggestion => (
                <button key={suggestion} onClick={() => setTopic(suggestion)} style={{
                  padding: "5px 12px", borderRadius: 20, background: "var(--bg-surface)",
                  border: "1px solid var(--border)", color: "var(--text-secondary)",
                  fontSize: 12, cursor: "pointer", fontFamily: "var(--font-body)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <button
              onClick={handleStartOnboarding}
              disabled={!topic.trim() || generating}
              style={{
                width: "100%", padding: "13px", borderRadius: "var(--radius-md)",
                background: topic.trim() ? "var(--accent)" : "var(--bg-surface)",
                color: topic.trim() ? "#fff" : "var(--text-muted)",
                border: "none", fontSize: 15, fontWeight: 500, cursor: topic.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.2s",
              }}
            >
              {generating ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Connecting to Advisor...</> : <>Start onboarding <ArrowRight size={16} /></>}
            </button>
          </div>
        )}

        {/* Step 0.5 — Chat Conversation */}
        {step === 0 && onboardingStage === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 400 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <Bot size={20} color="var(--accent)" /> Onboarding Interview
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
              Answer the Advisor's questions so we can calibrate your course scope and experience level.
            </p>
            
            {/* Chat Messages */}
            <div style={{
              flex: 1, overflowY: "auto", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", background: "var(--bg-surface)",
              padding: 16, display: "flex", flexDirection: "column", gap: 12,
              maxHeight: 280, minHeight: 220, marginBottom: 16
            }}>
              {chatMessages.map((m) => (
                <div key={m.id} style={{ display: "flex", gap: 8, flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    background: m.role === "agent" ? "var(--accent-light)" : "var(--bg-card)",
                    border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {m.role === "agent" ? <Bot size={11} color="var(--accent)" /> : <User size={11} color="var(--text-secondary)" />}
                  </div>
                  <div style={{
                    padding: "8px 12px", borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    background: m.role === "user" ? "var(--accent)" : "var(--bg-card)",
                    border: m.role === "user" ? "none" : "1px solid var(--border)",
                    fontSize: 13, color: m.role === "user" ? "#fff" : "var(--text-primary)",
                    lineHeight: 1.45, maxWidth: "80%"
                  }}>
                    {m.text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                      part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part
                    )}
                  </div>
                </div>
              ))}
              {chatMessages.length === 0 && chatLoading && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bot size={11} color="var(--accent)" />
                  </div>
                  <div style={{ padding: "8px 12px", borderRadius: "12px 12px 12px 2px", background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 13, color: "var(--text-secondary)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Loader2 size={12} color="var(--text-muted)" style={{ animation: "spin 1s linear infinite" }} />
                      <span>Connecting to Advisor &amp; matching skill domains...</span>
                    </div>
                  </div>
                </div>
              )}
              {chatLoading && chatMessages.length > 0 && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bot size={11} color="var(--accent)" />
                  </div>
                  <div style={{ padding: "8px 12px", borderRadius: "12px 12px 12px 2px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <Loader2 size={12} color="var(--text-muted)" style={{ animation: "spin 1s linear infinite" }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {suggestions.map((s) => (
                  <button key={s} onClick={() => handleSendMessage(s)} style={{
                    padding: "6px 12px", borderRadius: 16, fontSize: 12,
                    background: "var(--bg-surface)", border: "1px solid var(--border)",
                    color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-body)",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Chat Input */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSendMessage(chatInput)}
                placeholder="Type your response..."
                disabled={chatLoading}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: "var(--radius-md)",
                  background: "var(--bg-surface)", border: "1px solid var(--border)",
                  color: "var(--text-primary)", fontSize: 13, outline: "none",
                  fontFamily: "var(--font-body)", transition: "border-color 0.15s"
                }}
                onFocus={e => (e.target.style.borderColor = "var(--accent)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")}
              />
              <button
                onClick={() => handleSendMessage(chatInput)}
                disabled={!chatInput.trim() || chatLoading}
                style={{
                  width: 38, height: 38, borderRadius: "var(--radius-md)", flexShrink: 0,
                  background: chatInput.trim() ? "var(--accent)" : "var(--bg-surface)",
                  border: "none", cursor: chatInput.trim() ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}
              >
                <Send size={14} color={chatInput.trim() ? "#fff" : "var(--text-muted)"} />
              </button>
            </div>
          </div>
        )}

        {/* Step 0.75 — Generating */}
        {step === 0 && onboardingStage === "generating" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0" }}>
            {/* Extracted Learner Profile Card */}
            {profile && (
              <div style={{
                width: "100%",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "16px 20px",
                marginBottom: "28px",
                textAlign: "left",
                boxShadow: "var(--shadow-sm)"
              }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Extracted Learner Profile
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: 13, marginBottom: 10 }}>
                  <div>
                    <span style={{ color: "var(--text-muted)", fontSize: 11, display: "block" }}>Experience level</span>
                    <strong style={{ color: "var(--text-primary)" }}>{profile.experience}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", fontSize: 11, display: "block" }}>Weekly time commitment</span>
                    <strong style={{ color: "var(--text-primary)" }}>{profile.time} hours/week</strong>
                  </div>
                </div>
                <div style={{ fontSize: 13, marginBottom: 10 }}>
                  <span style={{ color: "var(--text-muted)", fontSize: 11, display: "block" }}>Primary learning goal</span>
                  <strong style={{ color: "var(--text-primary)" }}>{profile.learning_goal}</strong>
                </div>
                {profile.detail && (
                  <div style={{ fontSize: 12, borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 11, display: "block", marginBottom: 2 }}>Context & Details</span>
                    <p style={{ color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>{profile.detail}</p>
                  </div>
                )}
              </div>
            )}
            <Loader2 size={36} color="var(--accent)" style={{ animation: "spin 1s linear infinite", marginBottom: 20 }} />
            <h3 style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Customizing Your Roadmap</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, textAlign: "center", maxWidth: 360 }}>
              The Curriculum Architect is building a personalized set of core pillars based on your onboarding answers. This takes a moment...
            </p>
          </div>
        )}

        {/* Step 1 — Core pillars check */}
        {step === 1 && generatedRoadmap && !expanding && (
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400, marginBottom: 10 }}>How familiar are you with the core pillars?</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
              Rate your current confidence. We will skip what you already know and focus on your learning gaps.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 28, maxHeight: "40vh", overflowY: "auto", paddingRight: 8 }}>
              {coreNodes.map(node => {
                const val = knowledgeMap[node.id] ?? 0;
                return (
                  <div key={node.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                        {node.title}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: val >= 70 ? "var(--green)" : val > 0 ? "var(--accent)" : "var(--text-muted)", flexShrink: 0 }}>
                        {val}%
                      </span>
                    </div>
                    {node.description && (
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
                        {node.description}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 10, margin: "8px 0" }}>
                      {[
                        { label: "No Idea", val: 0 },
                        { label: "Learning", val: 50 },
                        { label: "Mastered", val: 100 }
                      ].map(cat => (
                        <button
                          key={cat.label}
                          type="button"
                          onClick={() => setKnowledgeMap(prev => ({ ...prev, [node.id]: cat.val }))}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: "var(--radius-md)",
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: "pointer",
                            background: val === cat.val ? "var(--accent)" : "var(--bg-surface)",
                            color: val === cat.val ? "#fff" : "var(--text-secondary)",
                            border: `1px solid ${val === cat.val ? "var(--accent)" : "var(--border)"}`,
                            transition: "all 0.15s"
                          }}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setStep(0); setOnboardingStage("topic"); }} style={{ padding: "11px 18px", borderRadius: "var(--radius-md)", background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={handleGenerateSubNodes} style={{ flex: 1, padding: "11px", borderRadius: "var(--radius-md)", background: "var(--accent)", color: "#fff", border: "none", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                Next: Customize Sub-topics <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Sub-topics check */}
        {step === 2 && generatedRoadmap && !expanding && (
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400, marginBottom: 10 }}>Fine-tune your sub-topics</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
              We have generated sub-topics under each core pillar. Please rate your confidence for each sub-topic.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 28, maxHeight: "42vh", overflowY: "auto", paddingRight: 8 }}>
              {groupedNodes.map(({ core, children }) => {
                const coreVal = knowledgeMap[core.id] ?? 0;
                return (
                  <div key={core.id} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Uneditable Core Node context header */}
                    <div style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {core.title}
                      </span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: coreVal >= 70 ? "var(--green-dim)" : "var(--accent-dim)", color: coreVal >= 70 ? "var(--green)" : "var(--accent)", fontWeight: 600 }}>
                        Pillar Confidence: {coreVal}%
                      </span>
                    </div>
                    
                    {/* Editable child sub-nodes */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingLeft: 12, borderLeft: "2px dashed var(--border)" }}>
                      {children.map(sub => {
                        const val = knowledgeMap[sub.id] ?? 0;
                        return (
                          <div key={sub.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                                  {sub.title}
                                </span>
                                {sub.description && (
                                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 6px 0", lineHeight: 1.4 }}>
                                    {sub.description}
                                  </p>
                                )}
                              </div>
                              {!sub.isSkillCheck && (
                                <span style={{ fontSize: 12, fontWeight: 700, color: val >= 70 ? "var(--green)" : val > 0 ? "var(--accent)" : "var(--text-muted)", flexShrink: 0 }}>
                                  {val}%
                                </span>
                              )}
                            </div>
                            {sub.isSkillCheck ? (
                              <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", margin: "4px 0 8px 0" }}>
                                Test your mastery with skill checks generated for this node
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: 10, margin: "8px 0" }}>
                                {[
                                  { label: "No Idea", val: 0 },
                                  { label: "Learning", val: 50 },
                                  { label: "Mastered", val: 100 }
                                ].map(cat => (
                                  <button
                                    key={cat.label}
                                    type="button"
                                    onClick={() => setKnowledgeMap(prev => ({ ...prev, [sub.id]: cat.val }))}
                                    style={{
                                      flex: 1,
                                      padding: "8px 12px",
                                      borderRadius: "var(--radius-md)",
                                      fontSize: 13,
                                      fontWeight: 500,
                                      cursor: "pointer",
                                      background: val === cat.val ? "var(--accent)" : "var(--bg-surface)",
                                      color: val === cat.val ? "#fff" : "var(--text-secondary)",
                                      border: `1px solid ${val === cat.val ? "var(--accent)" : "var(--border)"}`,
                                      transition: "all 0.15s"
                                    }}
                                  >
                                    {cat.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {children.length === 0 && (
                        <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                          No sub-topics needed (pillar skipped or fully mastered).
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ padding: "11px 18px", borderRadius: "var(--radius-md)", background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={handleBuildRoadmap} style={{ flex: 1, padding: "11px", borderRadius: "var(--radius-md)", background: "var(--accent)", color: "#fff", border: "none", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                Build my roadmap <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 1.5 & 2.5 — Expanding Checklist Loader */}
        {expanding && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            
            {/* Extracted Learner Profile Card */}
            {profile && (
              <div style={{
                width: "100%",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "16px 20px",
                marginBottom: "28px",
                textAlign: "left",
                boxShadow: "var(--shadow-sm)"
              }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Extracted Learner Profile
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: 13, marginBottom: 10 }}>
                  <div>
                    <span style={{ color: "var(--text-muted)", fontSize: 11, display: "block" }}>Experience level</span>
                    <strong style={{ color: "var(--text-primary)" }}>{profile.experience}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", fontSize: 11, display: "block" }}>Weekly time commitment</span>
                    <strong style={{ color: "var(--text-primary)" }}>{profile.time} hours/week</strong>
                  </div>
                </div>
                <div style={{ fontSize: 13, marginBottom: 10 }}>
                  <span style={{ color: "var(--text-muted)", fontSize: 11, display: "block" }}>Primary learning goal</span>
                  <strong style={{ color: "var(--text-primary)" }}>{profile.learning_goal}</strong>
                </div>
                {profile.detail && (
                  <div style={{ fontSize: 12, borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 11, display: "block", marginBottom: 2 }}>Context & Details</span>
                    <p style={{ color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>{profile.detail}</p>
                  </div>
                )}
              </div>
            )}

            <Loader2 size={36} color="var(--accent)" style={{ animation: "spin 1s linear infinite", marginBottom: 20 }} />
            <h3 style={{ fontSize: 18, fontWeight: 500, marginBottom: 20 }}>
              {expandingType === "sub" ? "Calibrating Sub-topics" : "Finalizing Learning Net"}
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 320 }}>
              {expandingType === "sub" ? (
                [
                  { label: "Professor is identifying core pillar gaps...", stage: 0 },
                  { label: "Generating customized sub-modules...", stage: 1 },
                  { label: "Assembling knowledge check phase 2...", stage: 2 }
                ].map((item, idx) => {
                  const active = expansionStage >= item.stage;
                  const done = expansionStage > item.stage;
                  return (
                    <div key={idx} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 13,
                      color: active ? "var(--text-primary)" : "var(--text-muted)",
                      transition: "color 0.3s"
                    }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: "50%",
                        border: `1.5px solid ${done ? "var(--green)" : active ? "var(--accent)" : "var(--border)"}`,
                        background: done ? "var(--green)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.3s"
                      }}>
                        {done && <Check size={10} color="#fff" />}
                      </div>
                      <span style={{ fontWeight: active ? 500 : 400 }}>{item.label}</span>
                    </div>
                  );
                })
              ) : (
                [
                  { label: "Mapping parent-child concepts...", stage: 0 },
                  { label: "Weaving net-like prerequisite links...", stage: 1 },
                  { label: "Finalizing custom resources & tasks...", stage: 2 }
                ].map((item, idx) => {
                  const active = expansionStage >= item.stage;
                  const done = expansionStage > item.stage;
                  return (
                    <div key={idx} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 13,
                      color: active ? "var(--text-primary)" : "var(--text-muted)",
                      transition: "color 0.3s"
                    }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: "50%",
                        border: `1.5px solid ${done ? "var(--green)" : active ? "var(--accent)" : "var(--border)"}`,
                        background: done ? "var(--green)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.3s"
                      }}>
                        {done && <Check size={10} color="#fff" />}
                      </div>
                      <span style={{ fontWeight: active ? 500 : 400 }}>{item.label}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
