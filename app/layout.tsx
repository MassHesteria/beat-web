import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "beat",
  description: "A binary patching tool using the beat file format",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
