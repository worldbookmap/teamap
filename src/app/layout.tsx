import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Noto_Serif_KR, Noto_Serif_SC } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const sans = Noto_Sans_KR({ variable: "--font-noto-sans", subsets: ["latin"], weight: ["400", "500", "700"], preload: false });
const serif = Noto_Serif_KR({ variable: "--font-noto-serif", subsets: ["latin"], weight: ["400", "600", "700"], preload: false });
const serifSc = Noto_Serif_SC({ variable: "--font-noto-serif-sc", subsets: ["latin"], weight: ["400", "600", "700"], preload: false });

export const metadata: Metadata = {
  title: "중국 차 지도 · 中國茶地圖",
  description: "중국의 성(省)·시·현 단위 산지별로 6대 다류의 명차를 찾아보는 지도",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // 아이폰 홈 인디케이터 영역까지 고려 (safe-area-inset)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f2e8" },
    { media: "(prefers-color-scheme: dark)", color: "#2a211b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" suppressHydrationWarning className={`${sans.variable} ${serif.variable} ${serifSc.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
