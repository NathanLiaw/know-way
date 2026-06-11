"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard, Map, ClipboardCheck, Settings, Calendar } from "lucide-react";
import LogoMark from "@/components/brand/LogoMark";
import AppWordmark from "@/components/brand/AppWordmark";
import { clerkAuthEnabled } from "@/lib/api";
import { useApp } from "@/lib/app-context";

const navItems = [
  { href: "/dashboard",  icon: LayoutDashboard, label: "Dashboard"   },
  { href: "/roadmap",    icon: Map,              label: "Roadmaps"    },
  { href: "/planner",    icon: Calendar,         label: "Planner"     },
  { href: "/assessment", icon: ClipboardCheck,   label: "Assessments" },
  { href: "/settings",   icon: Settings,         label: "Settings"    },
];


export default function Sidebar() {
  const pathname = usePathname();
  const { user, stats } = useApp();
  const streak = user?.streak ?? stats?.streak ?? 0;

  return (
    <aside style={{
      width: 240, minHeight: "100vh",
      background: "var(--bg-card)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      padding: "0 0 24px 0", flexShrink: 0,
      boxShadow: "2px 0 12px rgba(80,50,10,0.04)",
    }}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div
            aria-label="Know-Way"
            style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(232,82,10,0.35)",
            }}
          >
            <LogoMark size={18} />
          </div>
          <AppWordmark size="sm" />
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "14px 10px", flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 12px", marginBottom: 8 }}>Menu</div>
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", borderRadius: "var(--radius-md)",
              marginBottom: 2,
              background: active ? "var(--accent-light)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-secondary)",
              textDecoration: "none", fontSize: 14,
              fontWeight: active ? 600 : 400,
              transition: "all 0.15s",
              borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent",
            }}
            onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}}
            onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Streak chip */}
      <div style={{ padding: "0 10px", marginBottom: 12 }}>
        <div style={{
          padding: "10px 14px", borderRadius: "var(--radius-md)",
          background: "linear-gradient(135deg, #fdf2f2 0%, #f3efe9 100%)",
          border: "1px solid #e0d9cf",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>🔥</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{streak} day streak</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{streak > 0 ? "Keep it going!" : "Start learning today!"}</div>
          </div>
        </div>
      </div>

      {/* Account */}
      <div style={{ padding: "0 10px", display: "flex", alignItems: "center", gap: 10 }}>
        {clerkAuthEnabled ? (
          <>
            <UserButton afterSignOutUrl="/sign-in" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.name ?? "Account"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.email ?? ""}
              </div>
            </div>
          </>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, flex: 1,
            padding: "10px 12px", borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)", background: "var(--bg-surface)",
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--accent) 0%, #f08040 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "#fff",
            }}>
              {(user?.name ?? "U").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.name ?? "Demo user"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Local dev (no auth)</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}