import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { formatRecipient } from "./caseLetter";

const base = { name: null, first_name: null, last_name: null, address: null, business_street: null, business_house_number: null, business_postal_code: null, business_city: null };

describe("Brief aus Vorgang: Empfänger", () => {
  it("nimmt die Privatanschrift vor der Geschäftsanschrift", () => {
    expect(formatRecipient({ ...base, name: "Hans Müller", address: "Hauptstr. 1\n76131 Karlsruhe", business_city: "Berlin" }))
      .toEqual({ name: "Hans Müller", address: "Hauptstr. 1\n76131 Karlsruhe" });
  });
  it("baut sonst die Geschäftsanschrift und den Namen aus Vor- und Nachname", () => {
    expect(formatRecipient({ ...base, first_name: "Eva", last_name: "Klein", business_street: "Ring", business_house_number: "5", business_postal_code: "76133", business_city: "Karlsruhe" }))
      .toEqual({ name: "Eva Klein", address: "Ring 5\n76133 Karlsruhe" });
  });
});
