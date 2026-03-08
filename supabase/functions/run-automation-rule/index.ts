import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";
import { Resend } from "npm:resend@2.0.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Condition = {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "gt" | "lt";
  value: string;
};

type Action = {
  type: "create_notification" | "update_record_status" | "create_task" | "send_push_notification" | "send_email_template";
  payload?: Record<string, unknown>;
};

const evaluateCondition = (source: Record<string, unknown>, condition: Condition) => {
  const current = source[condition.field];
  const target = condition.value;

  switch (condition.operator) {
    case "equals":
      return String(current ?? "") === target;
    case "not_equals":
      return String(current ?? "") !== target;
    case "contains":
      return String(current ?? "").includes(target);
    case "gt":
      return Number(current ?? 0) > Number(target);
    case "lt":
      return Number(current ?? 0) < Number(target);
    default:
      return false;
  }
};

// Feature 6: Evaluate conditions with AND/OR support
const evaluateConditions = (
  source: Record<string, unknown>,
  conditionsBlock: { all?: Condition[]; any?: Condition[] }
): boolean => {
  if (conditionsBlock.any && conditionsBlock.any.length > 0) {
    return conditionsBlock.any.some((c) => evaluateCondition(source, c));
  }
  const conditions = conditionsBlock.all ?? [];
  return conditions.every((c) => evaluateCondition(source, c));
};

// Feature 7: Rate limiting check
const checkRateLimit = async (
  supabaseAdmin: any,
  tenantId: string,
  actionType: string
): Promise<{ allowed: boolean; currentCount: number; maxPerHour: number }> => {
  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0); // Round to current hour

  // Try to get or create the rate limit entry
  const { data: existing } = await supabaseAdmin
    .from("automation_rate_limits")
    .select("action_count, max_per_hour")
    .eq("tenant_id", tenantId)
    .eq("action_type", actionType)
    .gte("window_start", windowStart.toISOString())
    .maybeSingle();

  if (existing) {
    if (existing.action_count >= existing.max_per_hour) {
      return { allowed: false, currentCount: existing.action_count, maxPerHour: existing.max_per_hour };
    }
    // Increment
    await supabaseAdmin
      .from("automation_rate_limits")
      .update({ action_count: existing.action_count + 1 })
      .eq("tenant_id", tenantId)
      .eq("action_type", actionType)
      .gte("window_start", windowStart.toISOString());
    return { allowed: true, currentCount: existing.action_count + 1, maxPerHour: existing.max_per_hour };
  }

  // Create new window entry
  const defaultMax = actionType === "send_email_template" ? 50 : 200;
  await supabaseAdmin.from("automation_rate_limits").insert({
    tenant_id: tenantId,
    action_type: actionType,
    window_start: windowStart.toISOString(),
    action_count: 1,
    max_per_hour: defaultMax,
  });
  return { allowed: true, currentCount: 1, maxPerHour: defaultMax };
};

