import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildRequestId,
  createCorsHeaders,
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  safeErrorResponse,
  userCanAccessTenant,
} from "../_shared/security.ts";

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = buildRequestId();

  try {
    console.log(`[${requestId}] Starting force calendar re-sync`);

    const authResult = await getAuthenticatedUser(req);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }

    const user = authResult.user;
    const supabase = createServiceClient();

    const body = await req.json();
    const calendarId = body?.calendar_id;
    const clearExisting = Boolean(body?.clear_existing);

    if (!calendarId || typeof calendarId !== "string") {
      return safeErrorResponse(
        "calendar_id is required",
        400,
        corsHeaders,
        requestId,
      );
    }

    const { data: calendar, error: calendarError } = await supabase
      .from("external_calendars")
      .select("id, tenant_id")
      .eq("id", calendarId)
      .single();

    if (calendarError || !calendar) {
      return safeErrorResponse(
        "Calendar not found",
        404,
        corsHeaders,
        requestId,
      );
    }

    const canResync = await userCanAccessTenant(
      supabase,
      user.id,
      calendar.tenant_id,
      ["abgeordneter"],
    );

    if (!canResync) {
      return safeErrorResponse(
        "Insufficient permissions",
        403,
        corsHeaders,
        requestId,
      );
    }

    console.log(`[${requestId}] Force re-sync for calendar: ${calendarId}`);
    console.log(`[${requestId}] Clear existing events: ${clearExisting}`);

    if (clearExisting) {
      const { error: deleteError } = await supabase
        .from("external_events")
        .delete()
        .eq("external_calendar_id", calendarId);

      if (deleteError) {
        throw new Error(
          `Failed to delete existing events: ${deleteError.message}`,
        );
      }
    }

    const { error: resetError } = await supabase
      .from("external_calendars")
      .update({
        last_sync: null,
        last_successful_sync: null,
        sync_errors_count: 0,
        last_sync_error: null,
      })
      .eq("id", calendarId);

    if (resetError) {
      throw new Error(`Failed to reset sync timestamps: ${resetError.message}`);
    }

    const { data: syncResult, error: syncError } =
      await supabase.functions.invoke("sync-external-calendar", {
        body: { calendar_id: calendarId },
      });

    if (syncError) {
      throw new Error(`Sync function failed: ${syncError.message}`);
    }

    return jsonResponse(
      {
        success: true,
        message: "Force re-sync completed successfully",
        syncResult,
        clearedExisting: clearExisting,
        request_id: requestId,
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error(`[${requestId}] Force re-sync error:`, error);
    return safeErrorResponse(
      "Internal server error",
      500,
      corsHeaders,
      requestId,
    );
  }
});
