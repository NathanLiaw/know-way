"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { clerkAuthEnabled } from "@/lib/api";

export default function ClerkRootProvider({ children }: { children: React.ReactNode }) {
  if (!clerkAuthEnabled) {
    return <>{children}</>;
  }

  return <ClerkProvider>{children}</ClerkProvider>;
}
