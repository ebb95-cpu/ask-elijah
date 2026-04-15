import type { Metadata, Viewport } from "next";
import "./globals.css";
import NewAnswerNotification from "@/components/NewAnswerNotification";
import PostHogProvider from "@/components/PostHogProvider";

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
          {children}
          <NewAnswerNotification />
        </PostHogProvider>
      </body>
    </html>
  );
}
