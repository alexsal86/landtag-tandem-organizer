import { describe, expect, it } from "vitest";
import { suggestOfficeFeedbackPromises } from "./officeFeedbackPromises";

describe("suggestOfficeFeedbackPromises", () => {
  it("erkennt eine Zusage im Diktat ohne Satzzeichen, auch wenn im Folgesatz eine Verneinung steht", () => {
    expect(suggestOfficeFeedbackPromises(
      "das treffen war gut ich habe zugesagt die unterlagen zu schicken ich habe nicht vor das zu vergessen",
    )).toBe("ich habe zugesagt die unterlagen zu schicken");
  });

  it("wertet Passiv nicht pauschal, sondern prüft, wer handelt", () => {
    // Berichtet nur, dass jemand fragt bzw. informiert – keine eigene Zusage.
    expect(suggestOfficeFeedbackPromises("ich werde gefragt ob die unterlagen schon da sind")).toBe("");
    expect(suggestOfficeFeedbackPromises("wir werden morgen informiert")).toBe("");
    expect(suggestOfficeFeedbackPromises("ich werde gefragt ob ich die unterlagen schicken kann")).toBe("");
    // Unpersönliches Passiv mit Zusage-Handlung ist dagegen eine Zusage.
    expect(suggestOfficeFeedbackPromises("Die Unterlagen werden bis Freitag geschickt."))
      .toBe("Die Unterlagen werden bis Freitag geschickt.");
    expect(suggestOfficeFeedbackPromises("Die Unterlagen werden nicht geschickt.")).toBe("");
  });

  it("schneidet Sätze nicht an Abkürzungen ab", () => {
    expect(suggestOfficeFeedbackPromises("Ich habe zugesagt, Dr. Müller zu informieren."))
      .toBe("Ich habe zugesagt, Dr. Müller zu informieren.");
    expect(suggestOfficeFeedbackPromises("Ich habe zugesagt, z. B. die Unterlagen bis zum 12.12. zu schicken."))
      .toBe("Ich habe zugesagt, z. B. die Unterlagen bis zum 12.12. zu schicken.");
  });

  it("liest „nicht nur … sondern auch“ nicht als Verneinung", () => {
    expect(suggestOfficeFeedbackPromises(
      "Ich habe zugesagt, nicht nur die Unterlagen zu schicken, sondern auch den Termin zu nennen.",
    )).toBe("Ich habe zugesagt, nicht nur die Unterlagen zu schicken, sondern auch den Termin zu nennen.");
    expect(suggestOfficeFeedbackPromises("Ich habe nichts zugesagt.")).toBe("");
    expect(suggestOfficeFeedbackPromises("Ich melde mich nicht.")).toBe("");
  });

  it("hält an jeder Subjunktion der Bindewörter-Liste den Satzteil zusammen", () => {
    expect(suggestOfficeFeedbackPromises("Ich habe zugesagt, dass ich die Unterlagen schicke."))
      .toBe("Ich habe zugesagt, dass ich die Unterlagen schicke.");
    expect(suggestOfficeFeedbackPromises("Ich habe zugesagt, weil ich die Unterlagen schicke."))
      .toBe("Ich habe zugesagt, weil ich die Unterlagen schicke.");
    expect(suggestOfficeFeedbackPromises("Ich melde mich, ob ich es schaffe."))
      .toBe("Ich melde mich, ob ich es schaffe.");
    expect(suggestOfficeFeedbackPromises("Ich melde mich, wenn ich mehr weiß."))
      .toBe("Ich melde mich, wenn ich mehr weiß.");
    expect(suggestOfficeFeedbackPromises("Ich melde mich, sobald ich die Unterlagen habe."))
      .toBe("Ich melde mich, sobald ich die Unterlagen habe.");
    expect(suggestOfficeFeedbackPromises("Ich schicke die Unterlagen, damit ich die Frist halte."))
      .toBe("Ich schicke die Unterlagen, damit ich die Frist halte.");
    expect(suggestOfficeFeedbackPromises("Ich schicke die Unterlagen, obwohl ich im Urlaub bin."))
      .toBe("Ich schicke die Unterlagen, obwohl ich im Urlaub bin.");
    expect(suggestOfficeFeedbackPromises("Ich habe zugesagt, als ich gefragt wurde."))
      .toBe("Ich habe zugesagt, als ich gefragt wurde.");
  });

  it("schützt jedes Kürzel der Abkürzungsliste vor einem falschen Satzende", () => {
    // dr
    expect(suggestOfficeFeedbackPromises("Ich habe zugesagt, Dr. Müller zu informieren."))
      .toBe("Ich habe zugesagt, Dr. Müller zu informieren.");
    // z + b
    expect(suggestOfficeFeedbackPromises("Ich habe zugesagt, z. B. die Unterlagen zu schicken."))
      .toBe("Ich habe zugesagt, z. B. die Unterlagen zu schicken.");
    // d + h
    expect(suggestOfficeFeedbackPromises("Ich habe zugesagt, d. h. die Unterlagen zu schicken."))
      .toBe("Ich habe zugesagt, d. h. die Unterlagen zu schicken.");
  });

  it("erkennt eine echte Zusage ohne Schlüsselwort", () => {
    expect(suggestOfficeFeedbackPromises("ich kümmere mich um die Anfrage")).toBe("ich kümmere mich um die Anfrage");
    expect(suggestOfficeFeedbackPromises("wir schicken die Unterlagen bis Montag")).toBe("wir schicken die Unterlagen bis Montag");
    expect(suggestOfficeFeedbackPromises("ich rufe die Bürgerin morgen zurück")).toBe("ich rufe die Bürgerin morgen zurück");
    expect(suggestOfficeFeedbackPromises("Ich melde mich nächste Woche.")).toBe("Ich melde mich nächste Woche.");
  });
});
