import { describe, expect, it } from "vitest";
import {
  calendarCategoryLabel,
  calendarDescription,
  calendarEventDisplayTitle,
  editableCalendarDescription,
  employeeMeetingMetadata,
  serializeCalendarDescription,
} from "../calendarPresentation";

describe("calendar presentation", () => {
  it("uses editable category labels and sensible fallback labels", () => {
    expect(calendarCategoryLabel("employee_meeting")).toBe("Mitarbeitergespräch");
    expect(calendarCategoryLabel("employee_meeting", [{ name: "employee_meeting", label: "Personalgespräch" }])).toBe("Personalgespräch");
    expect(calendarCategoryLabel("new_type")).toBe("New type");
    expect(calendarCategoryLabel(null)).toBe("Termin");
  });

  it("only removes a duplicate title time when it matches the actual appointment start", () => {
    const start = new Date(2026, 10, 20, 10, 0);
    expect(calendarEventDisplayTitle("10:00 Mitarbeitergespräch", start)).toBe("Mitarbeitergespräch");
    expect(calendarEventDisplayTitle("10:00 – Mitarbeitergespräch", start)).toBe("Mitarbeitergespräch");
    expect(calendarEventDisplayTitle("11:00 Mitarbeitergespräch", start)).toBe("11:00 Mitarbeitergespräch");
    expect(calendarEventDisplayTitle("10:00", start)).toBe("10:00");
  });

  it("never shows structured personnel metadata as calendar description", () => {
    const source = JSON.stringify({ employee_meeting_id: "internal-uuid", meeting_type: "regular", timezone: "Europe/Berlin" });
    expect(calendarDescription(source)).toBe("Mitarbeitergespräch · Regulär");
    expect(editableCalendarDescription(source)).toBe("");
    const edited = serializeCalendarDescription(source, "Ziele und Entwicklung besprechen");
    expect(edited).not.toBeNull();
    expect(employeeMeetingMetadata(edited)?.employee_meeting_id).toBe("internal-uuid");
    expect(employeeMeetingMetadata(edited)?.timezone).toBe("Europe/Berlin");
    expect(calendarDescription(edited)).toBe("Ziele und Entwicklung besprechen");
    expect(employeeMeetingMetadata(serializeCalendarDescription(edited, ""))?.employee_meeting_id).toBe("internal-uuid");
  });

  it("leaves ordinary descriptions unchanged and handles invalid JSON safely", () => {
    expect(calendarDescription("Besprechung der Tagesordnung")).toBe("Besprechung der Tagesordnung");
    expect(serializeCalendarDescription("Notiz", "  Geändert  ")).toBe("Geändert");
    expect(calendarDescription("{invalid")).toBe("{invalid");
  });
});
