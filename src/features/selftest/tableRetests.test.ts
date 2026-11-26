import { describe, expect, it } from "vitest";
import { retestScenariosForTable } from "./tableRetests";

describe("retestScenariosForTable", () => {
  it("nennt die Selbsttests, die eine Tabelle abdecken", () => {
    expect(retestScenariosForTable("contacts")).toContain("contact-lifecycle");
  });

  it("liefert nichts für Tabellen ohne Szenario und für unbekannte Namen", () => {
    expect(retestScenariosForTable("action_permissions")).toEqual([]);
    expect(retestScenariosForTable("gibt_es_nicht")).toEqual([]);
  });
});
