"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Question = {
  id: string;
  type: "text" | "single_choice" | "multi_choice";
  label: string;
  options?: string[];
};

type SurveyData = {
  title: string;
  description: string | null;
  questions: Question[];
  alreadySubmitted: boolean;
  answers: Record<string, string | string[]> | null;
};

type LoadState = "loading" | "ready" | "error" | "submitted";

export default function SurveyPage() {
  return (
    <Suspense>
      <SurveyContent />
    </Suspense>
  );
}

function SurveyContent() {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get("surveyId");
  const idTokenRef = useRef<string | null>(null);
  const [state, setState] = useState<LoadState>(surveyId ? "loading" : "error");
  const [errorMessage, setErrorMessage] = useState(surveyId ? "" : "リンクが正しくありません。");
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!surveyId) return;
    let cancelled = false;

    async function run() {
      try {
        const liff = (await import("@line/liff")).default;
        const liffId = process.env.NEXT_PUBLIC_SURVEY_LIFF_ID;
        if (!liffId) throw new Error("LIFF設定が未完了です");

        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const idToken = liff.getIDToken();
        if (!idToken) throw new Error("LINEログイン情報を取得できませんでした");
        idTokenRef.current = idToken;

        const res = await fetch(`/api/survey/${surveyId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "アンケートの取得に失敗しました");
        }
        const body = (await res.json()) as SurveyData;
        if (cancelled) return;
        setSurvey(body);
        setValues(body.answers ?? {});
        setState("ready");
      } catch (e) {
        if (!cancelled) {
          setErrorMessage(e instanceof Error ? e.message : "アンケートの取得に失敗しました");
          setState("error");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [surveyId]);

  async function handleSubmit() {
    const idToken = idTokenRef.current;
    if (!idToken || !survey || !surveyId) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const answers = survey.questions.map((q) => ({
        questionId: q.id,
        value: values[q.id] ?? (q.type === "multi_choice" ? [] : ""),
      }));
      const res = await fetch(`/api/survey/${surveyId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "送信に失敗しました");
      }
      setState("submitted");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (state === "loading") return <CenteredMessage text="読み込み中..." />;
  if (state === "error") return <CenteredMessage text={errorMessage} isError />;
  if (state === "submitted") return <CenteredMessage text="ご回答ありがとうございました。" />;
  if (!survey) return null;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-background p-4">
      <div>
        <h1 className="text-base font-bold text-foreground">{survey.title}</h1>
        {survey.description && (
          <p className="mt-1 text-xs text-muted-foreground">{survey.description}</p>
        )}
      </div>

      {survey.alreadySubmitted && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          回答済みです。内容を変更すると上書きされます。
        </p>
      )}

      {survey.questions.map((question) => (
        <div key={question.id} className="rounded-lg border border-border bg-card p-4">
          <p className="mb-2 text-xs font-bold text-foreground">{question.label}</p>
          {question.type === "text" && (
            <textarea
              value={(values[question.id] as string) ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [question.id]: e.target.value }))}
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
              rows={3}
            />
          )}
          {question.type === "single_choice" &&
            question.options?.map((option) => (
              <label key={option} className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="radio"
                  name={question.id}
                  checked={values[question.id] === option}
                  onChange={() => setValues((prev) => ({ ...prev, [question.id]: option }))}
                />
                {option}
              </label>
            ))}
          {question.type === "multi_choice" &&
            question.options?.map((option) => {
              const selected = Array.isArray(values[question.id])
                ? (values[question.id] as string[])
                : [];
              return (
                <label key={option} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(option)}
                    onChange={(e) => {
                      setValues((prev) => {
                        const current = Array.isArray(prev[question.id])
                          ? (prev[question.id] as string[])
                          : [];
                        return {
                          ...prev,
                          [question.id]: e.target.checked
                            ? [...current, option]
                            : current.filter((v) => v !== option),
                        };
                      });
                    }}
                  />
                  {option}
                </label>
              );
            })}
        </div>
      ))}

      {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full rounded-md bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {isSubmitting ? "送信中..." : "回答を送信"}
      </button>
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
