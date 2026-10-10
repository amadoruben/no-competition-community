import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "No Competition Community", template: "%s · No Competition" },
  description: "A comunidade da No Competition para quem constrói negócios em África: conteúdos exclusivos, conversas, desafios com prémios e oportunidades.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-PT" className={`${geist.variable} ${geistMono.variable} ${jakarta.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
