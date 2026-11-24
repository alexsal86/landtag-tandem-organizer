import { describe, expect, it } from "vitest";
import { ACTION_MODULE } from "./catalog";
import { buildPermissionDiff, diffSimulation, parsePermissionExplanation } from "./explain";

const question = {
  actions: ["letter.send"],
  features: ["module.letters"],
  fields: [{ table: "contacts", column: "email" }],
};

const answer = {
  member: true,
  role: "mitarbeiter",
  simulated_role: null,
  is_superadmin: false,
  actions: [
    {
      key: "letter.send",
      allowed: true,
      reason: "Rolle Mitarbeiter ist für diese Aktion freigegeben.",
      source: "rule",
      role: "mitarbeiter",
      allowed_roles: ["mitarbeiter"],
    },
  ],
  features: [
    { key: "module.letters", enabled: false, reason: "Modul ist ausgeschaltet.", source: "tenant", role: "mitarbeiter" },
  ],
  fields: [
    {
      table: "contacts",
      column: "email",
      can_read: true,
      can_write: true,
      read_mode: "mask",
      reason: "Feld ist lesbar und schreibbar.",
      source: "field_rule",
    },
  ],
};

describe("Rechte-Explorer", () => {
  it("übernimmt Begründung, Quelle und freigegebene Rollen", () => {
    const parsed = parsePermissionExplanation(answer, question);
    expect(parsed.actions[0].reason).toContain("freigegeben");
    expect(parsed.actions[0].allowedRoles).toEqual(["mitarbeiter"]);
    expect(parsed.features[0].source).toBe("tenant");
    expect(parsed.fields[0].canWrite).toBe(true);
  });

  it("wertet fehlende Auskünfte nie als Freigabe", () => {
    const parsed = parsePermissionExplanation({ member: true }, question);
    expect(parsed.actions[0].allowed).toBe(false);
    expect(parsed.features[0].enabled).toBe(false);
    expect(parsed.fields[0].canRead).toBe(false);
    expect(parsed.actions[0].reason).toBe("Keine Auskunft erhalten.");
  });

  it("findet Aktion erlaubt bei ausgeschaltetem Modul", () => {
    const conflicts = buildPermissionDiff(parsePermissionExplanation(answer, question), ACTION_MODULE);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe("action-open-module-off:letter.send");
    expect(conflicts[0].severity).toBe("warning");
  });

  it("meldet Schreiben ohne Lesen als kritisch", () => {
    const conflicts = buildPermissionDiff(
      parsePermissionExplanation(
        { ...answer, fields: [{ ...answer.fields[0], can_read: false, can_write: true }] },
        question,
      ),
      ACTION_MODULE,
    );
    expect(conflicts.some((conflict) => conflict.severity === "critical")).toBe(true);
  });

  it("vergleicht die simulierte Rolle mit der tatsächlichen", () => {
    const actual = parsePermissionExplanation(answer, question);
    const simulated = parsePermissionExplanation(
      {
        ...answer,
        actions: [{ ...answer.actions[0], allowed: false, role: "praktikant" }],
        features: [{ ...answer.features[0], enabled: true }],
      },
      question,
    );
    const changes = diffSimulation(actual, simulated);
    expect(changes).toHaveLength(2);
    expect(changes).toEqual(
      expect.arrayContaining([
        { id: "feature:module.letters", area: "Modul", actual: "aus", simulated: "aktiv" },
        { id: "action:letter.send", area: "Aktion", actual: "erlaubt", simulated: "gesperrt" },
      ]),
    );
  });

  it("meldet keinen Widerspruch, wenn alle Ebenen zusammenpassen", () => {
    const consistent = parsePermissionExplanation(
      { ...answer, features: [{ ...answer.features[0], enabled: true }] },
      question,
    );
    expect(buildPermissionDiff(consistent, ACTION_MODULE)).toHaveLength(0);
  });
});
