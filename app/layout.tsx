import type { Metadata, Viewport } from "next";
import "./globals.css";
import ErrorCatcher from "@/components/ErrorCatcher";
import BugReportButton from "@/components/BugReportButton";
import PostHogProvider from "@/components/PostHogProvider";

export const metadata: Metadata = {
  title: "Ask Elijah",
  description: "Personal basketball mentorship from Elijah Bryant",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        <PostHogProvider>
          {/* ErrorCatcher is pure (just listeners, no UI, no storage). It stays
              mounted so any remaining crash is captured to the error_log table
              instead of being invisible. */}
          <ErrorCatcher />
          {children}
          {/* Floating "Something broken?" button. Hides itself on /admin/*
              and inside the student simulator iframe so bug reports only
              come from real users on real pages. */}
          <BugReportButton />
        </PostHogProvider>
      </body>
    </html>
  );
}
