"use client";
import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props { children: ReactNode; label?: string; }
interface State { hasError: boolean; message: string; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100%", minHeight: 280, padding: 40, textAlign: "center",
      }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--red-dim)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <AlertTriangle size={22} color="var(--red)" />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
          {this.props.label ?? "Something went wrong"}
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, maxWidth: 300, lineHeight: 1.6 }}>
          {this.state.message || "An unexpected error occurred in this section."}
        </p>
        <button
          onClick={() => this.setState({ hasError: false, message: "" })}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "9px 16px", borderRadius: "var(--radius-md)",
            background: "var(--bg-card)", border: "1px solid var(--border)",
            color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", fontFamily: "var(--font-body)",
          }}
        >
          <RefreshCw size={13} /> Try again
        </button>
      </div>
    );
  }
}