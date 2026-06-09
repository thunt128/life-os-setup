import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Operator — Life OS",
  description: "A personal life operating system.",
};

export const viewport: Viewport = {
  themeColor: "#0a0c0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-mono antialiased">{children}</body>
    </html>
  );
}
