"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "loading" | "success" | "error";

export default function LineRegisterPage() {
  return (
    <Suspense>
      <LineRegisterContent />
    </Suspense>
  );
}

function LineRegisterContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "loading" : "error");
  const [message, setMessage] = useState(
    token ? "連携処理中です..." : "リンクが正しくありません。"
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function run() {
      try {
        const liff = (await import("@line/liff")).default;
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) throw new Error("LIFF設定が未完了です");

        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const profile = await liff.getProfile();
        const res = await fetch("/api/line/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, lineUserId: profile.userId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "連携に失敗しました");
        }

        if (!cancelled) {
          setStatus("success");
          setMessage("LINE連携が完了しました。このページは閉じて問題ありません。");
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setMessage(e instanceof Error ? e.message : "連携に失敗しました");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-base font-bold text-foreground">LINE連携</h1>
        <p
          className={`text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
