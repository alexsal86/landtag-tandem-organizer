import { withSafeHandler } from "../_shared/security.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { handleRespondPublicEventInvitation } from "./respond-public-event-invitation.ts";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

Deno.serve(
  withSafeHandler("respond-public-event-invitation", async (req) => {
    return handleRespondPublicEventInvitation(req, {
      createServiceRoleClient,
      rateLimitStore,
    });
  }),
);
