import { describe, expect, it } from "vitest";
import { formatCaseDaySlipText, withDaySlipSourceIcon } from "./daySlipBridge";

describe("Vorgänge auf dem Tageszettel", () => {
  it("benennt Vorgang und Schritt klar und fügt das Vorgangsicon hinzu", () => {
    const text = formatCaseDaySlipText(" Bürgeranfrage ", " Antwort nachhalten ");
    expect(text).toBe("Vorgang: Bürgeranfrage | Schritt: Antwort nachhalten");
    expect(withDaySlipSourceIcon(text, { type: "case", id: "case-1" })).toBe("💼 Vorgang: Bürgeranfrage | Schritt: Antwort nachhalten");
  });
  it("erfindet keinen Schritt und verdoppelt vorhandene Icons nicht", () => {
    expect(formatCaseDaySlipText("Bürgeranfrage", "")).toBe("Vorgang: Bürgeranfrage | Schritt: Noch kein Schritt festgelegt");
    expect(withDaySlipSourceIcon("💼 Vorgang: Anfrage", { type: "case", id: "case-1" })).toBe("💼 Vorgang: Anfrage");
    expect(withDaySlipSourceIcon(" Freie Notiz ")).toBe("Freie Notiz");
  });
});
