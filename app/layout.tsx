import type { Metadata, Viewport } from "next";
import "./globals.css";
import ErrorCatcher from "@/components/ErrorCatcher";

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
        {/* ErrorCatcher is pure (just listeners, no UI, no storage). Restored
            so any remaining crash is captured to the error_log table instead
            of being invisible. The other globals (PostHogProvider,
            MobileBottomNav, NewAnswerNotification) stay removed — they were
            candidate culprits in the last crash hunt. */}
        <ErrorCatcher />
        {children}
      </body>
    </html>
  );
}
