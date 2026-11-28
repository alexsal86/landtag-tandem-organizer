import { describe, expect, it } from "vitest";
import {
  CONTACT_SEARCH_FIELDS,
  buildContactSearchFilter,
  normalizeContactSearchTerm,
  quotePostgrestPattern,
} from "./contactSearch";

describe("Kontakt-Suchfilter", () => {
  it("zitiert Begriffe mit Komma und Klammern statt den Filter zu zerlegen", () => {
    expect(buildContactSearchFilter("Müller, Hans")).toContain('name.ilike."%Müller, Hans%"');
    expect(buildContactSearchFilter("Caritas (KV)")).toContain(
      'organization.ilike."%Caritas (KV)%"',
    );
  });

  it("durchsucht auch Telefonnummern und Adresse", () => {
    const filter = buildContactSearchFilter("0721 123456");
    expect(filter).not.toBeNull();
    for (const field of ["phone", "mobile_phone", "business_phone", "address"]) {
      expect(filter).toContain(`${field}.ilike.`);
    }
  });

  it("maskiert Anführungszeichen und Backslashes", () => {
    expect(quotePostgrestPattern('a"b')).toBe('"%a\\"b%"');
    expect(quotePostgrestPattern("a\\b")).toBe('"%a\\\\b%"');
  });

  it("normalisiert Whitespace und weist leere Eingaben ab", () => {
    expect(normalizeContactSearchTerm("  Müller \n Hans  ")).toBe("Müller Hans");
    expect(normalizeContactSearchTerm("x".repeat(200))).toHaveLength(120);
    expect(buildContactSearchFilter("")).toBeNull();
    expect(buildContactSearchFilter("   ")).toBeNull();
  });

  it("sucht in allen dokumentierten Feldern", () => {
    expect([...CONTACT_SEARCH_FIELDS]).toEqual([
      "name",
      "organization",
      "position",
      "email",
      "phone",
      "mobile_phone",
      "business_phone",
      "address",
    ]);
  });
});
