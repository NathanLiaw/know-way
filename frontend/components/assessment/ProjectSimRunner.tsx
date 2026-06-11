"use client";
import { Assessment } from "@/lib/types";
import { useApp } from "@/lib/app-context";
import { CheckCircle2, Code, Lightbulb, ArrowRight } from "lucide-react";
import { useState } from "react";

// Project renderer: user reads the brief, marks it done
export function ProjectRunner({ assessment, onFinish }: { assessment: Assessment; onFinish: () => void }) {
  const { updateAssessmentScore } = useApp();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const criteria = [
    "The project runs without errors",
    "All required features are implemented",
    "Code is readable and organised",
    "You can explain your approach to someone else",
  ];

  const allChecked = criteria.every((_, i) => checked[i]);

  const submit = () => {
    const score = allChecked ? 100 : Math.round((Object.values(checked).filter(Boolean).length / criteria.length) * 100);
    updateAssessmentScore(assessment.id, score);
    setSubmitted(true);
  };

  if (submitted) return (
    <div style={{ textAlign: "center", padding: "48px 0" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, marginBottom: 8 }}>Project submitted!</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: 28 }}>Great work completing a real-world project.</p>
      <button onClick={onFinish} style={{ padding: "11px 28px", borderRadius: "var(--radius-md)", background: "var(--accent)", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Back to assessments</button>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--teal-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Code size={18} color="var(--teal)" />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Project</div>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>{assessment.nodeTitle}</h3>
        </div>
      </div>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "18px", marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>Project brief</div>
        <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.7 }}>
          Apply your knowledge from <strong>{assessment.nodeTitle}</strong> to build a working mini-project. Use only what you have learned so far — the goal is demonstrating real understanding, not perfection.
        </p>
      </div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 14 }}>Self-assessment checklist</div>
        {criteria.map((c, i) => (
          <label key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
            <input type="checkbox" checked={!!checked[i]} onChange={e => setChecked(prev => ({ ...prev, [i]: e.target.checked }))} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
            <span style={{ fontSize: 14, color: "var(--text-primary)" }}>{c}</span>
            {checked[i] && <CheckCircle2 size={15} color="var(--green)" style={{ marginLeft: "auto" }} />}
          </label>
        ))}
      </div>
      <button onClick={submit} style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "11px 20px", borderRadius: "var(--radius-md)",
        background: allChecked ? "var(--green)" : "var(--accent)",
        color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
      }}>
        Submit project <ArrowRight size={14} />
      </button>
    </div>
  );
}

// Simulation renderer: scenario problem to solve
export function SimulationRunner({ assessment, onFinish }: { assessment: Assessment; onFinish: () => void }) {
  const { updateAssessmentScore } = useApp();
  const [response, setResponse] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const scenarios = [
    { title: "Dinner for 8, one hour to cook", prompt: "You've just been told 8 people are coming for dinner in an hour. Your fridge has: chicken thighs, onions, garlic, canned tomatoes, pasta, cream, parmesan, and a lemon. What do you cook and in what order?" },
    { title: "The pan is smoking — now what?", prompt: "You've preheated a stainless steel pan and forgot about it. It's smoking. Walk through exactly what you do next, and what you'd cook in it now that it's this hot." },
  ];
  const scenario = scenarios[0];

  const submit = () => {
    const score = response.trim().length > 50 ? 85 : 60;
    updateAssessmentScore(assessment.id, score);
    setSubmitted(true);
  };

  if (submitted) return (
    <div style={{ textAlign: "center", padding: "48px 0" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🧑‍🍳</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, marginBottom: 8 }}>Scenario complete!</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: 28 }}>Real-world thinking is the hardest skill to teach. Well done.</p>
      <button onClick={onFinish} style={{ padding: "11px 28px", borderRadius: "var(--radius-md)", background: "var(--accent)", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Back to assessments</button>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--amber-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Lightbulb size={18} color="var(--amber)" />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Simulation</div>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>{scenario.title}</h3>
        </div>
      </div>
      <div style={{ background: "linear-gradient(135deg, #fff8f0 0%, #ffeede 100%)", border: "1.5px solid #f5c36a", borderRadius: "var(--radius-md)", padding: "20px", marginBottom: 24 }}>
        <p style={{ fontSize: 15, color: "var(--text-primary)", lineHeight: 1.75 }}>{scenario.prompt}</p>
      </div>
      <textarea
        value={response}
        onChange={e => setResponse(e.target.value)}
        placeholder="Think out loud. Describe your reasoning step by step..."
        rows={7}
        style={{
          width: "100%", padding: "14px 16px",
          background: "var(--bg-surface)", border: "1.5px solid var(--border)",
          borderRadius: "var(--radius-md)", color: "var(--text-primary)",
          fontSize: 14, fontFamily: "var(--font-body)", lineHeight: 1.6,
          outline: "none", resize: "vertical", marginBottom: 16,
          transition: "border-color 0.15s",
        }}
        onFocus={e => (e.target.style.borderColor = "var(--accent)")}
        onBlur={e => (e.target.style.borderColor = "var(--border)")}
      />
      <button onClick={submit} disabled={response.trim().length < 10} style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "11px 20px", borderRadius: "var(--radius-md)",
        background: response.trim().length >= 10 ? "var(--accent)" : "var(--bg-hover)",
        color: response.trim().length >= 10 ? "#fff" : "var(--text-muted)",
        border: "none", fontSize: 14, fontWeight: 600,
        cursor: response.trim().length >= 10 ? "pointer" : "default",
      }}>
        Submit response <ArrowRight size={14} />
      </button>
    </div>
  );
}