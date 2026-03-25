import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMessagesRealtime } from "@/hooks/useMessagesRealtime";
import { MessageComposer } from "./MessageComposer";
import { toast } from "@/hooks/use-toast";
import { debugConsole } from "@/utils/debugConsole";
import { ReceivedMessageCard, SentMessageCard, ArchivedMessageCard, PaginationControls } from "./messages/MessageCard";
import type { MessageItem, ParticipantSummary, PreparationSection } from "./messages/dto";
import type { ConfirmationRow, ProfileRow, RecipientRow, RpcMessageRow } from "@/types/messages";

const emptyParticipant = (userId: string): ParticipantSummary => ({
  userId,
  displayName: "Unbekannt",
  avatarUrl: null,
});

const normalizeMessage = (row: RpcMessageRow): MessageItem => ({
  id: row.id,
  title: row.title,
  content: row.content,
  authorId: row.author_id,
  status: row.status,
  createdAt: row.created_at,
  isForAllUsers: row.is_for_all_users,
  hasRead: Boolean(row.has_read),
  author: row.author_name
    ? { userId: row.author_id, displayName: row.author_name, avatarUrl: row.author_avatar ?? null }
    : null,
  recipients: [],
  confirmations: [],
  threadMeta: { totalRecipients: 0, acknowledgedRecipients: 0, isBroadcast: row.is_for_all_users },
});

