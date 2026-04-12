import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ask Elijah — Train Your Mind",
  description: "Ask an NBA + EuroLeague Championships winner what's happening in your head. Personal answers in 48 hours.",
  openGraph: {
    title: "Ask Elijah — Train Your Mind",
    description: "Ask an NBA + EuroLeague Championships winner what's happening in your head. Personal answers in 48 hours.",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
