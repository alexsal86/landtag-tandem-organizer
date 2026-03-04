import { useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { sendWebsiteWidgetMessage } from "./api";
import type { WidgetMessage } from "./types";

const INITIAL_MESSAGES: WidgetMessage[] = [
  {
    id: "welcome",
    role: "bot",
    text: "Hallo! Ich bin der Matrix-Widget-Prototyp. Stelle mir testweise eine Frage oder fordere einen Rückruf an.",
  },
];

export function MatrixWebsiteWidget() {
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [visitorMessage, setVisitorMessage] = useState("");
  const [widgetSending, setWidgetSending] = useState(false);
  const [widgetMessages, setWidgetMessages] =
    useState<WidgetMessage[]>(INITIAL_MESSAGES);

  const sendWidgetMessage = async () => {
    const trimmed = visitorMessage.trim();
    if (!trimmed || widgetSending) return;

    const userEntry: WidgetMessage = {
      id: crypto.randomUUID(),
      role: "visitor",
      text: trimmed,
    };

    setWidgetMessages((current) => [...current, userEntry]);
    setVisitorMessage("");
    setWidgetSending(true);

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), 12000),
      );

      const invokePromise = sendWebsiteWidgetMessage(trimmed);

      const { data, error } = (await Promise.race([
        invokePromise,
        timeoutPromise,
      ])) as Awaited<typeof invokePromise>;

      if (error) {
        throw new Error(error.message || "Function invocation failed");
      }

      const botReply: WidgetMessage = {
        id: crypto.randomUUID(),
        role: "bot",
        text: data?.success
          ? `✅ Nachricht erfolgreich übertragen (Room: ${data.room_id || "unbekannt"}, Event: ${data.event_id || "n/a"}).`
          : `⚠️ ${data?.fallback_message || "Die Nachricht konnte nicht an Matrix übertragen werden."}`,
      };

      setWidgetMessages((current) => [...current, botReply]);
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message === "Request timeout"
          ? "Zeitüberschreitung: Die Matrix-Übertragung hat zu lange gedauert."
          : "Übertragung fehlgeschlagen. Bitte später erneut versuchen.";

      setWidgetMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "bot",
          text: `⚠️ ${errorMessage}`,
        },
      ]);
    } finally {
      setWidgetSending(false);
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
                <div
                  key={message.id}
                  className={`flex ${message.role === "visitor" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      message.role === "visitor"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 border-t p-3">
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
          </div>
        )}
      </div>
    </div>
  );
}
