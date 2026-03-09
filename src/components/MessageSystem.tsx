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

interface Message {
  id: string; title: string; content: string; author_id: string; is_for_all_users: boolean;
  status: 'active' | 'archived'; created_at: string; has_read?: boolean;
  author?: { display_name: string; avatar_url?: string };
  recipients?: Array<{ recipient_id: string; has_read: boolean; read_at?: string; profile?: { display_name: string; avatar_url?: string } }>;
  confirmations?: Array<{ user_id: string; confirmed_at: string }>;
}

export function MessageSystem() {
  const { user } = useAuth();
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [archivedMessages, setArchivedMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [receivedPage, setReceivedPage] = useState(0);
  const [sentPage, setSentPage] = useState(0);
  const [archivePage, setArchivePage] = useState(0);
  const messagesPerPage = 3;

  const fetchMessages = async () => {
    if (!user) return;
    try {
      const { data: receivedMessages, error: receivedError } = await (supabase as any).rpc('get_user_messages', { user_id_param: user.id });
      if (receivedError) { debugConsole.error('Error fetching received messages:', receivedError); return; }

      const { data: authoredMessages, error: authoredError } = await (supabase as any).rpc('get_authored_messages', { author_id_param: user.id });
      if (authoredError) { debugConsole.error('Error fetching authored messages:', authoredError); return; }

      const convertedReceivedMessages: Message[] = (receivedMessages || [])
        .filter((msg: any) => msg.author_id !== user.id)
        .map((msg: any) => ({ id: msg.id, title: msg.title, content: msg.content, author_id: msg.author_id, is_for_all_users: msg.is_for_all_users, status: msg.status as 'active' | 'archived', created_at: msg.created_at, has_read: msg.has_read, author: { display_name: msg.author_name, avatar_url: msg.author_avatar }, recipients: [], confirmations: [] }));

      setActiveMessages(convertedReceivedMessages.filter((msg: any) => !msg.has_read));
      const readMessages = convertedReceivedMessages.filter((msg: any) => msg.has_read);

      const sentMessagesWithDetails = await Promise.all(
        (authoredMessages || []).map(async (msg: any) => {
          let recipients: any[] = [];
          let confirmations: any[] = [];
          if (msg.is_for_all_users) {
            const { data: confirmData } = await (supabase as any).from('message_confirmations').select('user_id, confirmed_at').eq('message_id', msg.id);
            if (confirmData) {
              confirmations = await Promise.all(confirmData.map(async (conf: any) => {
                const { data: profile } = await (supabase as any).from('profiles').select('display_name, avatar_url').eq('user_id', conf.user_id).maybeSingle();
                return { ...conf, profiles: profile };
              }));
            }
          } else {
            const { data: recipientData } = await (supabase as any).from('message_recipients').select('recipient_id, has_read, read_at').eq('message_id', msg.id);
            if (recipientData) {
              recipients = await Promise.all(recipientData.map(async (rec: any) => {
                const { data: profile } = await (supabase as any).from('profiles').select('display_name, avatar_url').eq('user_id', rec.recipient_id).maybeSingle();
                return { ...rec, profile };
              }));
            }
          }
          return { id: msg.id, title: msg.title, content: msg.content, author_id: msg.author_id, is_for_all_users: msg.is_for_all_users, status: msg.status as 'active' | 'archived', created_at: msg.created_at, recipients, confirmations };
        })
      );

      setSentMessages(sentMessagesWithDetails.filter(m => m.status === 'active'));
      setArchivedMessages([...sentMessagesWithDetails.filter(m => m.status === 'archived'), ...readMessages]);
    } catch (error) { debugConsole.error('Error fetching messages:', error); } finally { setLoading(false); }
  };

  useEffect(() => { fetchMessages(); }, [user]);
  useMessagesRealtime(() => { fetchMessages(); });

  const markAsRead = async (messageId: string, isForAllUsers: boolean) => {
    if (!user) return;
    try {
      await (supabase as any).rpc('mark_message_read', { message_id_param: messageId, user_id_param: user.id, is_for_all_param: isForAllUsers });
      toast({ title: "Nachricht als gelesen markiert", description: "Die Nachricht wurde bestätigt." });
      fetchMessages();
    } catch (error) { debugConsole.error('Error marking message as read:', error); toast({ title: "Fehler", description: "Die Nachricht konnte nicht als gelesen markiert werden.", variant: "destructive" }); }
  };

  const isMessageRead = (message: Message) => {
    if (!user) return false;
    if (message.is_for_all_users) return message.confirmations?.some(c => c.user_id === user.id) || false;
    return message.recipients?.some(r => r.recipient_id === user.id && r.has_read) || false;
  };

  const getPaginatedMessages = (messages: Message[], page: number) => messages.slice(page * messagesPerPage, (page + 1) * messagesPerPage);

  if (loading) return <Card><CardContent className="p-6"><div className="flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div></CardContent></Card>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2"><MessageCircle className="h-5 w-5" />Nachrichten</CardTitle>
        <Button onClick={() => setShowComposer(true)} size="sm" className="flex items-center gap-2"><Send className="h-4 w-4" />Neue Nachricht</Button>
      </CardHeader>
      <CardContent>
        {showComposer && <div className="mb-4"><MessageComposer onClose={() => setShowComposer(false)} onSent={() => { setShowComposer(false); fetchMessages(); }} /></div>}

        <Tabs defaultValue="received" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="received">Empfangen ({activeMessages.length})</TabsTrigger>
            <TabsTrigger value="sent">Gesendet ({sentMessages.length})</TabsTrigger>
            <TabsTrigger value="archived">Archiv ({archivedMessages.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="mt-4">
            <ScrollArea className="h-96">
              {activeMessages.length === 0 ? <p className="text-center text-muted-foreground py-8">Keine neuen Nachrichten</p> : (
                <div className="space-y-3">
                  {getPaginatedMessages(activeMessages, receivedPage).map((message) => (
                    <ReceivedMessageCard key={message.id} message={message} isRead={isMessageRead(message)} onMarkRead={markAsRead} />
                  ))}
                </div>
              )}
            </ScrollArea>
            <PaginationControls currentPage={receivedPage} totalMessages={activeMessages.length} messagesPerPage={messagesPerPage} onPageChange={setReceivedPage} />
          </TabsContent>

          <TabsContent value="sent" className="mt-4">
            <ScrollArea className="h-96">
              {sentMessages.length === 0 ? <p className="text-center text-muted-foreground py-8">Keine gesendeten Nachrichten</p> : (
                <div className="space-y-3">
                  {getPaginatedMessages(sentMessages, sentPage).map((message) => (
                    <SentMessageCard key={message.id} message={message} userId={user?.id} />
                  ))}
                </div>
              )}
            </ScrollArea>
            <PaginationControls currentPage={sentPage} totalMessages={sentMessages.length} messagesPerPage={messagesPerPage} onPageChange={setSentPage} />
          </TabsContent>

          <TabsContent value="archived" className="mt-4">
            <ScrollArea className="h-96">
              {archivedMessages.length === 0 ? <p className="text-center text-muted-foreground py-8">Keine archivierten Nachrichten</p> : (
                <div className="space-y-3">
                  {getPaginatedMessages(archivedMessages, archivePage).map((message) => (
                    <ArchivedMessageCard key={message.id} message={message} userId={user?.id} />
                  ))}
                </div>
              )}
            </ScrollArea>
            <PaginationControls currentPage={archivePage} totalMessages={archivedMessages.length} messagesPerPage={messagesPerPage} onPageChange={setArchivePage} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
