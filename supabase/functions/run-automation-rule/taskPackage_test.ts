import { assertEquals } from "jsr:@std/assert@1";
import { isMemberTaskPackage } from "./taskPackage.ts";

const packageRule = { trigger_type: "manual", actions: [{ type: "create_task_package" }] };

Deno.test("active members can execute a single manual task package through tenant access", () => {
  assertEquals(isMemberTaskPackage(packageRule, false), true);
});

Deno.test("mixed actions and non-manual triggers remain administrator-only", () => {
  assertEquals(isMemberTaskPackage({ ...packageRule, actions: [...packageRule.actions, { type: "send_email_template" }] }, false), false);
  assertEquals(isMemberTaskPackage({ ...packageRule, trigger_type: "schedule" }, false), false);
});

Deno.test("other action types and internal calls do not use the member exception", () => {
  assertEquals(isMemberTaskPackage({ ...packageRule, actions: [{ type: "create_task" }] }, false), false);
  assertEquals(isMemberTaskPackage(packageRule, true), false);
});
