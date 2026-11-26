import { describe, expect, it } from "vitest";
import {
  canAddTopic,
  canCreateTopic,
  normalizeTopicModuleRule,
  validateTopicSelection,
} from "./moduleRules";

describe("topic module rules", () => {
  it("falls back to the previous behaviour without a stored row", () => {
    expect(normalizeTopicModuleRule(null)).toEqual({
      isEnabled: true,
      requirement: "optional",
      maxTopics: 5,
      creationPolicy: "admins",
      showFilter: true,
    });
  });

  it("normalizes required and member-created topics", () => {
    expect(
      normalizeTopicModuleRule({
        is_enabled: true,
        requirement: "required",
        max_topics: 2,
        creation_policy: "members",
        show_filter: false,
      }),
    ).toEqual({
      isEnabled: true,
      requirement: "required",
      maxTopics: 2,
      creationPolicy: "members",
      showFilter: false,
    });
  });

  it("enforces maximum, required and creation policy", () => {
    const rule = normalizeTopicModuleRule({
      is_enabled: true,
      requirement: "required",
      max_topics: 2,
      creation_policy: "admins",
      show_filter: true,
    });
    expect(canAddTopic(1, rule)).toBe(true);
    expect(canAddTopic(2, rule)).toBe(false);
    expect(canCreateTopic(rule, false)).toBe(false);
    expect(canCreateTopic(rule, true)).toBe(true);
    expect(validateTopicSelection(0, rule)).toBe(
      "Bitte mindestens ein Thema auswählen.",
    );
    expect(validateTopicSelection(3, rule)).toBe(
      "Höchstens 2 Themen pro Eintrag.",
    );
    expect(validateTopicSelection(1, rule)).toBeNull();
  });

  it("disables all topic actions for a disabled module", () => {
    const rule = normalizeTopicModuleRule({
      is_enabled: false,
      requirement: "optional",
      max_topics: 5,
      creation_policy: "members",
      show_filter: false,
    });
    expect(canAddTopic(0, rule)).toBe(false);
    expect(canCreateTopic(rule, true)).toBe(false);
    expect(validateTopicSelection(0, rule)).toBe(
      "Themen sind für dieses Modul deaktiviert.",
    );
  });
});
