import { describe, expect, it } from "vitest";
import { detectMapping } from "./field-mapping";

describe("detectMapping", () => {
  it("別名の一致する列を自動検出する", () => {
    const mapping = detectMapping(["姓", "名", "メールアドレス", "大学名"]);
    expect(mapping).toEqual({
      last_name: "姓",
      first_name: "名",
      email: "メールアドレス",
      school_name: "大学名",
    });
  });

  it("英語の列名・大文字小文字の違いも検出する", () => {
    const mapping = detectMapping(["Last_Name", "First Name", "Email"]);
    expect(mapping).toEqual({
      last_name: "Last_Name",
      first_name: "First Name",
      email: "Email",
    });
  });

  it("一致する列が無い項目はマッピングに含まれない", () => {
    const mapping = detectMapping(["謎の列1", "謎の列2"]);
    expect(mapping).toEqual({});
  });

  it("同じ列が複数の項目に重複して割り当てられない", () => {
    const mapping = detectMapping(["email", "mail"]);
    expect(mapping.email).toBe("email");
    expect(Object.values(mapping)).not.toContain("mail");
  });
});
