"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSurvey, type SurveyQuestionType } from "./actions";

type DraftQuestion = { type: SurveyQuestionType; label: string; options: string };

const QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  text: "自由記述",
  single_choice: "単一選択",
  multi_choice: "複数選択",
};

function emptyQuestion(): DraftQuestion {
  return { type: "text", label: "", options: "" };
}

/** FR036: アンケートの下書きを作成するフォーム(質問を自由に追加・削除できる)。 */
export function CreateSurveyForm() {
  const router = useRouter();
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createSurvey(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      (document.getElementById("survey-create-form") as HTMLFormElement | null)?.reset();
      setQuestions([emptyQuestion()]);
    });
  }

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  return (
    <form id="survey-create-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="question_count" value={questions.length} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">タイトル</Label>
          <Input id="title" name="title" required className="w-72" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">説明(任意)</Label>
          <Input id="description" name="description" className="w-72" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {questions.map((question, i) => (
          <div key={i} className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
            <span className="text-xs font-medium text-muted-foreground">質問{i + 1}</span>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`question_label_${i}`}>内容</Label>
              <Input
                id={`question_label_${i}`}
                name={`question_label_${i}`}
                value={question.label}
                onChange={(e) => updateQuestion(i, { label: e.target.value })}
                className="w-64"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`question_type_${i}`}>回答形式</Label>
              <select
                id={`question_type_${i}`}
                name={`question_type_${i}`}
                value={question.type}
                onChange={(e) => updateQuestion(i, { type: e.target.value as SurveyQuestionType })}
                className="h-9 w-32 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {(Object.keys(QUESTION_TYPE_LABELS) as SurveyQuestionType[]).map((type) => (
                  <option key={type} value={type}>
                    {QUESTION_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            {question.type !== "text" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`question_options_${i}`}>選択肢(改行区切り)</Label>
                <textarea
                  id={`question_options_${i}`}
                  name={`question_options_${i}`}
                  value={question.options}
                  onChange={(e) => updateQuestion(i, { options: e.target.value })}
                  rows={3}
                  className="w-64 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
              </div>
            )}
            {questions.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setQuestions((prev) => prev.filter((_, idx) => idx !== i))}
              >
                この質問を削除
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
        >
          質問を追加
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          下書きとして作成
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </form>
  );
}
