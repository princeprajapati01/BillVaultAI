import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MainContent from "@/components/MainContent";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BillVault AI - AI-Powered Invoice Management",
  description: "Enterprise-grade AI invoice management admin dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 antialiased`}>
        <div className="min-h-screen">
          <Sidebar />
          <Header />
          <MainContent>
            {children}
          </MainContent>
        </div>
      </body>
    </html>
  );
}
