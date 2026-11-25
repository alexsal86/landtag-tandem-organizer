import { render } from "@testing-library/react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { describe, expect, it } from "vitest";
import { MentionsPlugin } from "./MentionsPlugin";

const initialConfig = {
  namespace: "mentions-plugin-tenant-guard",
  onError: (error: Error) => {
    throw error;
  },
};

describe("MentionsPlugin ohne Tenant-Kontext", () => {
  it("wirft nicht und bietet kein Personenmenü an", () => {
    expect(() =>
      render(
        <LexicalComposer initialConfig={initialConfig}>
          <MentionsPlugin />
        </LexicalComposer>,
      ),
    ).not.toThrow();

    expect(document.querySelector(".mentions-menu")).toBeNull();
    expect(document.querySelector('[role="option"]')).toBeNull();
  });
});
