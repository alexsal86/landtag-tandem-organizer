import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { calendarOccurrence, scheduleRunKey } from "../_shared/calendarSchedule.ts";
import { validSchedulerSignature } from "./schedulerAuth.ts";

Deno.test("calendar occurrence uses April 1 at Berlin 09:00 and a stable slot", () => {
  const config = { schedule_kind: "annual", month: "4", day: "1", hour: "9", month_end: "false", timezone: "Europe/Berlin" };
  assertEquals(calendarOccurrence(config, new Date("2026-04-01T07:00:00Z")), "2026-04-01");
  assertEquals(calendarOccurrence(config, new Date("2026-04-01T06:00:00Z")), null);
  assertEquals(scheduleRunKey("rule", "2026-04-01"), "rule-calendar-2026-04-01");
});

Deno.test("scheduler rejects missing, forged and expired signatures", async () => {
  const now = 1794268800000;
  assertEquals(await validSchedulerSignature(new Request("https://example.test"), "test-only-key", now), false);
  assertEquals(await validSchedulerSignature(new Request("https://example.test", { headers: { "x-scheduler-timestamp": String(now / 1000), "x-scheduler-signature": "0".repeat(64) } }), "test-only-key", now), false);
  const timestamp = String(now / 1000);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode("test-only-key"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`run-scheduled-automation-rules:${timestamp}`)));
  const signature = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  const request = new Request("https://example.test", { headers: { "x-scheduler-timestamp": timestamp, "x-scheduler-signature": signature } });
  assertEquals(await validSchedulerSignature(request, "test-only-key", now), true);
  assertEquals(await validSchedulerSignature(request, "test-only-key", now + 301000), false);
});