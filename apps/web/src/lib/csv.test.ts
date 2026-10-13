import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("BOM付きでヘッダーとデータ行を出力する", () => {
    const csv = toCsv(
      [{ name: "山田太郎", age: 22 }],
      [
        { key: "name", label: "氏名" },
        { key: "age", label: "年齢" },
      ]
    );
    expect(csv).toBe("﻿氏名,年齢\r\n山田太郎,22");
  });

  it("カンマ・改行・ダブルクォートを含む値をクォートしてエスケープする", () => {
    const csv = toCsv(
      [{ note: 'a,b\n"c"' }],
      [{ key: "note", label: "メモ" }]
    );
    expect(csv).toBe('﻿メモ\r\n"a,b\n""c"""');
  });

  it("null/undefinedは空文字として扱う", () => {
    const csv = toCsv(
      [{ value: null }, { value: undefined }],
      [{ key: "value", label: "値" }]
    );
    expect(csv).toBe("﻿値\r\n\r\n");
  });

  it("行が0件でもヘッダーだけ出力する", () => {
    const csv = toCsv([], [{ key: "name", label: "氏名" }]);
    expect(csv).toBe("﻿氏名");
  });
});
