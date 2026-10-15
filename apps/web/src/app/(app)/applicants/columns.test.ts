import { describe, expect, it } from "vitest";
import { DEFAULT_APPLICANT_COLUMN_ORDER, parseColumnOrder } from "./columns";

describe("parseColumnOrder", () => {
  it("配列でなければ既定の並び順を返す", () => {
    expect(parseColumnOrder(null)).toEqual(DEFAULT_APPLICANT_COLUMN_ORDER);
    expect(parseColumnOrder(undefined)).toEqual(DEFAULT_APPLICANT_COLUMN_ORDER);
    expect(parseColumnOrder("email")).toEqual(DEFAULT_APPLICANT_COLUMN_ORDER);
  });

  it("有効なキーのみを順序通りに取り出す", () => {
    expect(parseColumnOrder(["school", "email"])).toEqual(["school", "email"]);
  });

  it("未知のキーは除外する", () => {
    expect(parseColumnOrder(["email", "unknown_key", "school"])).toEqual(["email", "school"]);
  });

  it("重複したキーは最初の1件のみ残す", () => {
    expect(parseColumnOrder(["email", "school", "email"])).toEqual(["email", "school"]);
  });

  it("空配列は「すべて非表示」として尊重する(既定にフォールバックしない)", () => {
    expect(parseColumnOrder([])).toEqual([]);
  });

  it("文字列以外の要素は除外する", () => {
    expect(parseColumnOrder(["email", 123, null, "school"])).toEqual(["email", "school"]);
  });
});
