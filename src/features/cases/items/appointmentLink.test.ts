import { describe, expect, it } from "vitest";
import { appendCaseSource, caseSourceHref } from "./appointmentLink";

const id = "12345678-1234-1234-1234-123456789abc";
const href = `/mywork?tab=cases&caseItemId=${id}`;

describe("Ortstermin aus Vorgang", () => {
  it("erhält Notizen und Vorgangslink auch nach Übernahme in die Terminbeschreibung", () => {
    const notes = appendCaseSource("Bitte vor Ort besprechen", id, "https://example.org");
    expect(notes).toContain("Bitte vor Ort besprechen");
    expect(caseSourceHref(notes)).toBe(href);
    expect(caseSourceHref(`Anfrage von: Bürger\n${notes}`)).toBe(href);
  });

  it("erzeugt nur interne Vorgangslinks und lässt normale Anfragen unverändert", () => {
    expect(appendCaseSource(" Notiz ")).toBe("Notiz");
    expect(caseSourceHref("Notiz ohne Verknüpfung")).toBeNull();
    expect(caseSourceHref(null)).toBeNull();
    expect(caseSourceHref(`Vorgang: javascript:alert(1)`)).toBeNull();
    expect(caseSourceHref(`Vorgang: https://other.example${href}`)).toBe(href);
  });
});
