import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = {
  title: "Wayv Clipping Platform",
  description:
    "A marketplace where brands run paid clipping campaigns and creators submit short-form clips across TikTok, Instagram and YouTube.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>
          <div className="app-shell">
            <TopBar />
            <main className="main-content">{children}</main>
          </div>
        </TRPCProvider>
      </body>
    </html>
  );
}