// Feature 8: Determine if error is transient (retryable)
const isTransientError = (error: Error): boolean => {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("econnrefused") ||
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("rate limit")
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  let activeRunId: string | null = null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const automationSecret = Deno.env.get("AUTOMATION_CRON_SECRET") ?? "";
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const authHeader = req.headers.get("Authorization");
    const internalSecret = req.headers.get("x-automation-secret");
    const isInternalCall = Boolean(automationSecret && internalSecret === automationSecret);

    if (!authHeader && !isInternalCall) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    let user: { id: string } | null = null;

    if (!isInternalCall) {
      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: authHeader as string } },
      });

      const {
        data: { user: authUser },
        error: authError,
      } = await supabaseUser.auth.getUser();

      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      user = { id: authUser.id };
    }

    const { ruleId, dryRun = false, sourcePayload = {}, idempotencyKey }: {
      ruleId: string;
      dryRun?: boolean;
      sourcePayload?: Record<string, unknown>;
      idempotencyKey?: string;
    } = await req.json();

    if (!ruleId) {
      return new Response(JSON.stringify({ error: "ruleId is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: rule, error: ruleError } = await supabaseAdmin
      .from("automation_rules")
      .select("id, tenant_id, name, conditions, actions, enabled")
      .eq("id", ruleId)
      .maybeSingle();

    if (ruleError || !rule) {
      return new Response(JSON.stringify({ error: "Rule not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (!isInternalCall) {
      const { data: adminAllowed, error: adminError } = await supabaseAdmin.rpc("is_tenant_admin", {
        _user_id: user!.id,
        _tenant_id: rule.tenant_id,
      });

      if (adminError || !adminAllowed) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    // Kill-Switch: check if tenant has paused all automations
    if (!dryRun) {
      const { data: tenantRow } = await supabaseAdmin
        .from("tenants")
        .select("automations_paused")
        .eq("id", rule.tenant_id)
        .maybeSingle();

      if (tenantRow?.automations_paused) {
        return new Response(JSON.stringify({ error: "Automations are paused for this tenant" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    if (!rule.enabled && !dryRun) {
      return new Response(JSON.stringify({ error: "Rule is disabled" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (idempotencyKey) {
      const { data: existingRun } = await supabaseAdmin
        .from("automation_rule_runs")
        .select("id, status")
        .eq("rule_id", rule.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingRun) {
        return new Response(JSON.stringify({ reused: true, runId: existingRun.id, status: existingRun.status }), {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    const runInsert = {
      rule_id: rule.id,
      tenant_id: rule.tenant_id,
      status: "running",
      trigger_source: "manual",
      dry_run: dryRun,
      idempotency_key: idempotencyKey ?? null,
      input_payload: sourcePayload,
      created_by: user?.id ?? null,
      started_at: new Date().toISOString(),
      retry_count: 0,
      max_retries: 3,
    };

    const { data: run, error: runError } = await supabaseAdmin
      .from("automation_rule_runs")
      .insert(runInsert)
      .select("id")
      .single();

    if (runError || !run) {
      return new Response(JSON.stringify({ error: runError?.message ?? "Could not create run" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    activeRunId = run.id;

    // Feature 6: Support both { all: [...] } and { any: [...] } conditions
    const conditionsBlock = (rule.conditions ?? { all: [] }) as { all?: Condition[]; any?: Condition[] };
    const actions = (rule.actions ?? []) as Action[];

    const matches = evaluateConditions(sourcePayload, conditionsBlock);

    if (!matches) {
      await supabaseAdmin.from("automation_rule_runs").update({
        status: "success",
        result_payload: { skipped: true, reason: "conditions_not_met" },
        finished_at: new Date().toISOString(),
      }).eq("id", run.id);

      await supabaseAdmin.from("automation_rule_run_steps").insert({
        run_id: run.id,
        tenant_id: rule.tenant_id,
        step_order: 0,
        step_type: "condition_check",
        status: "skipped",
        input_payload: { conditions: conditionsBlock },
        result_payload: { matches: false },
      });

      return new Response(JSON.stringify({ runId: run.id, status: "success", skipped: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    let stepOrder = 1;
    for (const action of actions) {
      if (dryRun) {
        await supabaseAdmin.from("automation_rule_run_steps").insert({
          run_id: run.id,
          tenant_id: rule.tenant_id,
          step_order: stepOrder,
          step_type: action.type,
          status: "success",
          input_payload: action,
          result_payload: { dry_run: true },
        });
        stepOrder += 1;
        continue;
      }

      // Feature 7: Check rate limit before executing action
      const rateCheck = await checkRateLimit(supabaseAdmin, rule.tenant_id, action.type);
      if (!rateCheck.allowed) {
        await supabaseAdmin.from("automation_rule_run_steps").insert({
          run_id: run.id,
          tenant_id: rule.tenant_id,
          step_order: stepOrder,
          step_type: action.type,
          status: "rate_limited",
          input_payload: action,
          result_payload: {
            reason: "rate_limit_exceeded",
            current_count: rateCheck.currentCount,
            max_per_hour: rateCheck.maxPerHour,
          },
        });
        stepOrder += 1;
        continue;
      }

      if (action.type === "create_notification") {
        const payload = action.payload ?? {};
        const targetUserId = String(payload.target_user_id ?? payload.target ?? "");
        const title = String(payload.title ?? `Automation: ${rule.name}`);
        const message = String(payload.message ?? "Automatische Regel ausgelöst.");

        if (!targetUserId) {
          await supabaseAdmin.from("automation_rule_run_steps").insert({
            run_id: run.id,
            tenant_id: rule.tenant_id,
            step_order: stepOrder,
            step_type: action.type,
            status: "skipped",
            input_payload: action,
            result_payload: { reason: "missing_target_user_id" },
          });
          stepOrder += 1;
          continue;
        }

        const { error: notificationError } = await supabaseAdmin.rpc("create_notification", {
          user_id_param: targetUserId,
          type_name: "system_update",
          title_param: title,
          message_param: message,
          data_param: {
            source: "automation_rule",
            rule_id: rule.id,
            run_id: run.id,
          },
          priority_param: "medium",
        });

        if (notificationError) {
          throw notificationError;
        }
      }

      if (action.type === "update_record_status") {
        const payload = action.payload ?? {};
        const tableName = String(payload.table ?? "");
        const recordId = String(payload.record_id ?? "");
        const status = String(payload.status ?? "");

        if (!tableName || !recordId || !status) {
          await supabaseAdmin.from("automation_rule_run_steps").insert({
            run_id: run.id,
            tenant_id: rule.tenant_id,
            step_order: stepOrder,
            step_type: action.type,
            status: "skipped",
            input_payload: action,
            result_payload: { reason: "missing_payload", required: ["table", "record_id", "status"] },
          });
          stepOrder += 1;
          continue;
        }

        const allowedTables = new Set(["tasks", "decisions", "knowledge_documents", "casefiles", "contacts", "case_files"]);
        if (!allowedTables.has(tableName)) {
          throw new Error(`Table not allowed: ${tableName}`);
        }

        const { error: updateError } = await supabaseAdmin
          .from(tableName)
          .update({ status })
          .eq("id", recordId)
          .eq("tenant_id", rule.tenant_id);

        if (updateError) {
          throw updateError;
        }
      }

      if (action.type === "send_push_notification") {
        const payload = action.payload ?? {};
        const targetUserId = String(payload.target_user_id ?? payload.target ?? "");
        const title = String(payload.title ?? `Automation: ${rule.name}`);
        const body = String(payload.message ?? "Automatische Regel ausgelöst.");

        if (!targetUserId) {
          await supabaseAdmin.from("automation_rule_run_steps").insert({
            run_id: run.id,
            tenant_id: rule.tenant_id,
            step_order: stepOrder,
            step_type: action.type,
            status: "skipped",
            input_payload: action,
            result_payload: { reason: "missing_target_user_id" },
          });
          stepOrder += 1;
          continue;
        }

        const { data: subscriptions, error: subError } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", targetUserId);

        if (subError) {
          throw subError;
        }

        if (!subscriptions || subscriptions.length === 0) {
          await supabaseAdmin.from("automation_rule_run_steps").insert({
            run_id: run.id,
            tenant_id: rule.tenant_id,
            step_order: stepOrder,
            step_type: action.type,
            status: "skipped",
            input_payload: action,
            result_payload: { reason: "no_push_subscriptions" },
          });
          stepOrder += 1;
          continue;
        }

        const { error: notificationError } = await supabaseAdmin.rpc("create_notification", {
          user_id_param: targetUserId,
          type_name: "automation_push",
          title_param: title,
          message_param: body,
          data_param: JSON.stringify({
            source: "automation_rule",
            rule_id: rule.id,
            run_id: run.id,
            push: true,
          }),
          priority_param: "high",
        });

        if (notificationError) {
          throw notificationError;
        }
      }

      if (action.type === "create_task") {
        const payload = action.payload ?? {};
        const title = String(payload.title ?? "").trim();
        const description = String(payload.description ?? "").trim();
        const priority = String(payload.priority ?? "medium");
        const category = String(payload.category ?? "personal");
        const dueDate = String(payload.due_date ?? "");
        const assignedTo = String(payload.assigned_to ?? "").trim();

        if (!title) {
          await supabaseAdmin.from("automation_rule_run_steps").insert({
            run_id: run.id,
            tenant_id: rule.tenant_id,
            step_order: stepOrder,
            step_type: action.type,
            status: "skipped",
            input_payload: action,
            result_payload: { reason: "missing_title" },
          });
          stepOrder += 1;
          continue;
        }

        const taskInsert = {
          title,
          description: description || null,
          priority,
          category,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          user_id: user?.id ?? null,
          status: "todo",
          tenant_id: rule.tenant_id,
          assigned_to: assignedTo || null,
        };

        const { error: taskError } = await supabaseAdmin.from("tasks").insert(taskInsert);

        if (taskError) {
          throw taskError;
        }
      }

      if (action.type === "send_email_template") {
        const payload = action.payload ?? {};
        const templateId = String(payload.template_id ?? "").trim();
        const recipientEmail = String(payload.recipient_email ?? "").trim();
        const recipientName = String(payload.recipient_name ?? "").trim();

        if (!templateId || !recipientEmail) {
          await supabaseAdmin.from("automation_rule_run_steps").insert({
            run_id: run.id,
            tenant_id: rule.tenant_id,
            step_order: stepOrder,
            step_type: action.type,
            status: "skipped",
            input_payload: action,
            result_payload: { reason: "missing_template_id_or_recipient_email" },
          });
          stepOrder += 1;
          continue;
        }

        const { data: emailTemplate, error: tplError } = await supabaseAdmin
          .from("email_templates")
          .select("name, subject, body_html, variables")
          .eq("id", templateId)
          .eq("tenant_id", rule.tenant_id)
          .eq("is_active", true)
          .maybeSingle();

        if (tplError || !emailTemplate) {
          await supabaseAdmin.from("automation_rule_run_steps").insert({
            run_id: run.id,
            tenant_id: rule.tenant_id,
            step_order: stepOrder,
            step_type: action.type,
            status: "failed",
            input_payload: action,
            error_message: tplError?.message ?? "Email template not found or inactive",
          });
          stepOrder += 1;
          continue;
        }

        const { data: sender } = await supabaseAdmin
          .from("sender_information")
          .select("name, wahlkreis_email, landtag_email")
          .eq("tenant_id", rule.tenant_id)
          .eq("is_default", true)
          .eq("is_active", true)
          .maybeSingle();

        const senderEmail = sender?.wahlkreis_email || sender?.landtag_email || "noreply@gruene.landtag-bw.de";
        const senderName = sender?.name || "Automation";

        let subject = emailTemplate.subject;
        let body = emailTemplate.body_html;
        const vars: Record<string, string> = {
          empfaenger_name: recipientName || recipientEmail,
          empfaenger_email: recipientEmail,
          regel_name: rule.name,
          ...(sourcePayload as Record<string, string>),
        };

        for (const [key, val] of Object.entries(vars)) {
          const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
          subject = subject.replace(placeholder, String(val));
          body = body.replace(placeholder, String(val));
        }

        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (!resendApiKey) {
          throw new Error("RESEND_API_KEY not configured");
        }

        const resend = new Resend(resendApiKey);
        const { error: emailError } = await resend.emails.send({
          from: `${senderName} <${senderEmail}>`,
          to: [recipientEmail],
          subject,
          html: body,
        });

        if (emailError) {
          throw new Error(`Email send failed: ${JSON.stringify(emailError)}`);
        }
      }

      await supabaseAdmin.from("automation_rule_run_steps").insert({
        run_id: run.id,
        tenant_id: rule.tenant_id,
        step_order: stepOrder,
        step_type: action.type,
        status: "success",
        input_payload: action,
      });
      stepOrder += 1;
    }

    await supabaseAdmin.from("automation_rule_runs").update({
      status: dryRun ? "dry_run" : "success",
      result_payload: {
        conditions_matched: true,
        action_count: actions.length,
      },
      finished_at: new Date().toISOString(),
    }).eq("id", run.id);

    return new Response(JSON.stringify({ runId: run.id, status: dryRun ? "dry_run" : "success" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown automation executor error";
    const isTransient = error instanceof Error && isTransientError(error);

    if (activeRunId) {
      // Feature 8: Retry with backoff for transient errors
      if (isTransient) {
        const { data: currentRun } = await supabaseAdmin
          .from("automation_rule_runs")
          .select("retry_count, max_retries")
          .eq("id", activeRunId)
          .maybeSingle();

        const retryCount = (currentRun?.retry_count ?? 0) + 1;
        const maxRetries = currentRun?.max_retries ?? 3;

        if (retryCount <= maxRetries) {
          // Exponential backoff: 1min, 5min, 15min
          const backoffMinutes = [1, 5, 15][retryCount - 1] ?? 15;
          const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

          await supabaseAdmin
            .from("automation_rule_runs")
            .update({
              status: "retry_pending",
              error_message: message,
              retry_count: retryCount,
              next_retry_at: nextRetryAt.toISOString(),
            })
            .eq("id", activeRunId);

          return new Response(JSON.stringify({
            runId: activeRunId,
            status: "retry_pending",
            retry_count: retryCount,
            next_retry_at: nextRetryAt.toISOString(),
          }), {
            status: 200,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }
      }

      await supabaseAdmin
        .from("automation_rule_runs")
        .update({ status: "failed", error_message: message, finished_at: new Date().toISOString() })
        .eq("id", activeRunId);

      const { data: runRow } = await supabaseAdmin
        .from("automation_rule_runs")
        .select("tenant_id, rule_id")
        .eq("id", activeRunId)
        .maybeSingle();

      if (runRow?.tenant_id) {
        await supabaseAdmin.from("automation_rule_run_steps").insert({
          run_id: activeRunId,
          tenant_id: runRow.tenant_id,
          step_order: 999,
          step_type: "executor_error",
          status: "failed",
          input_payload: {},
          error_message: message,
        });

        // Notify tenant admins about the failed run
        try {
          const { data: ruleRow } = await supabaseAdmin
            .from("automation_rules")
            .select("name")
            .eq("id", runRow.rule_id)
            .maybeSingle();

          const { data: admins } = await supabaseAdmin
            .from("user_tenant_memberships")
            .select("user_id")
            .eq("tenant_id", runRow.tenant_id)
            .eq("role", "abgeordneter")
            .eq("is_active", true);

          if (admins && admins.length > 0) {
            const ruleName = ruleRow?.name ?? "Unbekannte Regel";
            const shortError = message.length > 200 ? message.slice(0, 200) + "…" : message;

            await Promise.allSettled(
              admins.map((admin) =>
                supabaseAdmin.rpc("create_notification", {
                  user_id_param: admin.user_id,
                  type_name: "automation_run_failed",
                  title_param: `Automation fehlgeschlagen: ${ruleName}`,
                  message_param: `Die Regel „${ruleName}" ist fehlgeschlagen: ${shortError}`,
                  data_param: JSON.stringify({
                    rule_id: runRow.rule_id,
                    rule_name: ruleName,
                    run_id: activeRunId,
                    error_message: shortError,
                    navigation_context: "admin/automation",
                  }),
                  priority_param: "high",
                })
              )
            );
          }
        } catch (notifyError) {
          console.error("Failed to notify admins about automation failure:", notifyError);
        }
      }
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
