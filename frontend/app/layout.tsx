import type { Metadata } from "next";
import ClerkRootProvider from "@/components/providers/ClerkRootProvider";
import { AppProvider } from "@/lib/app-context";
import ClientLayout from "@/components/layout/ClientLayout";
import "./globals.css";

export const metadata: Metadata = {
  title: "Know-Way",
  description: "You Can't Know What You Don't Know",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkRootProvider>
          <AppProvider>
            <ClientLayout>{children}</ClientLayout>
          </AppProvider>
        </ClerkRootProvider>
      </body>
    </html>
  );
}
