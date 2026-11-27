import { expect, it, vi } from "vitest";
import type { TestContext } from "../types";
import { topicLinkingScenario } from "./topic-linking";

const client = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: client }));

it.each([true, false])("prüft Weiterleitung und Vorgangsverknüpfung mit Leitungsrolle %s", async admin => {
  const source = "source";
  const target = "target";
  let linkedTopic: string | undefined;
  let merged = false;
  const insert = vi.fn(async ({ topic_id }: { topic_id: string }) => {
    linkedTopic = topic_id;
    return { error: null };
  });
  client.from.mockImplementation(table => ({
    insert,
    select: () => ({
      eq: () => table === "topics"
        ? { single: async () => ({
          data: { is_active: !merged, merged_into: merged ? target : null, merged_at: merged ? "now" : null },
        }) }
        : Promise.resolve({ data: linkedTopic ? [{ topic_id: linkedTopic }] : [] }),
    }),
  }));
  client.rpc.mockImplementation(async (name, args) => {
    if (name === "ensure_topic") return { data: args.p_label === "Quellthema" && !merged ? source : target };
    if (name === "merge_topics") {
      if (!admin) return { error: { code: "42501" } };
      if (merged) return { error: { code: "22023" } };
      expect(linkedTopic).toBe(args.p_source);
      linkedTopic = args.p_target;
      merged = true;
      return { error: null };
    }
    expect(name).toBe("topic_usage");
    return {
      data: [{
        topic_id: linkedTopic, tasks: 0, case_items: 1, case_files: 0, documents: 0, appointments: 0,
        decisions: 0, contacts: 0, knowledge_questions: 0, knowledge_documents: 0, map_flags: 0, total: 1,
      }],
    };
  });

  const ctx: TestContext = {
    runId: "test-run", tenantId: "office", userId: "user", created: [], storageObjects: [],
    trackRecord: vi.fn(), trackStorage: vi.fn(),
    data: { topicId: source, topicLabel: "Quellthema", caseItemId: "case", moduleIsAdmin: admin },
  };
  for (const id of ["merge-redirect", "usage"]) {
    const step = topicLinkingScenario.steps.find(candidate => candidate.id === id);
    expect(await step?.run(ctx)).toMatchObject({ ok: true });
  }
  expect(insert).toHaveBeenCalledWith({ case_item_id: "case", topic_id: source, tenant_id: "office", created_by: "user" });
  expect(linkedTopic).toBe(admin ? target : source);
});
