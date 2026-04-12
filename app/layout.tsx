import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ask Elijah — Submit one question. Get a personal answer from an NBA Champion.",
  description: "Every athlete trains their body. Almost none train their mind. Elijah Bryant — NBA + EuroLeague Champion — answers your question personally.",
  openGraph: {
    title: "Ask Elijah — Submit one question. Get a personal answer from an NBA Champion.",
    description: "Every athlete trains their body. Almost none train their mind. Elijah Bryant — NBA + EuroLeague Champion — answers your question personally.",
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
