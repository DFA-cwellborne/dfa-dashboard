import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Sidebar } from "@/components/layout/Sidebar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DFA Metrics Dashboard",
  description: "Dream for America — national chapter metrics dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex h-full min-h-screen bg-background">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
