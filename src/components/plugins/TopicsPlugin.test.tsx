import { render } from "@testing-library/react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { describe, expect, it } from "vitest";
import { TopicsPlugin } from "./TopicsPlugin";

const initialConfig = {
  namespace: "topics-plugin-tenant-guard",
  onError: (error: Error) => {
    throw error;
  },
};

describe("TopicsPlugin ohne Tenant-Kontext", () => {
  it("wirft nicht und bietet kein Themenmenü an", () => {
    expect(() =>
      render(
        <LexicalComposer initialConfig={initialConfig}>
          <TopicsPlugin />
        </LexicalComposer>,
      ),
    ).not.toThrow();

    expect(document.querySelector(".mentions-menu")).toBeNull();
    expect(document.querySelector('[role="option"]')).toBeNull();
  });
});
