import { cn } from "@/lib/utils";

/** 이 지도를 운영하는 차 모임 */
export const CLUB = {
  name: "티끌",
  en: "Teaggle Club",
  handle: "teaggle.club",
  url: "https://instagram.com/teaggle.club",
  logo: "/teaggle.jpg",
} as const;

/** 인스타그램 모양 아이콘 (lucide 에는 브랜드 아이콘이 없어 직접 그림) */
export function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

/** 인스타그램으로 가는 둥근 버튼 */
export function ClubFollowButton({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <a
      href={CLUB.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-seal font-medium text-white shadow-sm transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        size === "sm" ? "h-7 px-3 text-xs" : "h-9 px-4 text-sm",
        className,
      )}
    >
      <InstagramGlyph className={size === "sm" ? "size-3.5" : "size-4"} />@{CLUB.handle}
    </a>
  );
}
