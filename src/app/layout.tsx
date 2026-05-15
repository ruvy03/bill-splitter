import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Split — bill splitting made easy",
  description: "Split bills between any number of people with per-item shares.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-20 backdrop-blur-md bg-[color:var(--color-background)]/70 border-b border-[color:var(--color-border)]">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-flex items-center justify-center size-7 rounded-lg bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]">
                <Receipt size={16} />
              </span>
              <span>Split</span>
            </Link>
            <Link
              href="/new"
              className="btn btn-primary"
            >
              New bill
            </Link>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
