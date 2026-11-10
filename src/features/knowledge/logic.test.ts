import { describe, expect, it } from "vitest";
import {
  answerExcerpt,
  answerText,
  effectiveReviewStatus,
  parseAnswer,
  validateAttachment,
  validateQuestion,
} from "./logic";
import type { Json } from "@/integrations/supabase/types";

const document = (children: Json[]): Json => ({
  root: { type: "root", children: [{ type: "paragraph", children }] },
});
describe("shared office knowledge rules", () => {
  it("needs only a question and permits an empty optional description", () => {
    expect(validateQuestion("Wie beantrage ich Urlaub?", "")).toBeNull();
    expect(validateQuestion("   ", "")).toBeTruthy();
    expect(validateQuestion("a".repeat(301), "")).toBeTruthy();
    expect(validateQuestion("Frage", "x".repeat(10001))).toBeTruthy();
  });
  it("derives searchable text from the same structured content that is displayed", () => {
    const content = document([
      { type: "text", text: "Infos: " },
      {
        type: "link",
        url: "https://example.test",
        children: [{ type: "text", text: "Bürohandbuch" }],
      },
    ]);
    expect(answerText(content)).toBe("Infos: Bürohandbuch");
    expect(parseAnswer(JSON.stringify(content))).toEqual(content);
    expect(() =>
      parseAnswer(JSON.stringify(document([{ type: "text", text: "  " }]))),
    ).toThrow();
  });
  it("rejects unsafe links, unsupported nodes and malformed trees", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,hello",
      "https://example.test\nscript",
    ]) {
      expect(() =>
        answerText(
          document([
            { type: "link", url, children: [{ type: "text", text: "Klick" }] },
          ]),
        ),
      ).toThrow();
    }
    expect(() =>
      answerText(
        document([{ type: "image", src: "https://public.test/file" }]),
      ),
    ).toThrow();
    expect(() =>
      answerText(
        document([
          {
            type: "heading",
            tag: "script",
            children: [{ type: "text", text: "alert(1)" }],
          },
        ]),
      ),
    ).toThrow();
    expect(() =>
      answerText(
        document([
          {
            type: "text",
            text: "Text",
            style: "background-image:url(https://external.test)",
          },
        ]),
      ),
    ).toThrow();
    expect(() =>
      answerText({ root: { type: "paragraph", children: [] } }),
    ).toThrow();
  });
  it("marks a review due at the exact boundary, without needing a scheduler", () => {
    const question = {
      review_status: "verified",
      review_due_at: "2026-11-10T12:00:00Z",
    };
    expect(
      effectiveReviewStatus(question, Date.parse("2026-11-10T11:59:59Z")),
    ).toBe("verified");
    expect(
      effectiveReviewStatus(question, Date.parse("2026-11-10T12:00:00Z")),
    ).toBe("needs_review");
    expect(
      effectiveReviewStatus({
        review_status: "needs_review",
        review_due_at: null,
      }),
    ).toBe("needs_review");
    expect(
      effectiveReviewStatus({
        review_status: "unverified",
        review_due_at: null,
      }),
    ).toBe("unverified");
  });
  it("accepts private attachments within the bucket limits", () => {
    expect(
      validateAttachment({
        name: "Antwort.pdf",
        type: "application/pdf",
        size: 1024,
      }),
    ).toBeNull();
    expect(
      validateAttachment({
        name: "script.html",
        type: "text/html",
        size: 1024,
      }),
    ).toBeTruthy();
    expect(
      validateAttachment({
        name: "gross.pdf",
        type: "application/pdf",
        size: 21 * 1024 * 1024,
      }),
    ).toBeTruthy();
    expect(
      validateAttachment({
        name: "leer.pdf",
        type: "application/pdf",
        size: 0,
      }),
    ).toBeTruthy();
  });
  it("returns a bounded text excerpt around the search word", () => {
    const text =
      "x".repeat(300) + " Urlaub beim Büro beantragen " + "y".repeat(300);
    const excerpt = answerExcerpt(text, "Urlaub");
    expect(excerpt).toContain("Urlaub");
    expect(excerpt.length).toBeLessThan(230);
  });
});

import { knowledgeUrlState } from "./logic";
it("restores only whitelisted views, filters and ordering from the URL", () => {
  expect(
    knowledgeUrlState(
      new URLSearchParams(
        "ansicht=assigned&status=open&zustaendig=unassigned&sortierung=oldest",
      ),
    ),
  ).toEqual({
    view: "assigned",
    filters: { status: "open", assignee: "unassigned", sort: "oldest" },
  });
  expect(knowledgeUrlState(new URLSearchParams("ansicht=review")).view).toBe(
    "review",
  );
  expect(
    knowledgeUrlState(
      new URLSearchParams(
        "ansicht=bad&status=bad&zustaendig=bad&sortierung=bad",
      ),
    ),
  ).toEqual({
    view: "answers",
    filters: { status: "", assignee: "", sort: "updated" },
  });
});
