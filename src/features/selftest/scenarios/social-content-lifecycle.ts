import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

const tag = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;
const berlinToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());

type ApprovalEvent = { action: string; from_state: string | null; to_state: string | null; actor_id: string | null };

export const socialContentLifecycleScenario: TestScenario = {
  id: "social-content-lifecycle",
  title: "Social-Content-Lifecycle (Planung, Kanalvariante, Freigabe und Ereignisprotokoll)",
  description: "Legt ein Thema im Themenspeicher und einen Beitrag an, ergänzt Kanalzuordnung und Kanalvariante, reicht den Beitrag ein und gibt ihn frei. Danach fordert das Szenario Änderungen an, prüft Folgeaufgabe und Meldung, gibt erneut frei und belegt, dass eine geänderte Kanaltext-Zeile die Freigabe wieder öffnet. Geprüft werden Status, Freigabe aus der Sitzung und die Protokolleinträge des Freigabe-Triggers.",
  touches: ["topic_backlog", "social_content_items", "social_content_channels", "social_content_item_channels", "social_content_variants", "social_content_approval_events", "social_approval_comments", "tasks", "task_assignees", "notifications"],
  features: ["redaktion", "social-content"],
  requiredRoles: ["abgeordneter", "bueroleitung"],
  checks: [
    "Thema im Themenspeicher und Beitrag mit Briefing-Feldern werden angelegt und unverändert zurückgelesen",
    "Kanalzuordnung und Kanalvariante werden gespeichert, ohne den Freigabestand zu verändern",
    "Einreichen setzt den Beitrag auf Freigabe und protokolliert genau ein Ereignis submitted",
    "Freigeben setzt Freigeber und Zeitpunkt aus der Sitzung, auch wenn der Client beide Felder leert",
    "Das Protokoll enthält danach genau submitted und approved mit den passenden Zuständen und dem handelnden Profil",
    "Ein Änderungswunsch setzt den Beitrag auf Entwurf/abgelehnt, speichert den Kommentar und protokolliert rejected aus approved",
    "Der Änderungswunsch legt genau eine Folgeaufgabe beim Verantwortlichen an (Ball Büro, Frist aus der Rückgabe) und meldet sie ihm",
    "Nach erneutem Einreichen und Freigeben öffnet eine geänderte Kanaltext-Zeile die Freigabe automatisch wieder, leert Freigeber und Zeitpunkt und protokolliert reopened",
    "Das Wiederöffnen verwendet die offene Folgeaufgabe weiter (keine zweite Aufgabe) und stellt sie auf „Freigabe erneut einholen“ mit Frist in der Zukunft",
  ],
  limitations: [
    "Matrix-Chat und die externe Zustellung/Veröffentlichung eines Beitrags sind nicht Teil des Szenarios; es wird nichts veröffentlicht oder an Plattformen gesendet.",
    "Freie Freigabe-Kommentare ohne Änderungswunsch, Emoji-Reaktionen und die Push-Zustellung der Meldungen prüft das Szenario nicht; geprüft werden die Datenbankzeilen, das Protokoll und die Folgeaufgabe.",
    "Die Bedienung von Kalender, Board und Freigabedialog wird nicht über die Oberfläche geprüft.",
  ],
  writes: [
    { table: "topic_backlog", columns: ["tenant_id", "topic", "short_description", "status", "priority", "tags", "created_by"] },
    { table: "social_content_items", columns: ["tenant_id", "topic_backlog_id", "created_by", "format", "hook", "core_message", "draft_text", "cta", "hashtags", "approval_required", "workflow_status", "approval_state", "approved_at", "approved_by"] },
    { table: "social_content_channels", columns: ["tenant_id", "name", "slug"] },
    { table: "social_content_item_channels", columns: ["content_item_id", "channel_id", "tenant_id", "created_by", "is_primary"] },
    { table: "social_content_variants", columns: ["tenant_id", "content_item_id", "channel_id", "created_by", "caption", "first_comment", "media_type", "asset_ids", "platform_status"] },
    { table: "social_content_approval_events", columns: ["tenant_id", "content_item_id", "actor_id", "actor_user_id", "actor_name", "action", "from_state", "to_state"] },
    { table: "social_approval_comments", columns: ["tenant_id", "content_item_id", "author_id", "comment", "is_change_request"] },
    { table: "tasks", columns: ["user_id", "tenant_id", "title", "description", "assigned_to", "status", "priority", "category", "due_date", "ball_owner", "ball_assignee_id", "next_action", "next_action_due", "source_type", "source_id", "timeline"] },
    { table: "task_assignees", columns: ["task_id", "user_id", "assigned_by"] },
    { table: "notifications", columns: ["tenant_id", "user_id", "notification_type_id", "title", "message", "data", "priority"] },
  ],
  collectArtifacts: async ctx => {
    const itemId = ctx.data.itemId as string | undefined;
    if (!itemId) return;
    const tasks = await supabase.from("tasks").select("id").eq("tenant_id", ctx.tenantId)
      .eq("source_type", "social_content_item").eq("source_id", itemId);
    for (const task of tasks.data ?? []) ctx.trackRecord({ table: "tasks", id: task.id });
    const notifications = await supabase.from("notifications").select("id")
      .eq("user_id", ctx.userId).contains("data", { content_item_id: itemId });
    for (const notification of notifications.data ?? []) {
      ctx.trackRecord({ table: "notifications", id: notification.id });
    }
  },
  steps: [
    {
      id: "plan-topic", label: "Thema im Themenspeicher anlegen",
      run: async ctx => {
        const profile = await supabase.from("profiles").select("id").eq("user_id", ctx.userId).maybeSingle();
        if (profile.error || !profile.data) {
          return { ok: false, message: `Eigenes Profil lesen: ${describeError(profile.error)}` };
        }
        ctx.data.profileId = profile.data.id;

        const payload = {
          tenant_id: ctx.tenantId,
          topic: tag(ctx.runId, "Thema"),
          short_description: "Selbsttest Redaktionsplanung",
          status: "ready",
          priority: 2,
          tags: ["selbsttest"],
          created_by: profile.data.id,
        };
        const { data, error } = await supabase.from("topic_backlog").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: `Thema anlegen: ${describeError(error)}` };
        ctx.data.topicId = data.id;
        ctx.trackRecord({ table: "topic_backlog", id: data.id });

        const stored = await expectFields("topic_backlog", data.id, { topic: payload.topic, status: "ready", priority: 2 }, "Thema");
        if (!stored.ok) return stored;
        return { ok: true, message: "Thema liegt im Themenspeicher und ist für die Planung bereit.", details: { topicId: data.id } };
      },
    },
    {
      id: "plan-item", label: "Beitrag mit Briefing anlegen",
      run: async ctx => {
        const topicId = ctx.data.topicId as string;
        const profileId = ctx.data.profileId as string;
        const payload = {
          tenant_id: ctx.tenantId,
          topic_backlog_id: topicId,
          created_by: profileId,
          format: "instagram_post",
          hook: tag(ctx.runId, "Aufhänger"),
          core_message: "Kernbotschaft aus dem Selbsttest",
          draft_text: "Entwurfstext aus dem Selbsttest.",
          cta: "Mehr erfahren",
          hashtags: ["#selbsttest"],
          approval_required: true,
          workflow_status: "draft",
          approval_state: "draft",
        };
        const { data, error } = await supabase.from("social_content_items").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: `Beitrag anlegen: ${describeError(error)}` };
        ctx.data.itemId = data.id;
        ctx.trackRecord({ table: "social_content_items", id: data.id });

        const stored = await expectFields("social_content_items", data.id, {
          workflow_status: "draft", approval_state: "draft", approved_by: null, approved_at: null,
          hook: payload.hook, draft_text: payload.draft_text,
        }, "Beitrag");
        if (!stored.ok) return stored;

        const events = await supabase.from("social_content_approval_events")
          .select("id").eq("content_item_id", data.id).eq("tenant_id", ctx.tenantId);
        if (events.error) return { ok: false, message: `Protokoll lesen: ${describeError(events.error)}` };
        return {
          ok: (events.data ?? []).length === 0,
          message: (events.data ?? []).length === 0
            ? "Beitrag ist im Entwurf; das Freigabeprotokoll ist noch leer."
            : "Ein neuer Entwurf darf noch kein Freigabeereignis erzeugen.",
          details: { itemId: data.id, events: (events.data ?? []).length },
        };
      },
    },
    {
      id: "channel-variant", label: "Kanal zuordnen und Kanalvariante speichern",
      run: async ctx => {
        const itemId = ctx.data.itemId as string;
        const profileId = ctx.data.profileId as string;

        const channel = await supabase.from("social_content_channels").insert({
          tenant_id: ctx.tenantId,
          name: tag(ctx.runId, "Kanal"),
          slug: `selbsttest-${ctx.runId}`.toLowerCase(),
          is_active: true,
          sort_order: 99,
        }).select("id").single();
        if (channel.error || !channel.data) return { ok: false, message: `Kanal anlegen: ${describeError(channel.error)}` };
        const channelId = channel.data.id;
        ctx.trackRecord({ table: "social_content_channels", id: channelId });
        ctx.data.channelId = channelId;

        const link = await supabase.from("social_content_item_channels").insert({
          content_item_id: itemId,
          channel_id: channelId,
          tenant_id: ctx.tenantId,
          created_by: profileId,
          is_primary: true,
        });
        if (link.error) return { ok: false, message: `Kanalzuordnung: ${describeError(link.error)}` };

        const variantPayload = {
          tenant_id: ctx.tenantId,
          content_item_id: itemId,
          channel_id: channelId,
          created_by: profileId,
          caption: tag(ctx.runId, "Kanaltext"),
          first_comment: "#selbsttest",
          media_type: "image" as const,
          asset_ids: [] as string[],
          platform_status: "draft" as const,
        };
        const variant = await supabase.from("social_content_variants").insert(variantPayload).select("id").single();
        if (variant.error || !variant.data) return { ok: false, message: `Kanalvariante: ${describeError(variant.error)}` };
        ctx.trackRecord({ table: "social_content_variants", id: variant.data.id });
        ctx.data.variantId = variant.data.id;

        const storedVariant = await expectFields("social_content_variants", variant.data.id, {
          caption: variantPayload.caption, media_type: "image", platform_status: "draft",
        }, "Kanalvariante");
        if (!storedVariant.ok) return storedVariant;

        const item = await supabase.from("social_content_items")
          .select("approval_state,workflow_status").eq("id", itemId).maybeSingle();
        if (item.error) return { ok: false, message: `Beitrag lesen: ${describeError(item.error)}` };
        const unchanged = item.data?.approval_state === "draft" && item.data?.workflow_status === "draft";
        return {
          ok: unchanged,
          message: unchanged
            ? "Kanal und Kanalvariante sind gespeichert; der Entwurf bleibt unverändert."
            : "Eine neue Kanalvariante darf den Entwurf nicht in die Freigabe schieben.",
          details: { channelId, variantId: variant.data.id },
        };
      },
    },
    {
      id: "submit", label: "Beitrag zur Freigabe einreichen",
      run: async ctx => {
        const itemId = ctx.data.itemId as string;
        const submitted = await supabase.from("social_content_items")
          .update({ workflow_status: "approval", approval_state: "pending_approval" })
          .eq("id", itemId).eq("tenant_id", ctx.tenantId);
        if (submitted.error) return { ok: false, message: `Einreichen: ${describeError(submitted.error)}` };

        const read = await supabase.from("social_content_items")
          .select("workflow_status,approval_state,approved_at,approved_by").eq("id", itemId).maybeSingle();
        if (read.error || !read.data) return { ok: false, message: `Beitrag lesen: ${describeError(read.error)}` };

        const events = await supabase.from("social_content_approval_events")
          .select("action,from_state,to_state,actor_id").eq("content_item_id", itemId).eq("tenant_id", ctx.tenantId);
        if (events.error) return { ok: false, message: `Protokoll lesen: ${describeError(events.error)}` };
        const list = (events.data ?? []) as ApprovalEvent[];
        const onlySubmitted = list.length === 1
          && list[0].action === "submitted"
          && list[0].from_state === "draft"
          && list[0].to_state === "pending_approval"
          && list[0].actor_id === (ctx.data.profileId as string);

        const ok = read.data.workflow_status === "approval"
          && read.data.approval_state === "pending_approval"
          && read.data.approved_at === null && read.data.approved_by === null
          && onlySubmitted;
        return {
          ok,
          message: ok
            ? "Beitrag steht in der Freigabe; das Protokoll hält das Einreichen fest."
            : "Einreichen oder Protokolleintrag weicht vom erwarteten Ablauf ab.",
          details: { status: read.data, events: list },
        };
      },
    },
    {
      id: "approve", label: "Beitrag freigeben und Freigabe aus der Sitzung prüfen",
      run: async ctx => {
        const itemId = ctx.data.itemId as string;
        const profileId = ctx.data.profileId as string;
        const approved = await supabase.from("social_content_items")
          .update({ approval_state: "approved", workflow_status: "approval", approved_at: null, approved_by: null })
          .eq("id", itemId).eq("tenant_id", ctx.tenantId);
        if (approved.error) return { ok: false, message: `Freigeben: ${describeError(approved.error)}` };

        const read = await supabase.from("social_content_items")
          .select("approval_state,approved_at,approved_by").eq("id", itemId).maybeSingle();
        if (read.error || !read.data) return { ok: false, message: `Beitrag lesen: ${describeError(read.error)}` };

        const events = await supabase.from("social_content_approval_events")
          .select("action,from_state,to_state,actor_id").eq("content_item_id", itemId).eq("tenant_id", ctx.tenantId);
        if (events.error) return { ok: false, message: `Protokoll lesen: ${describeError(events.error)}` };
        const list = (events.data ?? []) as ApprovalEvent[];
        const byAction = Object.fromEntries(list.map(event => [event.action, event]));
        const historyComplete = list.length === 2
          && byAction.submitted?.from_state === "draft"
          && byAction.submitted?.to_state === "pending_approval"
          && byAction.approved?.from_state === "pending_approval"
          && byAction.approved?.to_state === "approved"
          && byAction.approved?.actor_id === profileId;

        const ok = read.data.approval_state === "approved"
          && read.data.approved_by === profileId
          && read.data.approved_at !== null
          && historyComplete;
        return {
          ok,
          message: ok
            ? "Freigabe steht mit Freigeber und Zeitpunkt aus der Sitzung; das Protokoll enthält Einreichen und Freigabe."
            : "Freigabe oder Protokoll weicht vom erwarteten Ablauf ab (Client-Werte dürfen nicht übernommen werden).",
          details: { status: read.data, events: list },
        };
      },
    },
    {
      id: "request-changes", label: "Änderungswunsch mit Folgeaufgabe, Meldung und Protokoll",
      run: async ctx => {
        const itemId = ctx.data.itemId as string;
        const profileId = ctx.data.profileId as string;
        const comment = tag(ctx.runId, "Bitte Kanaltext kürzen");
        const response = await supabase.rpc("request_social_post_changes", {
          _item: itemId, _comment: comment, _due_days: 2,
        });
        if (response.error) return { ok: false, message: `Änderungswunsch: ${describeError(response.error)}` };
        const result = (response.data ?? {}) as { comment_id?: string; task_id?: string; due_date?: string; assignee?: string };

        const item = await supabase.from("social_content_items")
          .select("workflow_status,approval_state,approved_at,approved_by,reminder_sent_at").eq("id", itemId).maybeSingle();
        if (item.error || !item.data) return { ok: false, message: `Beitrag lesen: ${describeError(item.error)}` };

        const comments = await supabase.from("social_approval_comments")
          .select("author_id,is_change_request,comment")
          .eq("content_item_id", itemId).eq("is_change_request", true);
        if (comments.error) return { ok: false, message: `Änderungswunsch lesen: ${describeError(comments.error)}` };

        const tasks = await supabase.from("tasks")
          .select("id,assigned_to,status,ball_owner,next_action,next_action_due")
          .eq("tenant_id", ctx.tenantId).eq("source_type", "social_content_item").eq("source_id", itemId);
        if (tasks.error) return { ok: false, message: `Folgeaufgabe lesen: ${describeError(tasks.error)}` };
        const task = (tasks.data ?? [])[0];
        if (task) {
          ctx.data.taskId = task.id;
          ctx.trackRecord({ table: "tasks", id: task.id });
        }

        const notifications = await supabase.from("notifications")
          .select("id,title").eq("user_id", ctx.userId).contains("data", { content_item_id: itemId });
        if (notifications.error) return { ok: false, message: `Meldung lesen: ${describeError(notifications.error)}` };
        for (const notification of notifications.data ?? []) {
          ctx.trackRecord({ table: "notifications", id: notification.id });
        }
        ctx.data.notificationCount = (notifications.data ?? []).length;

        const events = await supabase.from("social_content_approval_events")
          .select("action,from_state,to_state").eq("content_item_id", itemId).eq("tenant_id", ctx.tenantId);
        if (events.error) return { ok: false, message: `Protokoll lesen: ${describeError(events.error)}` };
        const rejected = (events.data ?? []).find(event => event.action === "rejected");

        const checks = {
          itemBackToDraft: item.data.workflow_status === "draft"
            && item.data.approval_state === "rejected"
            && item.data.approved_at === null && item.data.approved_by === null,
          commentStored: (comments.data ?? []).length === 1
            && comments.data?.[0]?.author_id === profileId
            && comments.data?.[0]?.comment === comment,
          taskAssigned: task?.assigned_to === ctx.userId && task?.status === "todo"
            && task?.ball_owner === "office" && task?.next_action === "Änderungswunsch umsetzen"
            && task?.next_action_due === result.due_date,
          notificationQueued: (notifications.data ?? []).length >= 1,
          assigneeIsOwner: result.assignee === ctx.userId,
          eventRecorded: rejected?.from_state === "approved" && rejected?.to_state === "rejected",
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Änderungswunsch ist gespeichert: Beitrag zurück im Entwurf, Folgeaufgabe beim Verantwortlichen, Meldung und Protokolleintrag vorhanden."
            : `Änderungswunsch unvollständig: ${failed.join(", ")}`,
          details: { ...checks, taskId: task?.id ?? null, event: rejected ?? null },
        };
      },
    },
    {
      id: "resubmit-approve", label: "Nach dem Änderungswunsch erneut einreichen und freigeben",
      run: async ctx => {
        const itemId = ctx.data.itemId as string;
        const profileId = ctx.data.profileId as string;
        const submitted = await supabase.from("social_content_items")
          .update({ workflow_status: "approval", approval_state: "pending_approval", responsible_user_id: profileId })
          .eq("id", itemId).eq("tenant_id", ctx.tenantId);
        if (submitted.error) return { ok: false, message: `Erneut einreichen: ${describeError(submitted.error)}` };
        const approved = await supabase.from("social_content_items")
          .update({ approval_state: "approved", workflow_status: "approval" })
          .eq("id", itemId).eq("tenant_id", ctx.tenantId);
        if (approved.error) return { ok: false, message: `Erneut freigeben: ${describeError(approved.error)}` };

        const read = await supabase.from("social_content_items")
          .select("approval_state,approved_by,approved_at,responsible_user_id").eq("id", itemId).maybeSingle();
        if (read.error || !read.data) return { ok: false, message: `Beitrag lesen: ${describeError(read.error)}` };
        const ok = read.data.approval_state === "approved"
          && read.data.approved_by === profileId && read.data.approved_at !== null
          && read.data.responsible_user_id === profileId;
        return {
          ok,
          message: ok
            ? "Beitrag ist nach dem Änderungswunsch erneut eingereicht und freigegeben."
            : "Erneutes Einreichen oder Freigeben hat den Beitrag nicht in den freigegebenen Zustand gebracht.",
          details: read.data,
        };
      },
    },
    {
      id: "variant-reopens-approval", label: "Geänderter Kanaltext öffnet die Freigabe automatisch wieder",
      run: async ctx => {
        const itemId = ctx.data.itemId as string;
        const variantId = ctx.data.variantId as string;
        const profileId = ctx.data.profileId as string;
        const before = (ctx.data.notificationCount as number | undefined) ?? 0;
        const changed = await supabase.from("social_content_variants")
          .update({ caption: tag(ctx.runId, "Gekürzter Kanaltext") })
          .eq("id", variantId).eq("tenant_id", ctx.tenantId);
        if (changed.error) return { ok: false, message: `Kanaltext ändern: ${describeError(changed.error)}` };

        const item = await supabase.from("social_content_items")
          .select("workflow_status,approval_state,approved_at,approved_by").eq("id", itemId).maybeSingle();
        if (item.error || !item.data) return { ok: false, message: `Beitrag lesen: ${describeError(item.error)}` };

        const events = await supabase.from("social_content_approval_events")
          .select("action,from_state,to_state,actor_id").eq("content_item_id", itemId).eq("tenant_id", ctx.tenantId);
        if (events.error) return { ok: false, message: `Protokoll lesen: ${describeError(events.error)}` };
        const reopened = (events.data ?? []).find(event => event.action === "reopened");

        const tasks = await supabase.from("tasks")
          .select("id,status,next_action,next_action_due,assigned_to")
          .eq("tenant_id", ctx.tenantId).eq("source_type", "social_content_item").eq("source_id", itemId);
        if (tasks.error) return { ok: false, message: `Folgeaufgabe lesen: ${describeError(tasks.error)}` };
        const task = (tasks.data ?? [])[0];
        if (task) ctx.trackRecord({ table: "tasks", id: task.id });

        const notifications = await supabase.from("notifications")
          .select("id,title").eq("user_id", ctx.userId).contains("data", { content_item_id: itemId });
        if (notifications.error) return { ok: false, message: `Meldung lesen: ${describeError(notifications.error)}` };
        for (const notification of notifications.data ?? []) {
          ctx.trackRecord({ table: "notifications", id: notification.id });
        }

        const checks = {
          approvalReopened: item.data.approval_state === "pending_approval"
            && item.data.workflow_status === "approval"
            && item.data.approved_at === null && item.data.approved_by === null,
          eventRecorded: reopened?.from_state === "approved" && reopened?.to_state === "pending_approval"
            && reopened?.actor_id === profileId,
          noSecondTask: (tasks.data ?? []).length === 1
            && task?.id === (ctx.data.taskId as string | undefined)
            && task?.status === "todo"
            && task?.assigned_to === ctx.userId,
          taskReused: task?.next_action === "Freigabe erneut einholen"
            && typeof task?.next_action_due === "string" && task.next_action_due > berlinToday(),
          notificationAdded: (notifications.data ?? []).length > before,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Die geänderte Kanaltext-Zeile hat die Freigabe geöffnet; das Protokoll hält reopened fest, die offene Folgeaufgabe wurde mit neuer Frist weiterverwendet und es entstand keine zweite."
            : `Wiederöffnung unvollständig: ${failed.join(", ")}`,
          details: { ...checks, event: reopened ?? null, taskId: task?.id ?? null, notifications: (notifications.data ?? []).length },
        };
      },
    },
  ],
};
