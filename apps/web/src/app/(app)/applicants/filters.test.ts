import { describe, expect, it } from "vitest";
import { buildApplicantWhere, parseApplicantFilters } from "./filters";

describe("parseApplicantFilters", () => {
  it("未指定ならすべて空になる", () => {
    expect(parseApplicantFilters({})).toEqual({
      q: undefined,
      schoolId: undefined,
      tagIds: [],
      stageId: undefined,
      mediaId: undefined,
      applicantType: undefined,
      positionType: undefined,
      callStatus: undefined,
    });
  });

  it("各パラメータを取り出す", () => {
    const filters = parseApplicantFilters({
      q: " 山田 ",
      school_id: "school-1",
      tag_ids: ["tag-1", "tag-2"],
      stage_id: "stage-1",
      media_id: "media-1",
      applicant_type: "new_grad",
      position_type: "sogo",
      call_status: "callback_needed",
    });
    expect(filters).toEqual({
      q: "山田",
      schoolId: "school-1",
      tagIds: ["tag-1", "tag-2"],
      stageId: "stage-1",
      mediaId: "media-1",
      applicantType: "new_grad",
      positionType: "sogo",
      callStatus: "callback_needed",
    });
  });

  it("tag_idsが単一文字列でも配列として扱う", () => {
    expect(parseApplicantFilters({ tag_ids: "tag-1" }).tagIds).toEqual(["tag-1"]);
  });

  it("空白のみの値は未指定として扱う", () => {
    expect(parseApplicantFilters({ q: "   " }).q).toBeUndefined();
  });
});

describe("buildApplicantWhere", () => {
  it("条件が無ければ空のwhereになる", () => {
    expect(buildApplicantWhere({ tagIds: [] })).toEqual({});
  });

  it("氏名検索は姓・名・カナのOR条件になる", () => {
    const where = buildApplicantWhere({ q: "山田", tagIds: [] });
    expect(where.OR).toEqual([
      { last_name: { contains: "山田", mode: "insensitive" } },
      { first_name: { contains: "山田", mode: "insensitive" } },
      { last_name_kana: { contains: "山田", mode: "insensitive" } },
      { first_name_kana: { contains: "山田", mode: "insensitive" } },
    ]);
  });

  it("タグは複数指定時にOR(in)条件になる", () => {
    const where = buildApplicantWhere({ tagIds: ["tag-1", "tag-2"] });
    expect(where.tags).toEqual({ some: { tag_id: { in: ["tag-1", "tag-2"] } } });
  });

  it("学校・ステージ・媒体・応募者区分・職種区分・架電状況をそれぞれ指定できる", () => {
    const where = buildApplicantWhere({
      tagIds: [],
      schoolId: "school-1",
      stageId: "stage-1",
      mediaId: "media-1",
      applicantType: "existing_grad",
      positionType: "sogo",
      callStatus: "no_answer",
    });
    expect(where).toEqual({
      school_id: "school-1",
      selection: { current_stage_id: "stage-1" },
      sources: { some: { media_id: "media-1" } },
      applicant_type: "existing_grad",
      position_type: "sogo",
      call_status: "no_answer",
    });
  });

  it("すべての条件を組み合わせられる", () => {
    const where = buildApplicantWhere({
      q: "太郎",
      schoolId: "school-1",
      tagIds: ["tag-1"],
      stageId: "stage-1",
      mediaId: "media-1",
      applicantType: "new_grad",
      positionType: "gino",
      callStatus: "callback_needed",
    });
    expect(Object.keys(where).sort()).toEqual(
      [
        "OR",
        "school_id",
        "tags",
        "selection",
        "sources",
        "applicant_type",
        "position_type",
        "call_status",
      ].sort()
    );
  });
});