export function MessageSystem() {
  const { user } = useAuth();
  const [activeMessages, setActiveMessages] = useState<ReadonlyArray<MessageItem>>([]);
  const [archivedMessages, setArchivedMessages] = useState<ReadonlyArray<MessageItem>>([]);
  const [sentMessages, setSentMessages] = useState<ReadonlyArray<MessageItem>>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [receivedPage, setReceivedPage] = useState(0);
  const [sentPage, setSentPage] = useState(0);
  const [archivePage, setArchivePage] = useState(0);
  const messagesPerPage = 3;

  const fetchMessages = async (): Promise<void> => {
    if (!user) return;

    try {
      const { data: receivedMessagesRaw, error: receivedError } = await supabase.rpc("get_user_messages", {
        user_id_param: user.id,
      });
      if (receivedError) {
        debugConsole.error("Error fetching received messages:", receivedError);
        return;
      }

      const { data: authoredMessagesRaw, error: authoredError } = await supabase.rpc("get_authored_messages", {
        author_id_param: user.id,
      });
      if (authoredError) {
        debugConsole.error("Error fetching authored messages:", authoredError);
        return;
      }

      const receivedMessages = ((receivedMessagesRaw ?? []) as ReadonlyArray<RpcMessageRow>)
        .filter((msg: RpcMessageRow) => msg.author_id !== user.id)
        .map(normalizeMessage);

      setActiveMessages(receivedMessages.filter((msg: MessageItem) => !msg.hasRead));
      const readMessages = receivedMessages.filter((msg: MessageItem) => msg.hasRead);

      const authoredMessages = (authoredMessagesRaw ?? []) as ReadonlyArray<RpcMessageRow>;
      const sentMessagesWithDetails = await Promise.all(
        authoredMessages.map(async (msg: RpcMessageRow): Promise<MessageItem> => {
          const normalized = normalizeMessage(msg);

          if (msg.is_for_all_users) {
            const { data: confirmationsRaw } = await supabase
              .from("message_confirmations")
              .select("user_id, confirmed_at")
              .eq("message_id", msg.id);

            const confirmations = await Promise.all(
              ((confirmationsRaw ?? []) as ReadonlyArray<ConfirmationRow>).map(
                async (entry: ConfirmationRow) => {
                  const { data: profileRaw } = await supabase
                    .from("profiles")
                    .select("display_name, avatar_url")
                    .eq("user_id", entry.user_id)
                    .maybeSingle();

                  const profile = profileRaw as ProfileRow | null;
                  return {
                    userId: entry.user_id,
                    confirmedAt: entry.confirmed_at,
                    profile: profile
                      ? {
                          userId: entry.user_id,
                          displayName: profile.display_name ?? "Unbekannt",
                          avatarUrl: profile.avatar_url,
                        }
                      : emptyParticipant(entry.user_id),
                  };
                },
              ),
            );

            return {
              ...normalized,
              confirmations,
              threadMeta: {
                totalRecipients: 0,
                acknowledgedRecipients: confirmations.length,
                isBroadcast: true,
              },
            };
          }

          const { data: recipientRowsRaw } = await supabase
            .from("message_recipients")
            .select("recipient_id, has_read, read_at")
            .eq("message_id", msg.id);

          const recipients = await Promise.all(
            ((recipientRowsRaw ?? []) as ReadonlyArray<RecipientRow>).map(
              async (entry: RecipientRow) => {
                const { data: profileRaw } = await supabase
                  .from("profiles")
                  .select("display_name, avatar_url")
                  .eq("user_id", entry.recipient_id)
                  .maybeSingle();

                const profile = profileRaw as ProfileRow | null;
                return {
                  recipientId: entry.recipient_id,
                  hasRead: entry.has_read,
                  readAt: entry.read_at,
                  profile: profile
                    ? {
                        userId: entry.recipient_id,
                        displayName: profile.display_name ?? "Unbekannt",
                        avatarUrl: profile.avatar_url,
                      }
                    : emptyParticipant(entry.recipient_id),
                };
              },
            ),
          );

          const acknowledged = recipients.filter((entry) => entry.hasRead).length;

          return {
            ...normalized,
            recipients,
            threadMeta: {
              totalRecipients: recipients.length,
              acknowledgedRecipients: acknowledged,
              isBroadcast: false,
            },
          };
        }),
      );

      setSentMessages(sentMessagesWithDetails.filter((message: MessageItem) => message.status === "active"));
      setArchivedMessages([
        ...sentMessagesWithDetails.filter((message: MessageItem) => message.status === "archived"),
        ...readMessages,
      ]);
    } catch (error) {
      debugConsole.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMessages();
  }, [user]);

  useMessagesRealtime(() => {
    void fetchMessages();
  });

  const markAsRead = async (messageId: string, isForAllUsers: boolean): Promise<void> => {
    if (!user) return;

    try {
      await supabase.rpc("mark_message_read", {
        message_id_param: messageId,
        user_id_param: user.id,
        is_for_all_param: isForAllUsers,
      });
      toast({ title: "Nachricht als gelesen markiert", description: "Die Nachricht wurde bestätigt." });
      await fetchMessages();
    } catch (error) {
      debugConsole.error("Error marking message as read:", error);
      toast({
        title: "Fehler",
        description: "Die Nachricht konnte nicht als gelesen markiert werden.",
        variant: "destructive",
      });
    }
  };

  const isMessageRead = (message: MessageItem): boolean => {
    if (!user) return false;
    if (message.isForAllUsers) {
      return message.confirmations.some((confirmation) => confirmation.userId === user.id);
    }

    return message.recipients.some((recipient) => recipient.recipientId === user.id && recipient.hasRead);
  };

  const getPaginatedMessages = (messages: ReadonlyArray<MessageItem>, page: number): ReadonlyArray<MessageItem> =>
    messages.slice(page * messagesPerPage, (page + 1) * messagesPerPage);

  const sections: ReadonlyArray<PreparationSection> = [
    { key: "received", title: "Empfangen", count: activeMessages.length },
    { key: "sent", title: "Gesendet", count: sentMessages.length },
    { key: "archived", title: "Archiv", count: archivedMessages.length },
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Nachrichten
        </CardTitle>
        <Button onClick={() => setShowComposer(true)} size="sm" className="flex items-center gap-2">
          <Send className="h-4 w-4" />
          Neue Nachricht
        </Button>
      </CardHeader>
      <CardContent>
        {showComposer && (
          <div className="mb-4">
            <MessageComposer
              onClose={() => setShowComposer(false)}
              onSent={() => {
                setShowComposer(false);
                void fetchMessages();
              }}
            />
          </div>
        )}

        <Tabs defaultValue="received" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            {sections.map((section) => (
              <TabsTrigger key={section.key} value={section.key}>
                {section.title} ({section.count})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="received" className="mt-4">
            <ScrollArea className="h-96">
              {activeMessages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Keine neuen Nachrichten</p>
              ) : (
                <div className="space-y-3">
                  {getPaginatedMessages(activeMessages, receivedPage).map((message: MessageItem) => (
                    <ReceivedMessageCard
                      key={message.id}
                      message={message}
                      isRead={isMessageRead(message)}
                      onMarkRead={markAsRead}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
            <PaginationControls
              currentPage={receivedPage}
              totalMessages={activeMessages.length}
              messagesPerPage={messagesPerPage}
              onPageChange={setReceivedPage}
            />
          </TabsContent>

          <TabsContent value="sent" className="mt-4">
            <ScrollArea className="h-96">
              {sentMessages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Keine gesendeten Nachrichten</p>
              ) : (
                <div className="space-y-3">
                  {getPaginatedMessages(sentMessages, sentPage).map((message: MessageItem) => (
                    <SentMessageCard key={message.id} message={message} userId={user?.id} />
                  ))}
                </div>
              )}
            </ScrollArea>
            <PaginationControls
              currentPage={sentPage}
              totalMessages={sentMessages.length}
              messagesPerPage={messagesPerPage}
              onPageChange={setSentPage}
            />
          </TabsContent>

          <TabsContent value="archived" className="mt-4">
            <ScrollArea className="h-96">
              {archivedMessages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Keine archivierten Nachrichten</p>
              ) : (
                <div className="space-y-3">
                  {getPaginatedMessages(archivedMessages, archivePage).map((message: MessageItem) => (
                    <ArchivedMessageCard key={message.id} message={message} userId={user?.id} />
                  ))}
                </div>
              )}
            </ScrollArea>
            <PaginationControls
              currentPage={archivePage}
              totalMessages={archivedMessages.length}
              messagesPerPage={messagesPerPage}
              onPageChange={setArchivePage}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
