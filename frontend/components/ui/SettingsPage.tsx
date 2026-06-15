"use client";
import { useState, useEffect } from "react";
import { useApp } from "@/lib/app-context";
import { Save, Bell, User, Palette, Shield, Terminal, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

const sections = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifs", label: "Notifications", icon: Bell },
  { id: "display", label: "Display", icon: Palette },
  { id: "account", label: "Account", icon: Shield },
  { id: "debug", label: "Debug Profile", icon: Terminal },
];

export default function SettingsPage() {
  const { user, stats } = useApp();
  const [active, setActive] = useState("profile");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);

  // Sync once user loads from API (user is null on first render)
  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email ?? "");
    }
  }, [user]);

  const initials = name
    ? name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const memberSince = user?.joinedAt
    ? new Date(user.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "Recently";

  const currentStreak = stats?.currentStreak ?? 0;

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fade-up" style={{ padding: "32px 36px", width: "100%", boxSizing: "border-box" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 28 }}>Settings</h1>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 32, minHeight: "calc(100vh - 160px)", alignItems: "stretch" }}>
        {/* Side nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActive(s.id)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px", borderRadius: "var(--radius-md)",
              background: active === s.id ? "var(--accent-light)" : "transparent",
              color: active === s.id ? "var(--accent)" : "var(--text-secondary)",
              border: "none", cursor: "pointer", fontSize: 14,
              fontWeight: active === s.id ? 600 : 400,
              fontFamily: "var(--font-body)", textAlign: "left",
              borderLeft: active === s.id ? "3px solid var(--accent)" : "3px solid transparent",
              transition: "all 0.15s",
            }}>
              <s.icon size={15} /> {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "28px 30px", display: "flex", flexDirection: "column" }}>
          {active === "profile" && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 22, color: "var(--text-primary)" }}>Profile</h2>

              <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid var(--border)" }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--accent) 0%, #f08040 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, fontWeight: 700, color: "#fff",
                }}>{initials}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{name || "—"}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>Member since {memberSince}</div>
                  {currentStreak > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                      <span style={{ fontSize: 16 }}>&#128293;</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{currentStreak} day streak</span>
                    </div>
                  )}
                </div>
              </div>

              {[
                { label: "Display name", value: name, set: setName, type: "text" },
                { label: "Email", value: email, set: setEmail, type: "email" },
              ].map(f => (
                <div key={f.label} style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>{f.label}</label>
                  <input
                    type={f.type} value={f.value}
                    onChange={e => f.set(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 14px",
                      background: "var(--bg-surface)", border: "1.5px solid var(--border)",
                      borderRadius: "var(--radius-md)", color: "var(--text-primary)",
                      fontSize: 14, outline: "none", fontFamily: "var(--font-body)",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={e => (e.target.style.borderColor = "var(--accent)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border)")}
                  />
                </div>
              ))}

              <button onClick={save} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 20px", borderRadius: "var(--radius-md)",
                background: saved ? "var(--green)" : "var(--accent)",
                color: "#fff", border: "none", fontSize: 14, fontWeight: 600,
                cursor: "pointer", transition: "background 0.2s",
              }}>
                <Save size={14} /> {saved ? "Saved!" : "Save changes"}
              </button>
            </div>
          )}

          {active === "notifs" && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 22 }}>Notifications</h2>
              {[
                { label: "Daily learning reminder", sub: "Remind me to keep my streak alive", on: true },
                { label: "New resources available", sub: "When the curator agent finds new content", on: true },
                { label: "Assessment due", sub: "When a quiz or project is ready", on: true },
                { label: "Agent suggestions", sub: "Proactive tips from the curriculum agent", on: false },
                { label: "Weekly progress report", sub: "Summary of completed nodes and confidence", on: true },
              ].map((item, i) => (
                <Toggle key={i} label={item.label} sub={item.sub} defaultOn={item.on} />
              ))}
            </div>
          )}

          {active === "display" && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 22 }}>Display preferences</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  { label: "Show confidence scores on roadmap nodes", on: true },
                  { label: "Animate node unlocks", on: true },
                  { label: "Show estimated hours on nodes", on: true },
                  { label: "Compact sidebar", on: false },
                ].map((item, i) => (
                  <Toggle key={i} label={item.label} sub="" defaultOn={item.on} />
                ))}
              </div>
            </div>
          )}

          {active === "account" && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 22 }}>Account</h2>
              <div style={{ padding: "16px", borderRadius: "var(--radius-md)", background: "var(--amber-dim)", border: "1px solid #f5c36a", marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--amber)", marginBottom: 4 }}>Free plan</div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>You are on the free tier. Upgrade to Pro for unlimited roadmaps and priority agent processing.</p>
              </div>
              <button style={{
                padding: "10px 20px", borderRadius: "var(--radius-md)",
                background: "var(--accent)", color: "#fff", border: "none",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                boxShadow: "0 2px 8px rgba(232,82,10,0.3)",
              }}>Upgrade to Pro</button>
            </div>
          )}

          {active === "debug" && (
            <DebugProfileView />
          )}
        </div>
      </div>
    </div>
  );
}

function DebugProfileView() {
  const { roadmaps } = useApp();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string>("");

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await api.getLearnerProfile();
      setProfile(data);
    } catch (e) {
      console.error("Failed to fetch learner profile:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (roadmaps.length > 0 && !selectedRoadmapId) {
      setSelectedRoadmapId(roadmaps[0].id);
    }
  }, [roadmaps, selectedRoadmapId]);

  const roadmapSummary = profile?.roadmapSummaries?.[selectedRoadmapId] || "No summary generated for this roadmap yet.";
  const filteredLogs = (profile?.detailedLogs || []).filter((log: any) => log.roadmapId === selectedRoadmapId);
  const filteredConcepts = (profile?.concepts || []).filter((c: any) => c.roadmapId === selectedRoadmapId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, height: "100%", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-display)" }}>Learner Profile Debugger</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Inspect and trace your active learning footprint and agent memories</p>
        </div>
        <button
          onClick={fetchProfile}
          disabled={loading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)", padding: "8px 16px",
            fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
            color: "var(--text-secondary)", boxShadow: "var(--shadow-sm)", transition: "all 0.15s",
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.borderColor = "var(--accent)"; }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} style={{ marginRight: 2 }} />
          Refresh Profile
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200, flexDirection: "column", gap: 12 }}>
          <RefreshCw size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading profile data...</span>
        </div>
      ) : !profile ? (
        <div style={{ padding: 40, textAlign: "center", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1.5px dashed var(--border)", color: "var(--text-muted)" }}>
          No profile available. Start studying to compile your profile!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
            <div style={{ background: "var(--bg-surface)", padding: 20, borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                Inspect Roadmap Progression
              </label>
              <select
                value={selectedRoadmapId}
                onChange={e => setSelectedRoadmapId(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px",
                  background: "var(--bg-card)", border: "1.5px solid var(--border)",
                  borderRadius: "var(--radius-md)", color: "var(--text-primary)",
                  fontSize: 14, outline: "none", fontFamily: "var(--font-body)",
                  cursor: "pointer", transition: "border-color 0.15s",
                }}
                onFocus={e => e.currentTarget.style.borderColor = "var(--accent)"}
                onBlur={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                {roadmaps.map(r => (
                  <option key={r.id} value={r.id}>{r.topic}</option>
                ))}
              </select>
            </div>

            <div style={{ background: "var(--bg-surface)", padding: 20, borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", minHeight: 104 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>Compiled Preferences & Style</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(profile.generalPreferences || []).length === 0 ? (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No preferences compiled yet.</span>
                ) : (
                  profile.generalPreferences.map((pref: string, idx: number) => (
                    <span key={idx} style={{
                      fontSize: 11.5, padding: "5px 12px", borderRadius: 16,
                      background: "var(--accent-light)", color: "var(--accent)",
                      border: "1px solid var(--accent-dim)", fontWeight: 600,
                    }}>{pref}</span>
                  ))
                )}
              </div>
            </div>
          </div>

          {selectedRoadmapId ? (
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{
                  background: "var(--bg-card)", padding: 24, borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border)", borderLeft: "5px solid var(--accent)",
                  boxShadow: "var(--shadow-card)", maxHeight: 250, overflowY: "auto",
                }}>
                  <h4 style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 12px 0", letterSpacing: "0.02em", textTransform: "uppercase" }}>Roadmap Progression Summary</h4>
                  <p style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>
                    "{roadmapSummary}"
                  </p>
                </div>

                <div style={{ background: "var(--bg-card)", padding: 24, borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                  <h4 style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 16px 0", letterSpacing: "0.02em", textTransform: "uppercase" }}>Concept Mastery Log</h4>
                  {filteredConcepts.length === 0 ? (
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>No concepts logged for this topic yet.</span>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
                      {filteredConcepts.map((c: any, idx: number) => {
                        const isMastered = c.status === "mastered";
                        return (
                          <div key={idx} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "10px 14px", background: "var(--bg-surface)",
                            border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.concept}</span>
                            <span style={{
                              fontSize: 11, fontWeight: 700,
                              color: isMastered ? "var(--green)" : "var(--red)",
                              background: isMastered ? "var(--green-dim)" : "var(--red-dim)",
                              border: `1px solid ${isMastered ? "var(--green-dim)" : "var(--red-dim)"}`,
                              padding: "4px 10px", borderRadius: 12,
                            }}>
                              {c.status.toUpperCase()} ({c.masteryScore}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div style={{
                background: "var(--bg-card)", padding: 24, borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border)", boxShadow: "var(--shadow-card)",
                display: "flex", flexDirection: "column", maxHeight: 680,
              }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 18px 0", letterSpacing: "0.02em", textTransform: "uppercase" }}>Recent Assessment Logs</h4>
                {filteredLogs.length === 0 ? (
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>No assessment logs recorded for this topic yet.</span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", paddingRight: 4 }}>
                    {filteredLogs.map((log: any, idx: number) => {
                      const isPassing = log.score >= 80;
                      return (
                        <div key={idx} style={{
                          padding: 16, background: "var(--bg-surface)",
                          border: "1px solid var(--border)",
                          borderLeft: `4px solid ${isPassing ? "var(--green)" : "var(--red)"}`,
                          borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 10,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{log.taskName}</span>
                            <span style={{
                              fontWeight: 800, fontSize: 13,
                              color: isPassing ? "var(--green)" : "var(--red)",
                              background: isPassing ? "var(--green-dim)" : "var(--red-dim)",
                              padding: "2px 8px", borderRadius: 4,
                            }}>{log.score}%</span>
                          </div>
                          {log.detectedGaps?.length > 0 && (
                            <div style={{ fontSize: 12 }}>
                              <strong style={{ color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Detected Gaps:</strong>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {log.detectedGaps.map((gap: string, i: number) => (
                                  <span key={i} style={{ padding: "2px 8px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-muted)", fontSize: 11 }}>{gap}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {log.specificMistakes?.length > 0 && (
                            <div style={{ fontSize: 12, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                              <strong style={{ color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Specific Mistakes:</strong>
                              <ul style={{ margin: 0, paddingLeft: 16, color: "var(--text-muted)", lineHeight: 1.4 }}>
                                {log.specificMistakes.map((mistake: string, i: number) => (
                                  <li key={i} style={{ marginBottom: 2 }}>{mistake}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)" }}>
              No roadmaps available to inspect.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Toggle({ label, sub, defaultOn }: { label: string; sub: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        onClick={() => setOn(o => !o)}
        style={{
          width: 42, height: 24, borderRadius: 12, border: "none",
          background: on ? "var(--accent)" : "var(--border-strong)",
          cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: "50%", background: "#fff",
          position: "absolute", top: 3, left: on ? 21 : 3,
          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
    </div>
  );
}