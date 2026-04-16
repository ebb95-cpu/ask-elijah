import type { Metadata, Viewport } from "next";
import "./globals.css";
import NewAnswerNotification from "@/components/NewAnswerNotification";
import PostHogProvider from "@/components/PostHogProvider";
import ErrorCatcher from "@/components/ErrorCatcher";
import dynamic from "next/dynamic";

// Dynamic import with SSR off — ensures the bottom nav only loads client-side
// and a load failure can't crash the server render. If the component itself
// throws at runtime (e.g. usePathname edge case on older Safari), the dynamic
// wrapper catches it and renders nothing instead of killing the whole page.
const MobileBottomNavSafe = dynamic(
  () => import("@/components/ui/MobileBottomNav"),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "Ask Elijah — Submit one question. Get a personal answer from an NBA Champion.",
  description: "Every athlete trains their body. Almost none train their mind. Elijah Bryant — NBA + EuroLeague Champion — answers your question personally.",
  openGraph: {
    title: "Ask Elijah — Submit one question. Get a personal answer from an NBA Champion.",
    description: "Every athlete trains their body. Almost none train their mind. Elijah Bryant — NBA + EuroLeague Champion — answers your question personally.",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Ask Elijah",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  // Allow zoom for accessibility — we fix iOS auto-zoom by using 16px inputs
  maximumScale: 5,
  userScalable: true,
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
          <ErrorCatcher />
          {children}
          <NewAnswerNotification />
          <MobileBottomNavSafe />
        </PostHogProvider>
      </body>
    </html>
  );
}
