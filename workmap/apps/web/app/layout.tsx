import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./workspace-redesign.css";

export const metadata: Metadata = {
  title: "WorkMap",
  description: "2D virtual office and compliant work visibility platform"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
