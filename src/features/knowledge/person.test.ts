import { expect, it } from "vitest";
import {
  knowledgePersonColor,
  knowledgePersonForId,
  knowledgePersonInitials,
  knowledgePersonLabel,
} from "./person";

it("uses stable user-id colors and readable Unicode initials", () => {
  expect(knowledgePersonColor("user-a")).toBe(knowledgePersonColor("user-a"));
  expect(knowledgePersonColor("user-a")).not.toBe(
    knowledgePersonColor("user-b"),
  );
  expect(knowledgePersonInitials("  Änne   von Örtel  ")).toBe("ÄÖ");
  expect(knowledgePersonInitials("Mara")).toBe("M");
  expect(knowledgePersonInitials(null)).toBe("?");
  expect(knowledgePersonInitials("   ")).toBe("?");
});

it("distinguishes unassigned and missing profiles and prefers RPC data", () => {
  expect(knowledgePersonLabel(null)).toBe("Nicht zugeordnet");
  expect(
    knowledgePersonLabel({
      user_id: "former",
      display_name: null,
      avatar_url: null,
    }),
  ).toBe("Ehemaliger Mitarbeiter");
  const rpc = {
    user_id: "a",
    display_name: "Aktueller Name",
    avatar_url: "/avatar.png",
  };
  expect(
    knowledgePersonForId("a", rpc, [
      { user_id: "a", display_name: "Alter Name" },
    ]),
  ).toBe(rpc);
  expect(knowledgePersonForId(null, rpc)).toBeNull();
  expect(knowledgePersonForId("missing", null)).toEqual({
    user_id: "missing",
    display_name: null,
    avatar_url: null,
  });
});
