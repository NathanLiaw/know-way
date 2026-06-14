"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Sparkles, 
  ArrowRight, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  Activity, 
  BookOpen, 
  Zap, 
  Compass 
} from "lucide-react";
import { api } from "@/lib/api";

export default function Home() {
  const [isDebug, setIsDebug] = useState(false);
  const [apiHealth, setApiHealth] = useState<{ status: string; message: string; database?: string } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Parse Clerk Publishable Key for safe diagnostic display
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  const signInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "";
  const signUpUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

  const hasKey = publishableKey.length > 0;
  const isProdKey = publishableKey.startsWith("pk_live_");
  const isTestKey = publishableKey.startsWith("pk_test_");

  let keyDisplay = "Not Set ❌";
  if (hasKey) {
    if (isProdKey) {
      keyDisplay = `Production Key (pk_live_...${publishableKey.slice(-6)}) ✅`;
    } else if (isTestKey) {
      keyDisplay = `Test Key (pk_test_...${publishableKey.slice(-6)}) ⚠️`;
    } else {
      keyDisplay = `Configured (Custom/Unknown) ℹ️`;
    }
  }

  useEffect(() => {
    // Check if ?debug=true is present in the URL
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("debug") === "true") {
        setIsDebug(true);
      }
    }
  }, []);

  const runDiagnostics = async () => {
    setCheckingHealth(true);
    try {
      const res = await api.health();
      setApiHealth({
        status: "success",
        message: "API responds correctly",
        database: res.database
      });
    } catch (err: any) {
      setApiHealth({
        status: "error",
        message: err.message || "Failed to fetch. CORS issue or Backend is down."
      });
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    if (isDebug) {
      runDiagnostics();
    }
  }, [isDebug]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "var(--bg)",
      position: "relative",
      overflowX: "hidden"
    }}>
      {/* Background Decorative Gradients */}
      <div style={{
        position: "absolute",
        top: 0,
        left: "10%",
        width: "600px",
        height: "600px",
        background: "radial-gradient(circle, rgba(13, 148, 136, 0.08) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0
      }} />
      <div style={{
        position: "absolute",
        bottom: 0,
        right: "10%",
        width: "500px",
        height: "500px",
        background: "radial-gradient(circle, rgba(168, 85, 247, 0.05) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0
      }} />

      {/* Navigation Bar */}
      <header style={{
        position: "relative",
        zIndex: 10,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "24px 40px",
        borderBottom: "1px solid rgba(226, 232, 240, 0.6)",
        backdropFilter: "blur(8px)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            background: "linear-gradient(135deg, var(--accent) 0%, #14b8a6 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(13, 148, 136, 0.2)"
          }}>
            <Compass size={18} color="#fff" />
          </div>
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em"
          }}>
            Know-Way
          </span>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <Link href="/sign-in" style={{
            padding: "10px 20px",
            borderRadius: "var(--radius-md)",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text-secondary)",
            textDecoration: "none",
            transition: "color 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
          >
            Sign In
          </Link>
          <Link href="/dashboard" style={{
            padding: "10px 22px",
            borderRadius: "var(--radius-md)",
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            background: "var(--accent)",
            border: "none",
            textDecoration: "none",
            boxShadow: "0 4px 14px rgba(13, 148, 136, 0.2)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            transition: "transform 0.2s, opacity 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.9";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          >
            Go to Dashboard <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{
        position: "relative",
        zIndex: 10,
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px",
        textAlign: "center",
        maxWidth: "800px",
        margin: "0 auto"
      }} className="fade-up">
        
        {/* Decorative Badge */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 16px",
          borderRadius: "100px",
          background: "var(--accent-dim)",
          border: "1px solid rgba(13, 148, 136, 0.2)",
          color: "var(--accent)",
          fontSize: 12.5,
          fontWeight: 600,
          marginBottom: 28,
          boxShadow: "0 2px 8px rgba(13, 148, 136, 0.05)"
        }}>
          <Sparkles size={13} />
          <span>You Can't Know What You Don't Know</span>
        </div>

        {/* Hero Title */}
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "3.2rem",
          lineHeight: 1.15,
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "-0.03em",
          marginBottom: 20
        }}>
          Master Any Skill with <span style={{
            background: "linear-gradient(135deg, var(--accent) 0%, #06b6d4 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>AI-Powered</span> Learning Paths
        </h1>

        {/* Hero Description */}
        <p style={{
          fontSize: 16,
          color: "var(--text-secondary)",
          lineHeight: 1.6,
          marginBottom: 36,
          maxWidth: "640px"
        }}>
          Know-Way visualizes your learning path using interactive roadmaps. Get AI-generated study concepts, automated quizzes, and customize your roadmap dynamically based on your confidence scores.
        </p>

        {/* CTA Buttons */}
        <div style={{
          display: "flex",
          gap: 16,
          marginBottom: 60
        }}>
          <Link href="/dashboard" style={{
            padding: "14px 28px",
            borderRadius: "var(--radius-lg)",
            fontSize: 15.5,
            fontWeight: 600,
            color: "#fff",
            background: "var(--accent)",
            textDecoration: "none",
            boxShadow: "0 6px 20px rgba(13, 148, 136, 0.3)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.95";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          >
            Start Learning Now <ArrowRight size={16} />
          </Link>
        </div>

        {/* Feature Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 20,
          width: "100%",
          textAlign: "left",
          marginTop: 20
        }}>
          {/* Card 1 */}
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: 24,
            boxShadow: "var(--shadow-card)"
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: "8px",
              background: "rgba(13, 148, 136, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16
            }}>
              <Compass size={18} color="var(--accent)" />
            </div>
            <h3 style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Adaptive Roadmaps</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
              Generate structured, visual learning paths dynamically curated for your unique target topic.
            </p>
          </div>

          {/* Card 2 */}
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: 24,
            boxShadow: "var(--shadow-card)"
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: "8px",
              background: "rgba(168, 85, 247, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16
            }}>
              <Zap size={18} color="var(--purple)" />
            </div>
            <h3 style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Interactive Lessons</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
              Dive deep into specific nodes, ask AI questions, and build your confidence score as you study.
            </p>
          </div>

          {/* Card 3 */}
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: 24,
            boxShadow: "var(--shadow-card)"
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: "8px",
              background: "rgba(16, 185, 129, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16
            }}>
              <BookOpen size={18} color="var(--green)" />
            </div>
            <h3 style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Automated Quizzes</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
              Test your knowledge on individual tasks or whole modules to prove your comprehensive mastery.
            </p>
          </div>
        </div>
      </main>

      {/* DIAGNOSTICS PANEL (Hidden behind ?debug=true) */}
      {isDebug && (
        <section style={{
          position: "relative",
          zIndex: 20,
          background: "#1e293b",
          borderTop: "3px solid var(--accent)",
          color: "#f8fafc",
          padding: "32px 40px",
          fontFamily: "monospace",
          fontSize: 13,
          textAlign: "left"
        }}>
          <div style={{
            maxWidth: "960px",
            margin: "0 auto"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #475569",
              paddingBottom: 16,
              marginBottom: 20
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Terminal size={18} color="var(--accent)" />
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff", margin: 0 }}>
                  Deployment & Authentication Diagnostics
                </h2>
              </div>
              <button 
                onClick={runDiagnostics}
                disabled={checkingHealth}
                style={{
                  background: "#334155",
                  color: "#fff",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: 12
                }}
              >
                {checkingHealth ? "Running Pings..." : "Re-run Checks"}
              </button>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
              marginBottom: 20
            }}>
              {/* Left Column: Key Checks */}
              <div>
                <h3 style={{ color: "#38bdf8", fontSize: 14, marginBottom: 12 }}>Clerk Settings (Client Compiled)</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Publishable Key Status:</span>
                    <span style={{ fontWeight: 600 }}>{keyDisplay}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>NEXT_PUBLIC_CLERK_SIGN_IN_URL:</span>
                    <span>{signInUrl ? `"${signInUrl}" ✅` : "Not Configured (Defaults to Clerk domain) ⚠️"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>NEXT_PUBLIC_CLERK_SIGN_UP_URL:</span>
                    <span>{signUpUrl ? `"${signUpUrl}" ✅` : "Not Configured (Defaults to Clerk domain) ⚠️"}</span>
                  </div>
                </div>

                {isTestKey && (
                  <div style={{
                    marginTop: 16,
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid #f59e0b",
                    borderRadius: "6px",
                    padding: 12,
                    display: "flex",
                    gap: 10
                  }}>
                    <ShieldAlert size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
                    <p style={{ color: "#fbae3c", fontSize: 12, margin: 0, lineHeight: 1.4 }}>
                      <strong>Warning:</strong> You are using a <code>pk_test_</code> key on your production domain (<code>know-way.site</code>). Clerk test instances always redirect to their development URLs (like <code>*.accounts.dev</code>) for login, which can trigger white screens or configuration issues if custom domain routing is mismatching. In production, configure the service with production keys (<code>pk_live_...</code>).
                    </p>
                  </div>
                )}

                {!hasKey && (
                  <div style={{
                    marginTop: 16,
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid #ef4444",
                    borderRadius: "6px",
                    padding: 12,
                    display: "flex",
                    gap: 10
                  }}>
                    <ShieldAlert size={18} color="#ef4444" style={{ flexShrink: 0 }} />
                    <p style={{ color: "#f87171", fontSize: 12, margin: 0, lineHeight: 1.4 }}>
                      <strong>Error:</strong> No Clerk Publishable Key was found at build time! Next.js compiles environment variables starting with <code>NEXT_PUBLIC_</code> directly into the build bundles. If they were missing when building the Docker image, Clerk client components cannot initialize.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Connection & Environment Checks */}
              <div>
                <h3 style={{ color: "#38bdf8", fontSize: 14, marginBottom: 12 }}>Server Connection & Client Environment</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Client Hostname:</span>
                    <span>{typeof window !== "undefined" ? window.location.hostname : "Server-side"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>NEXT_PUBLIC_API_URL:</span>
                    <span>{apiUrl ? `"${apiUrl}"` : "Not Configured (Falls back to local backend)"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#94a3b8" }}>API Connection:</span>
                    {checkingHealth ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8" }}>
                        <Activity size={14} className="spin" /> Checking...
                      </span>
                    ) : apiHealth?.status === "success" ? (
                      <span style={{ color: "#4ade80", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                        <CheckCircle2 size={14} /> Connected
                      </span>
                    ) : apiHealth?.status === "error" ? (
                      <span style={{ color: "#f87171", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                        <XCircle size={14} /> Error
                      </span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>Not checked yet</span>
                    )}
                  </div>
                  {apiHealth?.database && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#94a3b8" }}>Database Connection:</span>
                      <span style={{ color: apiHealth.database === "connected" ? "#4ade80" : "#f87171" }}>
                        {apiHealth.database}
                      </span>
                    </div>
                  )}
                </div>

                {apiHealth?.status === "error" && (
                  <div style={{
                    marginTop: 16,
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid #ef4444",
                    borderRadius: "6px",
                    padding: 12
                  }}>
                    <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>
                      <strong>API Connection Failed:</strong> {apiHealth.message}. Ensure your backend server is running and its URL (configured under <code>NEXT_PUBLIC_API_URL</code>) accepts requests from this origin.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div style={{
              background: "#0f172a",
              padding: "16px 20px",
              borderRadius: "8px",
              border: "1px solid #334155",
              color: "#94a3b8",
              fontSize: 12,
              lineHeight: 1.5
            }}>
              <h4 style={{ color: "#fff", fontSize: 12, margin: "0 0 6px 0" }}>Suggested Action Steps for Clerk redirection issues:</h4>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>Confirm that the Docker image is built with <code>--build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...</code>. Because Next.js compiles client environment variables during <code>npm run dev</code> or <code>next build</code>, adding variables in Cloud Run's run-time settings is <strong>not sufficient</strong> for variables prefixing with <code>NEXT_PUBLIC_</code> in static code.</li>
                <li>In your production instance on Clerk Dashboard, verify that your <strong>Production instance settings</strong> match your domain:
                  <ul style={{ paddingLeft: 16 }}>
                    <li>Instance settings should have "Production" active.</li>
                    <li>If you configured a custom domain on Clerk (e.g. <code>clerk.know-way.site</code>), verify that DNS CNAME records point to Clerk correctly.</li>
                  </ul>
                </li>
                <li>Verify you have set <code>NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in</code> and <code>NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up</code> at build-time. Without these, Clerk automatically redirects to <code>accounts.clerk.dev</code> hosted endpoints, causing white screens if they are disabled or blocked.</li>
              </ol>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer style={{
        marginTop: "auto",
        padding: "24px 40px",
        borderTop: "1px solid rgba(226, 232, 240, 0.6)",
        textAlign: "center",
        fontSize: 13,
        color: "var(--text-muted)",
        position: "relative",
        zIndex: 10
      }}>
        <p>&copy; {new Date().getFullYear()} Know-Way. All rights reserved.</p>
      </footer>
    </div>
  );
}
