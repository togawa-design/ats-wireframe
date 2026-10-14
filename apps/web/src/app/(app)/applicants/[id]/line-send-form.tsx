"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { sendApplicantLineMessage } from "./line-actions";

export function LineSendForm({ applicantId }: { applicantId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await sendApplicantLineMessage(applicantId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSend} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="メッセージを入力"
          className="h-9 min-w-[200px] flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
        />
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept="image/jpeg"
          className="text-xs"
        />
        <Button type="submit" disabled={isPending} size="sm">
          送信
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
