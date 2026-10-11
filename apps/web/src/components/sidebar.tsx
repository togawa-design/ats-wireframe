"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  href?: string;
  icon: string;
  label: string;
};

type NavSection = {
  label: string;
  badge?: string;
  items: NavItem[];
};

// index.html のサイドバー構成に対応。STEP 0/1(認証・マスターデータ)で
// 実装済みのものだけ href を持ち、それ以外は準備中として非活性表示にする。
const SECTIONS: NavSection[] = [
  {
    label: "メイン",
    items: [
      { href: "/", icon: "📊", label: "ダッシュボード" },
      { icon: "👥", label: "応募者一覧" },
      { icon: "🔄", label: "選考管理" },
      { icon: "📅", label: "カレンダー" },
    ],
  },
  {
    label: "LINE",
    badge: "新卒のみ",
    items: [
      { icon: "💬", label: "メッセージ送信" },
      { icon: "📝", label: "アンケート" },
      { icon: "🎛️", label: "リッチメニュー" },
      { icon: "🔄", label: "自動化シナリオ" },
    ],
  },
  {
    label: "マスターデータ",
    items: [
      { href: "/masters/tags", icon: "🏷️", label: "タグ" },
      { href: "/masters/schools", icon: "🏫", label: "学校" },
      { href: "/masters/media", icon: "📱", label: "求人媒体" },
      { href: "/masters/qrcodes", icon: "📲", label: "QRコード" },
      { href: "/masters/selection-flows", icon: "🗂️", label: "選考フロー" },
    ],
  },
  {
    label: "設定",
    items: [{ icon: "⚙️", label: "システム設定" }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col overflow-y-auto bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-5 text-[15px] font-bold tracking-wide">
        フジアルテ ATS
        <span className="mt-0.5 block text-[11px] font-normal text-sidebar-ring">
          採用管理システム
        </span>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.label} className="pt-3.5 pb-1">
          <div className="flex items-center gap-1.5 px-4 pb-1.5 text-[10.5px] font-medium tracking-wide text-sidebar-ring">
            {section.label}
            {section.badge && (
              <span className="rounded-full bg-new-grad px-1.5 py-px text-[9px] text-white">
                {section.badge}
              </span>
            )}
          </div>
          {section.items.map((item) => {
            const active = item.href && pathname === item.href;
            const content = (
              <span className="flex items-center gap-2.5">
                <span>{item.icon}</span>
                {item.label}
              </span>
            );
            if (!item.href) {
              return (
                <div
                  key={item.label}
                  className="flex cursor-not-allowed items-center justify-between border-l-[3px] border-transparent px-[13px] py-2.5 text-[13px] text-sidebar-ring/60"
                  title="準備中"
                >
                  {content}
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between border-l-[3px] border-transparent px-[13px] py-2.5 text-[13px] text-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-white",
                  active &&
                    "border-l-sidebar-ring bg-sidebar-accent font-semibold text-white"
                )}
              >
                {content}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
