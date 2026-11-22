import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "班級桌面看板",
  description: "輕量級 Windows 桌面透明疊加班級通知與功課看板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="font-sans antialiased text-slate-800">{children}</body>
    </html>
  );
}
