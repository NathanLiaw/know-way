"use client";
import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Bot, User, ChevronDown } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
  agent?: "curriculum" | "resource" | "assessment";
  streaming?: boolean;
}

const agentLabel = {
  curriculum: { name: "Curriculum Architect", color: "var(--accent)", bg: "var(--accent-light)" },
  resource:   { name: "Resource Curator",     color: "var(--teal)",   bg: "var(--teal-dim)"   },
  assessment: { name: "Assessment Agent",     color: "var(--purple)", bg: "var(--purple-dim)" },
};

// Simulated agent responses. Replace with SSE stream from FastAPI.
const mockResponses: { keywords: string[]; agent: "curriculum" | "resource" | "assessment"; reply: string }[] = [
  { keywords: ["next", "what should"], agent: "curriculum", reply: "Based on your progress, I'd recommend tackling **Eggs Mastery** next. You've completed Knife Skills and you're mid-way through Heat & Cooking Methods — eggs will consolidate both into practical technique." },
  { keywords: ["resource", "book", "learn", "video"], agent: "resource", reply: "For Heat & Cooking Methods, the highest-rated resource is **The Food Lab by Kenji Lopez-Alt** (score: 99). It's detailed but very approachable. If you want something shorter first, America's Test Kitchen has a 12-minute searing video that's a great warm-up." },
  { keywords: ["quiz", "test", "assess"], agent: "assessment", reply: "Ready to test your Knife Skills knowledge? I can generate a 5-question quiz covering julienne technique, board safety, and proper grip. Your current confidence is 80% — the quiz will verify that. Want to start?" },
  { keywords: ["stuck", "hard", "difficult", "help"], agent: "curriculum", reply: "No worries — getting stuck on Heat & Cooking Methods is common. The Maillard reaction concept trips a lot of learners. I'd suggest watching the searing video first, then reading the Food Lab chapter. Hands-on practice with just an onion and a pan will click it faster than reading alone." },
  { keywords: ["done", "finished", "complete"], agent: "curriculum", reply: "Nice work! Completing a node will unlock the dependent ones and I'll update your personalised path. Your confidence score helps me decide whether to schedule a refresher in two weeks or push you forward." },
];

function getResponse(input: string) {
  const lower = input.toLowerCase();
  for (const r of mockResponses) {
    if (r.keywords.some(k => lower.includes(k))) return r;
  }
  return {
    agent: "curriculum" as const,
    reply: "Good question. I'm analysing your current roadmap state. Based on your confidence scores across active nodes, you're tracking well. Focus on completing Heat & Cooking Methods to unlock the Eggs Mastery and Vegetables & Grains paths simultaneously.",
  };
}

export default function AgentChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "0", role: "agent", agent: "curriculum", text: "Hi Alex! I'm your Curriculum Architect. Ask me what to learn next, how to tackle a tough node, or I can quiz you on anything you've studied. What's on your mind?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", text: input.trim() };
    const userInput = input.trim();
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Simulate SSE streaming delay
    await new Promise(r => setTimeout(r, 700));
    const { agent, reply } = getResponse(userInput);

    // Stream in character by character
    const streamId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: streamId, role: "agent", agent, text: "", streaming: true }]);
    setLoading(false);

    let i = 0;
    const interval = setInterval(() => {
      i += 3;
      setMessages(prev => prev.map(m =>
        m.id === streamId ? { ...m, text: reply.slice(0, i), streaming: i < reply.length } : m
      ));
      if (i >= reply.length) clearInterval(interval);
    }, 18);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={open ? "" : "pulse"}
        style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 50,
          width: 54, height: 54, borderRadius: "50%",
          background: "var(--accent)", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", boxShadow: "0 4px 16px rgba(232,82,10,0.4)",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.08)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
        aria-label="Open agent chat"
      >
        {open ? <ChevronDown size={22} color="#fff" /> : <MessageCircle size={22} color="#fff" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="slide-in-right" style={{
          position: "fixed", bottom: 96, right: 28, zIndex: 50,
          width: 380, height: 520,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)", overflow: "hidden",
          display: "flex", flexDirection: "column",
          boxShadow: "var(--shadow-lg)",
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 18px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "var(--bg-surface)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bot size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Learning agents</div>
                <div style={{ fontSize: 11, color: "var(--green)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
                  Online
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map(m => (
              <div key={m.id} style={{ display: "flex", gap: 8, flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                {/* Avatar */}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: m.role === "agent" ? (m.agent ? agentLabel[m.agent].bg : "var(--bg-surface)") : "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {m.role === "agent" ? <Bot size={13} color={m.agent ? agentLabel[m.agent].color : "var(--text-muted)"} /> : <User size={13} color="var(--text-secondary)" />}
                </div>
                <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", gap: 3 }}>
                  {m.role === "agent" && m.agent && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: agentLabel[m.agent].color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {agentLabel[m.agent].name}
                    </div>
                  )}
                  <div style={{
                    padding: "10px 13px", borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                    background: m.role === "user" ? "var(--accent)" : "var(--bg-surface)",
                    border: m.role === "user" ? "none" : "1px solid var(--border)",
                    fontSize: 13, color: m.role === "user" ? "#fff" : "var(--text-primary)",
                    lineHeight: 1.55,
                  }}>
                    {/* Render **bold** markdown */}
                    {m.text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                      part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part
                    )}
                    {m.streaming && (
                      <span style={{ display: "inline-block", width: 2, height: 14, background: "var(--text-secondary)", verticalAlign: "middle", marginLeft: 2, animation: "pulse-ring 1s infinite" }} />
                    )}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent-dim)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bot size={13} color="var(--accent)" />
                </div>
                <div style={{ padding: "10px 14px", borderRadius: "12px 12px 12px 4px", background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                  <Loader2 size={14} color="var(--text-muted)" className="spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          <div style={{ padding: "0 12px 8px", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["What's next?", "Recommend a resource", "Quiz me"].map(s => (
              <button key={s} onClick={() => { setInput(s); }} style={{
                padding: "4px 10px", borderRadius: 20, fontSize: 11,
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-body)",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{
            padding: "10px 12px", borderTop: "1px solid var(--border)",
            display: "flex", gap: 8, background: "var(--bg-surface)",
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Ask the agents anything..."
              style={{
                flex: 1, padding: "9px 13px", borderRadius: "var(--radius-md)",
                background: "var(--bg-card)", border: "1px solid var(--border)",
                color: "var(--text-primary)", fontSize: 13,
                outline: "none", fontFamily: "var(--font-body)",
                transition: "border-color 0.15s",
              }}
              onFocus={e => (e.target.style.borderColor = "var(--accent)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")}
            />
            <button onClick={send} disabled={!input.trim() || loading} style={{
              width: 38, height: 38, borderRadius: "var(--radius-md)", flexShrink: 0,
              background: input.trim() ? "var(--accent)" : "var(--bg-hover)",
              border: "none", cursor: input.trim() ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}>
              <Send size={15} color={input.trim() ? "#fff" : "var(--text-muted)"} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}