"use client";
import { usePathname } from "next/navigation";
import AppShell from "./AppShell";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullScreen = pathname === "/onboarding" || pathname.startsWith("/sign-");

  if (isFullScreen) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
