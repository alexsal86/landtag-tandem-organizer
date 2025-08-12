import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Check, Archive, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageComposer } from "./MessageComposer";
import { toast } from "@/hooks/use-toast";

interface Message {
  id: string;
  title: string;
  content: string;
  author_id: string;
  is_for_all_users: boolean;
  status: 'active' | 'archived';
  created_at: string;
  author?: {
    display_name: string;
    avatar_url?: string;
  };
  recipients?: Array<{
    recipient_id: string;
    has_read: boolean;
    read_at?: string;
    profile?: {
      display_name: string;
      avatar_url?: string;
    };
  }>;
  confirmations?: Array<{
    user_id: string;
    confirmed_at: string;
  }>;
}

export function MessageSystem() {
  const { user } = useAuth();
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [archivedMessages, setArchivedMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    if (!user) return;

    try {
      // Fetch messages with basic data - we'll need to handle the queries differently due to types
      const { data: receivedMessages } = await supabase
        .rpc('get_user_messages', { user_id_param: user.id })
        .then(res => res.data || []);

      const { data: authoredMessages } = await supabase
        .rpc('get_authored_messages', { author_id_param: user.id })
        .then(res => res.data || []);

      setActiveMessages(receivedMessages || []);
      
      const activeSent = authoredMessages?.filter(m => m.status === 'active') || [];
      const archivedSent = authoredMessages?.filter(m => m.status === 'archived') || [];
      
      setSentMessages(activeSent);
      setArchivedMessages(archivedSent);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [user]);

  const markAsRead = async (messageId: string, isForAllUsers: boolean) => {
    if (!user) return;

    try {
      await supabase
        .rpc('mark_message_read', { 
          message_id_param: messageId, 
          user_id_param: user.id,
          is_for_all_param: isForAllUsers
        });

      toast({
        title: "Nachricht als gelesen markiert",
        description: "Die Nachricht wurde bestätigt."
      });

      fetchMessages();
    } catch (error) {
      console.error('Error marking message as read:', error);
      toast({
        title: "Fehler",
        description: "Die Nachricht konnte nicht als gelesen markiert werden.",
        variant: "destructive"
      });
    }
  };

  const isMessageRead = (message: Message) => {
    if (!user) return false;
    
    if (message.is_for_all_users) {
      return message.confirmations?.some(c => c.user_id === user.id) || false;
    } else {
      return message.recipients?.some(r => r.recipient_id === user.id && r.has_read) || false;
    }
  };

  const getRecipientStatus = (recipients: any[] = [], confirmations: any[] = [], isForAllUsers: boolean) => {
    if (isForAllUsers) {
      return { total: 0, read: confirmations.length };
    }
    const total = recipients.length;
    const read = recipients.filter(r => r.has_read).length;
    return { total, read };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
        <Button 
          onClick={() => setShowComposer(true)} 
          size="sm"
          className="flex items-center gap-2"
        >
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
                fetchMessages();
              }}
            />
          </div>
        )}

        <Tabs defaultValue="received" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="received">
              Empfangen ({activeMessages.length})
            </TabsTrigger>
            <TabsTrigger value="sent">
              Gesendet ({sentMessages.length})
            </TabsTrigger>
            <TabsTrigger value="archived">
              Archiv ({archivedMessages.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="mt-4">
            <ScrollArea className="h-96">
              {activeMessages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Keine neuen Nachrichten
                </p>
              ) : (
                <div className="space-y-3">
                  {activeMessages.map((message) => {
                    const isRead = isMessageRead(message);
                    return (
                      <div
                        key={message.id}
                        className={`p-3 border rounded-lg ${
                          isRead ? 'bg-muted/30' : 'bg-background border-primary/20'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={message.author?.avatar_url} />
                                <AvatarFallback>
                                  {message.author?.display_name?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">
                                {message.author?.display_name || 'Unbekannt'}
                              </span>
                              {message.is_for_all_users && (
                                <Badge variant="secondary" className="text-xs">
                                  An alle
                                </Badge>
                              )}
                              {!isRead && (
                                <Badge variant="default" className="text-xs">
                                  Neu
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-medium text-sm mb-1">{message.title}</h4>
                            <p className="text-xs text-muted-foreground mb-2">
                              {message.content}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(message.created_at).toLocaleDateString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          {!isRead && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markAsRead(message.id, message.is_for_all_users)}
                              className="ml-2"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="sent" className="mt-4">
            <ScrollArea className="h-96">
              {sentMessages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Keine gesendeten Nachrichten
                </p>
              ) : (
                <div className="space-y-3">
                  {sentMessages.map((message) => {
                    const status = getRecipientStatus(
                      message.recipients, 
                      message.confirmations, 
                      message.is_for_all_users
                    );
                    return (
                      <div key={message.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm">{message.title}</h4>
                              {message.is_for_all_users && (
                                <Badge variant="secondary" className="text-xs">
                                  An alle
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {message.content}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(message.created_at).toLocaleDateString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        
                        {!message.is_for_all_users && message.recipients && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {message.recipients.map((recipient) => (
                              <div key={recipient.recipient_id} className="flex items-center gap-1">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={recipient.profile?.avatar_url} />
                                  <AvatarFallback className="text-xs">
                                    {recipient.profile?.display_name?.charAt(0) || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                {recipient.has_read && (
                                  <Check className="h-3 w-3 text-green-500" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="mt-2 text-xs text-muted-foreground">
                          {message.is_for_all_users ? (
                            `${status.read} Benutzer haben bestätigt`
                          ) : (
                            `${status.read}/${status.total} gelesen`
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="archived" className="mt-4">
            <ScrollArea className="h-96">
              {archivedMessages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Keine archivierten Nachrichten
                </p>
              ) : (
                <div className="space-y-3">
                  {archivedMessages.map((message) => (
                    <div key={message.id} className="p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Archive className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium text-sm">{message.title}</h4>
                        {message.is_for_all_users && (
                          <Badge variant="secondary" className="text-xs">
                            An alle
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {message.content}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Archiviert: {new Date(message.created_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}