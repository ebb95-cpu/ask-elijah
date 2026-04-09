import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ask Elijah",
  description: "Ask what no coach has time to answer.",
  openGraph: {
    title: "Ask Elijah",
    description: "Ask what no coach has time to answer.",
    type: "website",
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
