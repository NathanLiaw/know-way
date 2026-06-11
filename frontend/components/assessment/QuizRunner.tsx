"use client";
import { useState } from "react";
import { Assessment } from "@/lib/types";
import { useApp } from "@/lib/app-context";
import { CheckCircle2, XCircle, ArrowRight, Trophy } from "lucide-react";

interface Props {
  assessment: Assessment;
  onFinish: () => void;
}

export default function QuizRunner({ assessment, onFinish }: Props) {
  const { updateAssessmentScore } = useApp();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!assessment.questions || assessment.questions.length === 0) return null;

  const question = assessment.questions[current];
  const totalQ = assessment.questions.length;
  const selected = answers[question.id];
  const isCorrect = selected === question.correctIndex;

  const handleSelect = (idx: number) => {
    if (revealed) return;
    setAnswers(prev => ({ ...prev, [question.id]: idx }));
    setRevealed(true);
  };

  const handleNext = async () => {
    if (current < totalQ - 1) {
      setCurrent(c => c + 1);
      setRevealed(false);
    } else {
      const correct = assessment.questions!.filter(q => answers[q.id] === q.correctIndex).length;
      const score = Math.round((correct / totalQ) * 100);
      setSubmitting(true);
      try {
        await updateAssessmentScore(assessment.id, score);
      } catch (err) {
        console.error("Failed to update assessment score:", err);
      } finally {
        setSubmitting(false);
      }
      setDone(true);
    }
  };

  if (done) {
    const correct = assessment.questions.filter(q => answers[q.id] === q.correctIndex).length;
    const score = Math.round((correct / totalQ) * 100);
    const passed = score >= assessment.passingScore;
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <div style={{ marginBottom: 20 }}>
          <Trophy size={48} color={passed ? "var(--amber)" : "var(--text-muted)"} />
        </div>
        <h2 style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 400, marginBottom: 8 }}>{passed ? "Quiz passed!" : "Keep studying"}</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 6 }}>You scored</p>
        <div style={{ fontSize: 48, fontWeight: 700, color: passed ? "var(--green)" : "var(--red)", marginBottom: 8 }}>{score}%</div>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 32 }}>{correct}/{totalQ} correct &bull; Passing score: {assessment.passingScore}%</p>
        <button onClick={onFinish} style={{
          padding: "11px 28px", borderRadius: "var(--radius-md)",
          background: "var(--accent)", color: "#fff", border: "none",
          fontSize: 14, fontWeight: 500, cursor: "pointer",
        }}>Back to assessments</button>
      </div>
    );
  }

  return (
    <div>
      {/* Progress */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Question {current + 1} of {totalQ}</span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{assessment.nodeTitle}</span>
      </div>
      <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginBottom: 28 }}>
        <div style={{ width: `${((current + 1) / totalQ) * 100}%`, height: 3, background: "var(--accent)", borderRadius: 2, transition: "width 0.3s ease" }} />
      </div>

      <h3 style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.5, marginBottom: 24 }}>{question.question}</h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {question.options.map((opt, idx) => {
          let bg = "var(--bg-card)";
          let border = "var(--border)";
          let color = "var(--text-primary)";
          if (revealed) {
            if (idx === question.correctIndex) { bg = "var(--green-dim)"; border = "var(--green)"; color = "var(--green)"; }
            else if (idx === selected && !isCorrect) { bg = "var(--red-dim)"; border = "var(--red)"; color = "var(--red)"; }
          } else if (idx === selected) {
            bg = "var(--accent-dim)"; border = "var(--accent)";
          }
          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderRadius: "var(--radius-md)",
                background: bg, border: `1.5px solid ${border}`,
                color, fontSize: 14, textAlign: "left", cursor: revealed ? "default" : "pointer",
                transition: "all 0.2s", fontFamily: "var(--font-body)",
              }}
            >
              <span style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, fontWeight: 600 }}>
                {String.fromCharCode(65 + idx)}
              </span>
              {opt}
              {revealed && idx === question.correctIndex && <CheckCircle2 size={16} style={{ marginLeft: "auto", flexShrink: 0 }} />}
              {revealed && idx === selected && !isCorrect && idx !== question.correctIndex && <XCircle size={16} style={{ marginLeft: "auto", flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div style={{ padding: "14px 16px", borderRadius: "var(--radius-md)", background: "var(--bg-card)", border: "1px solid var(--border)", marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: isCorrect ? "var(--green)" : "var(--red)", marginBottom: 6 }}>
            {isCorrect ? "Correct!" : "Incorrect"}
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{question.explanation}</p>
        </div>
      )}

      {revealed && (
        <button 
          onClick={handleNext} 
          disabled={submitting}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "11px 20px", borderRadius: "var(--radius-md)",
            background: submitting ? "var(--border)" : "var(--accent)", 
            color: "#fff", border: "none",
            fontSize: 14, fontWeight: 500, cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Saving results..." : (current < totalQ - 1 ? "Next question" : "See results")} 
          {!submitting && <ArrowRight size={14} />}
        </button>
      )}
    </div>
  );
}
