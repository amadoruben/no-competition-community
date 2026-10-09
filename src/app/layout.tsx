import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "No Competition Community", template: "%s · No Competition" },
  description: "Desafios, projectos e oportunidades de investimento para quem constrói sem concorrência.",
};

export const viewport: Viewport = { themeColor: "#f6f5f0" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-PT" className={`${geist.variable} ${geistMono.variable} ${bricolage.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
