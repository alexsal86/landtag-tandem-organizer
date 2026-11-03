import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { hasPersonalDeletionApproval } from "./approval.ts";

const approval = {
  status: "approved",
  requested_by: "requester",
  approved_by: "second-admin",
  approved_at: "2026-11-03T23:42:00Z",
};

Deno.test("deletion requires consent from a distinct second person", () => {
  assertEquals(hasPersonalDeletionApproval({ ...approval, approved_by: "requester" }), false);
});
Deno.test("deletion requires personal consent timestamp", () => {
  assertEquals(hasPersonalDeletionApproval({ ...approval, approved_at: null }), false);
});
Deno.test("pending request cannot be processed even with approval fields", () => {
  assertEquals(hasPersonalDeletionApproval({ ...approval, status: "pending" }), false);
});
Deno.test("already processing or completed request cannot be claimed again", () => {
  assertEquals(hasPersonalDeletionApproval({ ...approval, status: "processing" }), false);
  assertEquals(hasPersonalDeletionApproval({ ...approval, status: "completed" }), false);
});
Deno.test("personally approved request passes the processing precondition", () => {
  assertEquals(hasPersonalDeletionApproval(approval), true);
});