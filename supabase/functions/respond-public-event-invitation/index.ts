import { withSafeHandler } from "../_shared/security.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { handleRespondPublicEventInvitation } from "./respond-public-event-invitation.ts";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

Deno.serve(
  withSafeHandler("respond-public-event-invitation", async (req: Request): Promise<Response> => {
    return handleRespondPublicEventInvitation(req, {
      createServiceRoleClient: createServiceRoleClient as unknown as () => import("./respond-public-event-invitation.ts").ServiceClient,
      rateLimitStore,
    });
  }),
);
