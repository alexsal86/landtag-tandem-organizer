import { describe, expect, it } from "vitest";
import {
  allDayEndDate,
  createIcsDateTimeParser,
  localWallToUtc,
  parseIcsContentLines,
  parseIcsProperty,
  parseIcsTimeZones,
  toIanaTimeZone,
} from "./icsTime";

const BERLIN_VTIMEZONE = `BEGIN:VTIMEZONE
TZID:Europe/Berlin
X-LIC-LOCATION:Europe/Berlin
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`;

const OUTLOOK_VTIMEZONE = `BEGIN:VTIMEZONE
TZID:W. Europe Standard Time
BEGIN:STANDARD
DTSTART:16011028T030000
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:16010325T020000
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3
END:DAYLIGHT
END:VTIMEZONE`;

const attributes = (line: string) => {
  const property = parseIcsProperty(line);
  if (!property) throw new Error(`Nicht parsebar: ${line}`);
  return property.params;
};

describe("ICS-Zeitwerte: Zeitzonen", () => {
  it("liest Parameter und Inhalt getrennt und entfaltet Folgezeilen", () => {
    expect(parseIcsProperty('DTSTART;TZID="W. Europe Standard Time":20260210T090000')).toEqual({
      name: "DTSTART",
      params: { TZID: "W. Europe Standard Time" },
      value: "20260210T090000",
    });

    const unfolded = parseIcsContentLines("DTSTART;TZID=Europe/Ber\n lin:20250715T140000");
    expect(unfolded).toEqual(["DTSTART;TZID=Europe/Berlin:20250715T140000"]);
    expect(attributes(unfolded[0]).TZID).toBe("Europe/Berlin");
  });

  it("erkennt die VTIMEZONE des Feeds und die Windows-Namen von Outlook", () => {
    const zones = parseIcsTimeZones(`${BERLIN_VTIMEZONE}\n${OUTLOOK_VTIMEZONE}`);
    expect(Array.from(zones.keys())).toEqual(["Europe/Berlin", "W. Europe Standard Time"]);
    expect(zones.get("Europe/Berlin")?.observances).toHaveLength(2);
    expect(toIanaTimeZone("W. Europe Standard Time")).toBe("Europe/Berlin");
    expect(toIanaTimeZone("/freeassociation.sourceforge.net/Tzfile/Europe/Berlin")).toBe("Europe/Berlin");
    expect(toIanaTimeZone("Unbekannte Zone")).toBeNull();
  });

  it("respektiert Z als UTC und verschiebt nichts", () => {
    const parser = createIcsDateTimeParser("");
    const resolved = parser.resolveDateTime("20250715T120000Z");
    expect(resolved?.date.toISOString()).toBe("2025-07-15T12:00:00.000Z");
    expect(resolved?.floating).toBe(false);
  });

  it("löst TZID über die VTIMEZONE inkl. Sommer-/Winterzeit auf", () => {
    const parser = createIcsDateTimeParser(BERLIN_VTIMEZONE);
    const summer = parser.resolveDateTime("20250715T140000", { TZID: "Europe/Berlin" });
    const winter = parser.resolveDateTime("20260120T100000", { TZID: "Europe/Berlin" });
    const afterSpringForward = parser.resolveDateTime("20260330T090000", { TZID: "Europe/Berlin" });
    const afterFallBack = parser.resolveDateTime("20261026T090000", { TZID: "Europe/Berlin" });

    expect(summer?.date.toISOString()).toBe("2025-07-15T12:00:00.000Z");
    expect(winter?.date.toISOString()).toBe("2026-01-20T09:00:00.000Z");
    expect(afterSpringForward?.date.toISOString()).toBe("2026-03-30T07:00:00.000Z");
    expect(afterFallBack?.date.toISOString()).toBe("2026-10-26T08:00:00.000Z");
  });

  it("löst Outlook-TZIDs mit 1601-Basisjahr und RRULE auf", () => {
    const parser = createIcsDateTimeParser(OUTLOOK_VTIMEZONE);
    const winter = parser.resolveDateTime("20260210T090000", { TZID: "W. Europe Standard Time" });
    const summer = parser.resolveDateTime("20260714T090000", { TZID: "W. Europe Standard Time" });

    expect(winter?.date.toISOString()).toBe("2026-02-10T08:00:00.000Z");
    expect(summer?.date.toISOString()).toBe("2026-07-14T07:00:00.000Z");
  });

  it("nutzt die IANA-Zeitzone, wenn der Feed keine VTIMEZONE mitliefert", () => {
    const parser = createIcsDateTimeParser("");
    const summer = parser.resolveDateTime("20250715T140000", { TZID: "Europe/Berlin" });
    const outlook = parser.resolveDateTime("20260210T090000", { TZID: "W. Europe Standard Time" });
    expect(summer?.date.toISOString()).toBe("2025-07-15T12:00:00.000Z");
    expect(outlook?.date.toISOString()).toBe("2026-02-10T08:00:00.000Z");
  });

  it("behandelt floating times als Berliner Wandzeit und unbekannte Zonen unverändert", () => {
    const parser = createIcsDateTimeParser("");
    expect(parser.resolveDateTime("20260210T090000")?.date.toISOString()).toBe("2026-02-10T08:00:00.000Z");
    expect(parser.resolveDateTime("20260210T090000")?.floating).toBe(true);
    expect(parser.resolveDateTime("20260210T090000", { TZID: "Irgendeine Zone" })?.date.toISOString())
      .toBe("2026-02-10T09:00:00.000Z");
  });

  it("erkennt Zeitzonenwechsel auch mit localWallToUtc und Ganztagsgrenzen", () => {
    expect(new Date(localWallToUtc("Europe/Berlin", Date.UTC(2025, 6, 15, 14, 0, 0))).toISOString())
      .toBe("2025-07-15T12:00:00.000Z");
    expect(new Date(localWallToUtc("Europe/Berlin", Date.UTC(2026, 0, 20, 10, 0, 0))).toISOString())
      .toBe("2026-01-20T09:00:00.000Z");

    const start = new Date(Date.UTC(2025, 11, 24));
    expect(allDayEndDate(start, null).toISOString()).toBe("2025-12-25T00:00:00.000Z");
    expect(allDayEndDate(start, new Date(Date.UTC(2025, 11, 26))).toISOString()).toBe("2025-12-26T00:00:00.000Z");
    expect(allDayEndDate(start, start).toISOString()).toBe("2025-12-25T00:00:00.000Z");
  });
});
