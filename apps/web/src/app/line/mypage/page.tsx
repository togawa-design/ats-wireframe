"use client";

import { useEffect, useRef, useState } from "react";

type Step = { id: string; name: string; status: "done" | "current" | "upcoming" };

type MyPageData = {
  last_name: string;
  first_name: string;
  school_name: string | null;
  department: string | null;
  phone: string | null;
  resume_url: string | null;
  photo_url: string | null;
  steps: Step[];
};

type LoadState = "loading" | "ready" | "error";

export default function MyPage() {
  const idTokenRef = useRef<string | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<MyPageData | null>(null);
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<"resume" | "photo" | null>(null);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const liff = (await import("@line/liff")).default;
        const liffId = process.env.NEXT_PUBLIC_MYPAGE_LIFF_ID;
        if (!liffId) throw new Error("LIFF設定が未完了です");

        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const idToken = liff.getIDToken();
        if (!idToken) throw new Error("LINEログイン情報を取得できませんでした");
        idTokenRef.current = idToken;

        const res = await fetch("/api/mypage/me", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "マイページの取得に失敗しました");
        }
        const body = (await res.json()) as MyPageData;
        if (cancelled) return;
        setData(body);
        setPhone(body.phone ?? "");
        setState("ready");
      } catch (e) {
        if (!cancelled) {
          setErrorMessage(e instanceof Error ? e.message : "マイページの取得に失敗しました");
          setState("error");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSavePhone() {
    const idToken = idTokenRef.current;
    if (!idToken) return;
    setIsSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch("/api/mypage/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "保存に失敗しました");
      }
      setSaveMessage("保存しました");
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpload(kind: "resume" | "photo", file: File) {
    const idToken = idTokenRef.current;
    if (!idToken) return;
    setUploadingKind(kind);
    try {
      const formData = new FormData();
      formData.set("kind", kind);
      formData.set("file", file);
      const res = await fetch("/api/mypage/documents", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "アップロードに失敗しました");
      }
      const body = (await res.json()) as { url: string };
      setData((prev) =>
        prev ? { ...prev, [kind === "resume" ? "resume_url" : "photo_url"]: body.url } : prev
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "アップロードに失敗しました");
    } finally {
      setUploadingKind(null);
    }
  }

  if (state === "loading") {
    return <CenteredMessage text="読み込み中..." />;
  }
  if (state === "error" || !data) {
    return <CenteredMessage text={errorMessage || "エラーが発生しました"} isError />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-background p-4">
      <h1 className="text-base font-bold text-foreground">マイページ</h1>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-bold text-foreground">
          {data.last_name} {data.first_name} さん
        </p>
        <p className="text-xs text-muted-foreground">
          {[data.school_name, data.department].filter(Boolean).join(" / ") || "—"}
        </p>
      </div>

      {data.steps.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-3 text-xs font-bold text-foreground">選考状況</p>
          <div className="flex items-center">
            {data.steps.map((step, i) => (
              <div key={step.id} className="flex flex-1 items-center last:flex-none">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    step.status === "done"
                      ? "bg-emerald-600 text-white"
                      : step.status === "current"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.status === "done" ? "✓" : i + 1}
                </div>
                {i < data.steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 ${step.status === "done" ? "bg-emerald-600" : "bg-muted"}`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-1 flex text-center text-[10px] text-muted-foreground">
            {data.steps.map((step) => (
              <span key={step.id} className="flex-1">
                {step.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-2 text-xs font-bold text-foreground">提出書類</p>
        <DocumentRow
          label="エントリーシート"
          note="PDF・5MB以下"
          accept="application/pdf"
          isSubmitted={!!data.resume_url}
          isUploading={uploadingKind === "resume"}
          onSelect={(file) => handleUpload("resume", file)}
        />
        <DocumentRow
          label="証明写真"
          note="JPG"
          accept="image/jpeg"
          isSubmitted={!!data.photo_url}
          isUploading={uploadingKind === "photo"}
          onSelect={(file) => handleUpload("photo", file)}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-2 text-xs font-bold text-foreground">プロフィール編集</p>
        <label className="mb-1 block text-[10.5px] text-muted-foreground">電話番号</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mb-2 w-full rounded-md border border-input px-3 py-2 text-sm"
        />
        <button
          onClick={handleSavePhone}
          disabled={isSaving}
          className="w-full rounded-md bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          変更を保存
        </button>
        {saveMessage && <p className="mt-2 text-xs text-muted-foreground">{saveMessage}</p>}
      </div>
    </div>
  );
}

function DocumentRow({
  label,
  note,
  accept,
  isSubmitted,
  isUploading,
  onSelect,
}: {
  label: string;
  note: string;
  accept: string;
  isSubmitted: boolean;
  isUploading: boolean;
  onSelect: (file: File) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
      <div className="flex-1">
        <p className="text-xs font-bold text-foreground">{label}</p>
        <p className="text-[10.5px] text-muted-foreground">{note}</p>
      </div>
      <span
        className={`text-[10.5px] font-bold ${isSubmitted ? "text-emerald-700" : "text-amber-700"}`}
      >
        {isSubmitted ? "提出済み" : "未提出"}
      </span>
      <label className="cursor-pointer text-[10.5px] font-bold text-primary">
        {isUploading ? "アップロード中..." : "選択"}
        <input
          type="file"
          accept={accept}
          className="hidden"
          disabled={isUploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSelect(file);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

function CenteredMessage({ text, isError }: { text: string; isError?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <p className={`text-sm ${isError ? "text-destructive" : "text-muted-foreground"}`}>{text}</p>
    </div>
  );
}
