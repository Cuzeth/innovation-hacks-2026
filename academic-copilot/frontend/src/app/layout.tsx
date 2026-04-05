import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Academic Copilot for ASU",
  description:
    "AI-powered academic advisor — degree audit, graduation planning, schedule optimization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
