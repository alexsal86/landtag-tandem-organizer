import { debugConsole } from "@/utils/debugConsole";

export type InvitationStatus =
  | "invited"
  | "accepted"
  | "declined"
  | "tentative";

export type PublicInvitationData = {
  eventTitle: string | null;
  eventDescription: string | null;
  eventDate: string | null;
  eventLocation: string | null;
  guestDisplayName: string | null;
  rsvpStatus: InvitationStatus;
  comment: string | null;
  expiresAt: string | null;
  responsePolicy: "latest_wins" | "locked";
  allowResponseUpdates: boolean;
  captcha: {
    required: boolean;
    provider: "turnstile" | "hcaptcha" | null;
    siteKey: string | null;
  };
};

export type PublicInvitationResponseData = {
  status: Exclude<InvitationStatus, "invited">;
  comment: string | null;
  respondedAt: string;
  guestDisplayName: string | null;
  eventTitle: string | null;
  responsePolicy: "latest_wins" | "locked";
  allowResponseUpdates: boolean;
};

export type PublicInvitationCaptchaPayload = {
  token?: string;
  provider?: "turnstile" | "hcaptcha";
};

export class PublicInvitationApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "PublicInvitationApiError";
    this.status = status;
    this.code = code;
  }
}

const WEBSITE_API_BASE = "/api/public-event-invitations";

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    debugConsole.error("Failed to parse public invitation API response", error);
    return null;
  }
}

async function handleApiResponse<T>(
  response: Response,
  transform: (payload: Record<string, unknown>) => T,
): Promise<T> {
  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : "Einladung konnte nicht geladen werden.";
    const code = typeof payload?.code === "string" ? payload.code : undefined;
    throw new PublicInvitationApiError(message, response.status, code);
  }

  if (!payload) {
    throw new PublicInvitationApiError(
      "Leere Antwort vom Einladungsdienst.",
      response.status,
    );
  }

  return transform(payload);
}

export async function fetchPublicInvitation(
  code: string,
): Promise<PublicInvitationData> {
  const response = await fetch(
    `${WEBSITE_API_BASE}/${encodeURIComponent(code)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  return handleApiResponse(response, (payload) => {
    const invitation = payload.invitation as
      | Record<string, unknown>
      | undefined;

    return {
      eventTitle:
        typeof invitation?.event_title === "string" ||
        invitation?.event_title === null
          ? (invitation.event_title as string | null)
          : null,
      eventDescription:
        typeof invitation?.event_description === "string" ||
        invitation?.event_description === null
          ? (invitation.event_description as string | null)
          : null,
      eventDate:
        typeof invitation?.event_date === "string" ||
        invitation?.event_date === null
          ? (invitation.event_date as string | null)
          : null,
      eventLocation:
        typeof invitation?.event_location === "string" ||
        invitation?.event_location === null
          ? (invitation.event_location as string | null)
          : null,
      guestDisplayName:
        typeof invitation?.guest_display_name === "string" ||
        invitation?.guest_display_name === null
          ? (invitation.guest_display_name as string | null)
          : null,
      rsvpStatus: (typeof invitation?.rsvp_status === "string"
        ? invitation.rsvp_status
        : "invited") as InvitationStatus,
      comment:
        typeof invitation?.comment === "string" || invitation?.comment === null
          ? (invitation.comment as string | null)
          : null,
      expiresAt:
        typeof invitation?.expires_at === "string" ||
        invitation?.expires_at === null
          ? (invitation.expires_at as string | null)
          : null,
      responsePolicy:
        invitation?.response_policy === "locked" ? "locked" : "latest_wins",
      allowResponseUpdates:
        invitation?.allow_response_updates === false ? false : true,
      captcha: {
        required: invitation?.captcha_required === true,
        provider:
          invitation?.captcha_provider === "turnstile" ||
          invitation?.captcha_provider === "hcaptcha"
            ? (invitation.captcha_provider as "turnstile" | "hcaptcha")
            : null,
        siteKey:
          typeof invitation?.captcha_site_key === "string" ||
          invitation?.captcha_site_key === null
            ? (invitation.captcha_site_key as string | null)
            : null,
      },
    };
  });
}

export async function respondToPublicInvitation(
  code: string,
  status: Exclude<InvitationStatus, "invited">,
  comment?: string,
  captcha?: PublicInvitationCaptchaPayload,
): Promise<PublicInvitationResponseData> {
  const response = await fetch(
    `${WEBSITE_API_BASE}/${encodeURIComponent(code)}/respond`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        status,
        comment,
        captcha_token: captcha?.token,
        captcha_provider: captcha?.provider,
      }),
    },
  );

  return handleApiResponse(response, (payload) => {
    const responsePayload = payload.response as
      | Record<string, unknown>
      | undefined;

    return {
      status: (typeof responsePayload?.status === "string"
        ? responsePayload.status
        : status) as Exclude<InvitationStatus, "invited">,
      comment:
        typeof responsePayload?.comment === "string" ||
        responsePayload?.comment === null
          ? (responsePayload.comment as string | null)
          : null,
      respondedAt:
        typeof responsePayload?.responded_at === "string"
          ? responsePayload.responded_at
          : new Date().toISOString(),
      guestDisplayName:
        typeof responsePayload?.guest_display_name === "string" ||
        responsePayload?.guest_display_name === null
          ? (responsePayload.guest_display_name as string | null)
          : null,
      eventTitle:
        typeof responsePayload?.event_title === "string" ||
        responsePayload?.event_title === null
          ? (responsePayload.event_title as string | null)
          : null,
      responsePolicy:
        responsePayload?.response_policy === "locked"
          ? "locked"
          : "latest_wins",
      allowResponseUpdates:
        responsePayload?.allow_response_updates === false ? false : true,
    };
  });
}
