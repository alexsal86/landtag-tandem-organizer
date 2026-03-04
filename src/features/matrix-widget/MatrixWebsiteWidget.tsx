import { useState } from "react";
import {
  MessageCircle,
  PhoneCall,
  Send,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  saveWidgetMessageFeedback,
  sendWebsiteWidgetMessage,
  submitWebsiteWidgetCallbackRequest,
} from "./api";
import type { WebsiteWidgetCallbackRequest, WidgetMessage } from "./types";
import { useTenant } from "@/hooks/useTenant";

const INITIAL_MESSAGES: WidgetMessage[] = [
  {
    id: "welcome",
    role: "bot",
    text: "Hallo! Ich bin der Matrix-Widget-Prototyp. Stelle mir testweise eine Frage oder fordere einen Rückruf an.",
  },
];

const INITIAL_CALLBACK_FORM: WebsiteWidgetCallbackRequest = {
  name: "",
  phone: "",
  preferredTime: "",
  concern: "",
};

export function MatrixWebsiteWidget() {
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [visitorMessage, setVisitorMessage] = useState("");
  const [widgetSending, setWidgetSending] = useState(false);
  const [widgetMessages, setWidgetMessages] =
    useState<WidgetMessage[]>(INITIAL_MESSAGES);
    const [conversationId] = useState(() => crypto.randomUUID());
  const { currentTenant } = useTenant();
  const [showCallbackForm, setShowCallbackForm] = useState(false);  
  const [callbackForm, setCallbackForm] = useState<WebsiteWidgetCallbackRequest>(
    INITIAL_CALLBACK_FORM,
  );


  const sendWidgetMessage = async () => {
    const trimmed = visitorMessage.trim();
    if (!trimmed || widgetSending) return;

    const userEntry: WidgetMessage = {
      id: crypto.randomUUID(),
      role: "visitor",
      text: trimmed,
      deliveryStatus: "pending",
    };

    setWidgetMessages((current) => [...current, userEntry]);
    setVisitorMessage("");
    setWidgetSending(true);

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), 12000),
      );

      const invokePromise = sendWebsiteWidgetMessage(trimmed, conversationId);

      const { data, error } = (await Promise.race([
        invokePromise,
        timeoutPromise,
      ])) as Awaited<typeof invokePromise>;

      if (error) {
        throw new Error(error.message || "Function invocation failed");
      }

      setWidgetMessages((current) =>
        current.map((entry) =>
          entry.id === userEntry.id
            ? { ...entry, deliveryStatus: "sent" }
            : entry,
        ),
      );

      const botReply: WidgetMessage = {
        id: crypto.randomUUID(),
        role: "bot",
        matrixEventId: data?.event_id,
        text: data?.success
          ? `✅ Nachricht erfolgreich übertragen (Room: ${data.room_id || "unbekannt"}, Event: ${data.event_id || "n/a"}).`
          : `⚠️ ${data?.fallback_message || "Die Nachricht konnte nicht an Matrix übertragen werden."}`,
      };

      setWidgetMessages((current) => [...current, botReply]);
    } catch {
      setWidgetMessages((current) =>
        current.map((entry) =>
          entry.id === userEntry.id
            ? { ...entry, deliveryStatus: "failed" }
            : entry,
        ),
      );
    } finally {
      setWidgetSending(false);
    }
  };

  const submitCallbackRequest = async () => {
    const trimmedForm = {
      name: callbackForm.name.trim(),
      phone: callbackForm.phone.trim(),
      preferredTime: callbackForm.preferredTime.trim(),
      concern: callbackForm.concern.trim(),
    };

    if (
      !trimmedForm.name ||
      !trimmedForm.phone ||
      !trimmedForm.preferredTime ||
      !trimmedForm.concern ||
      widgetSending
    ) {
      return;
    }

    setWidgetSending(true);

    const summary: WidgetMessage = {
      id: crypto.randomUUID(),
      role: "visitor",
      text: `📞 Rückruf angefordert – Name: ${trimmedForm.name}, Telefon: ${trimmedForm.phone}, Wunschzeit: ${trimmedForm.preferredTime}, Anliegen: ${trimmedForm.concern}`,
    };

    setWidgetMessages((current) => [...current, summary]);

    try {
      const { data, error } = await submitWebsiteWidgetCallbackRequest(trimmedForm, conversationId);

      const isConversationLinked = data?.success && data?.event_id && data?.room_id;

      if (error) {
        throw new Error(error.message || "Function invocation failed");
      }

      setWidgetMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "bot",
          text: data?.success
            ? `✅ Danke! Dein Rückrufwunsch wurde erfasst und als Follow-up im Organizer angelegt${isConversationLinked ? " sowie mit der Chat-Konversation verknüpft" : ""}.${data.task_id ? ` (Task: ${data.task_id})` : ""}`
            : `⚠️ ${data?.fallback_message || "Der Rückrufwunsch konnte nicht vollständig verarbeitet werden."}`,
        },
      ]);

      if (data?.success) {
        setCallbackForm(INITIAL_CALLBACK_FORM);
        setShowCallbackForm(false);
      }
    } catch {
      setWidgetMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "bot",
          text: "⚠️ Rückrufanfrage konnte gerade nicht verarbeitet werden. Bitte später erneut versuchen.",
        },
      ]);
    } finally {
      setWidgetSending(false);
    }
  };

  const submitFeedback = async (messageId: string, isHelpful: boolean) => {
    if (!currentTenant?.id) {
      return;
    }

    const message = widgetMessages.find((entry) => entry.id === messageId);
    if (!message || message.role === "visitor" || message.feedbackGiven) {
      return;
    }

    const messageIndex = widgetMessages.findIndex((entry) => entry.id === messageId);
    const previousVisitorMessage =
      messageIndex > 0
        ? [...widgetMessages]
            .slice(0, messageIndex)
            .reverse()
            .find((entry) => entry.role === "visitor")?.text
        : undefined;

    const { error } = await saveWidgetMessageFeedback({
      tenantId: currentTenant.id,
      conversationId,
      widgetMessageId: message.id,
      matrixEventId: message.matrixEventId,
      responseRole: message.role,
      isHelpful,
      visitorMessage: previousVisitorMessage,
      botReply: message.text,
    });

    if (!error) {
      setWidgetMessages((current) =>
        current.map((entry) =>
          entry.id === messageId ? { ...entry, feedbackGiven: true } : entry,
        ),
      );
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Dieses Widget simuliert bereits das UI-Verhalten für Variante B
        (schneller Einstieg, Chatverlauf, Antwortfluss). Die produktive
        Matrix-Anbindung erfolgt im nächsten Schritt über eine
        Edge-Function-Bridge.
      </p>
      <div className="rounded-md border bg-muted/20 p-3 flex items-center justify-between">
        <div>
          <p className="font-medium">Status</p>
          <p className="text-xs text-muted-foreground">
            Nur intern sichtbar · Noch ohne externes Website-Embed
          </p>
        </div>
        <Badge variant="secondary">Prototype</Badge>
      </div>

      <div className="relative min-h-[280px] rounded-md border bg-background p-3">
        {!widgetOpen ? (
          <Button
            className="absolute bottom-3 right-3 gap-2"
            onClick={() => setWidgetOpen(true)}
          >
            <MessageCircle className="h-4 w-4" />
            Chat öffnen
          </Button>
        ) : (
          <div className="absolute bottom-3 right-3 w-full max-w-sm rounded-xl border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div>
                <p className="text-sm font-medium">Bürgerdialog (Test)</p>
                <p className="text-xs text-muted-foreground">
                  Matrix-Widget Vorschau
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setWidgetOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto p-3">
              {widgetMessages.map((message) => (
                <div key={message.id}>
                  <div
                    className={`flex ${message.role === "visitor" ? "justify-end" : "justify-start"}`}
                  >
                    <div className="max-w-[85%]">
                      <div
                        className={`rounded-lg px-3 py-2 text-sm ${
                          message.role === "visitor"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {message.text}
                      </div>
                      {message.role === "visitor" &&
                        message.deliveryStatus === "failed" && (
                          <p className="mt-1 text-right text-xs text-destructive">
                            Nicht gesendet
                          </p>
                        )}
                    </div>
                  </div>
                  {message.role !== "visitor" && message.id !== "welcome" && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <span>Hilfreich?</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => submitFeedback(message.id, true)}
                        disabled={message.feedbackGiven}
                        aria-label="Antwort hilfreich"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => submitFeedback(message.id, false)}
                        disabled={message.feedbackGiven}
                        aria-label="Antwort nicht hilfreich"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </Button>
                      {message.feedbackGiven && <span>Danke!</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {showCallbackForm && (
              <div className="space-y-2 border-t bg-muted/30 p-3">
                <p className="text-xs font-medium">Rückruf anfordern</p>
                <Input
                  value={callbackForm.name}
                  onChange={(event) =>
                    setCallbackForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Name"
                  disabled={widgetSending}
                />
                <Input
                  value={callbackForm.phone}
                  onChange={(event) =>
                    setCallbackForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="Telefonnummer"
                  disabled={widgetSending}
                />
                <Input
                  value={callbackForm.preferredTime}
                  onChange={(event) =>
                    setCallbackForm((current) => ({
                      ...current,
                      preferredTime: event.target.value,
                    }))
                  }
                  placeholder="Wunschzeit"
                  disabled={widgetSending}
                />
                <Input
                  value={callbackForm.concern}
                  onChange={(event) =>
                    setCallbackForm((current) => ({
                      ...current,
                      concern: event.target.value,
                    }))
                  }
                  placeholder="Anliegen"
                  disabled={widgetSending}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={
                      widgetSending ||
                      !callbackForm.name.trim() ||
                      !callbackForm.phone.trim() ||
                      !callbackForm.preferredTime.trim() ||
                      !callbackForm.concern.trim()
                    }
                    onClick={submitCallbackRequest}
                  >
                    Rückruf absenden
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={widgetSending}
                    onClick={() => setShowCallbackForm(false)}
                  >
                    Abbrechen
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t p-3">
              <div className="flex gap-2">
                <Input
                  value={visitorMessage}
                  onChange={(event) => setVisitorMessage(event.target.value)}
                  placeholder="Nachricht für den Prototyp …"
                  disabled={widgetSending}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      sendWidgetMessage();
                    }
                  }}
                />
                <Button
                  size="icon"
                  onClick={sendWidgetMessage}
                  aria-label="Nachricht senden"
                  disabled={widgetSending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() => setShowCallbackForm((current) => !current)}
                disabled={widgetSending}
              >
                <PhoneCall className="h-4 w-4" />
                Rückruf anfordern
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
