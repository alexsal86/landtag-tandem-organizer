import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Check, Archive, Send, X, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageComposer } from "./MessageComposer";
import { toast } from "@/hooks/use-toast";

interface ReceivedMessage {
  id: string;
  title: string;
  content: string;
  author_id: string;
  is_for_all_users: boolean;
  status: string;
  created_at: string;
  author_name: string;
  author_avatar: string;
  has_read: boolean;
}

interface AuthoredMessage {
  id: string;
  title: string;
  content: string;
  author_id: string;
  is_for_all_users: boolean;
  status: string;
  created_at: string;
  recipients_count: number;
  read_count: number;
}

interface Message {
  id: string;
  title: string;
  content: string;
  author_id: string;
  is_for_all_users: boolean;
  status: 'active' | 'archived';
  created_at: string;
  has_read?: boolean; // Add this property
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
  const [archivedUserMessages, setArchivedUserMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Pagination states
  const [receivedPage, setReceivedPage] = useState(0);
  const [sentPage, setSentPage] = useState(0);
  const [archivePage, setArchivePage] = useState(0);
  const messagesPerPage = 3;

  const fetchMessages = async () => {
    if (!user) return;

    try {
      // Fetch messages with basic data
      const receivedResponse = await (supabase as any)
        .rpc('get_user_messages', { user_id_param: user.id });
      
      const { data: receivedMessages, error: receivedError } = receivedResponse;

      if (receivedError) {
        console.error('Error fetching received messages:', receivedError);
        return;
      }

      const authoredResponse = await (supabase as any)
        .rpc('get_authored_messages', { author_id_param: user.id });
      
      const { data: authoredMessages, error: authoredError } = authoredResponse;

      if (authoredError) {
        console.error('Error fetching authored messages:', authoredError);
        return;
      }

      // Convert received messages to the Message interface format, excluding own authored messages
      const convertedReceivedMessages: Message[] = (receivedMessages || [])
        .filter(msg => msg.author_id !== user.id) // Exclude own messages
        .map(msg => ({
          id: msg.id,
          title: msg.title,
          content: msg.content,
          author_id: msg.author_id,
          is_for_all_users: msg.is_for_all_users,
          status: msg.status as 'active' | 'archived',
          created_at: msg.created_at,
          has_read: msg.has_read, // Add this property
          author: {
            display_name: msg.author_name,
            avatar_url: msg.author_avatar
          },
          recipients: [],
          confirmations: []
        }));

      // Separate read messages for user archive
      const unreadMessages = convertedReceivedMessages.filter(msg => !msg.has_read);
      const readMessages = convertedReceivedMessages.filter(msg => msg.has_read);

      setActiveMessages(unreadMessages);
      setArchivedUserMessages(readMessages);
      
      // For authored messages, fetch detailed recipient and confirmation data
      const sentMessagesWithDetails = await Promise.all(
        (authoredMessages || []).map(async (msg) => {
          let recipients = [];
          let confirmations = [];

          if (msg.is_for_all_users) {
            // Fetch confirmations for "all users" messages using basic query without relations
            const { data: confirmData } = await (supabase as any)
              .from('message_confirmations')
              .select('user_id, confirmed_at')
              .eq('message_id', msg.id);
            
            if (confirmData) {
              // Get profile data separately for each confirmation
              const confirmationsWithProfiles = await Promise.all(
                confirmData.map(async (conf: any) => {
                  const { data: profile } = await (supabase as any)
                    .from('profiles')
                    .select('display_name, avatar_url')
                    .eq('user_id', conf.user_id)
                    .maybeSingle();
                  
                  return {
                    ...conf,
                    profiles: profile
                  };
                })
              );
              confirmations = confirmationsWithProfiles;
            }
          } else {
            // Fetch recipients for targeted messages using basic query without relations
            const { data: recipientData } = await (supabase as any)
              .from('message_recipients')
              .select('recipient_id, has_read, read_at')
              .eq('message_id', msg.id);
            
            if (recipientData) {
              // Get profile data separately for each recipient
              const recipientsWithProfiles = await Promise.all(
                recipientData.map(async (rec: any) => {
                  const { data: profile } = await (supabase as any)
                    .from('profiles')
                    .select('display_name, avatar_url')
                    .eq('user_id', rec.recipient_id)
                    .maybeSingle();
                  
                  return {
                    ...rec,
                    profile: profile
                  };
                })
              );
              recipients = recipientsWithProfiles;
            }
          }

          return {
            id: msg.id,
            title: msg.title,
            content: msg.content,
            author_id: msg.author_id,
            is_for_all_users: msg.is_for_all_users,
            status: msg.status as 'active' | 'archived',
            created_at: msg.created_at,
            recipients,
            confirmations
          };
        })
       );

      const activeSent = sentMessagesWithDetails.filter(m => m.status === 'active');
      const archivedSent = sentMessagesWithDetails.filter(m => m.status === 'archived');
      
      setSentMessages(activeSent);
      setArchivedMessages([...archivedSent, ...readMessages]); // Combine archived sent and read received messages
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    
    // Debounced real-time subscriptions
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchMessages(), 1000);
    };

    const messagesChannel = supabase.channel('messages-channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, debouncedFetch)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_recipients'
      }, debouncedFetch)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_confirmations'
      }, debouncedFetch)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(messagesChannel);
    };
  }, [user]);

  const markAsRead = async (messageId: string, isForAllUsers: boolean) => {
    if (!user) return;

    try {
      await (supabase as any)
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

  const getPaginatedMessages = (messages: Message[], page: number) => {
    const startIndex = page * messagesPerPage;
    return messages.slice(startIndex, startIndex + messagesPerPage);
  };

  const getTotalPages = (totalMessages: number) => {
    return Math.ceil(totalMessages / messagesPerPage);
  };

  const PaginationControls = ({ 
    currentPage, 
    totalMessages, 
    onPageChange 
  }: { 
    currentPage: number; 
    totalMessages: number; 
    onPageChange: (page: number) => void; 
  }) => {
    const totalPages = getTotalPages(totalMessages);
    
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex items-center justify-between mt-4 px-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück
        </Button>
        <span className="text-sm text-muted-foreground">
          Seite {currentPage + 1} von {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
        >
          Weiter
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
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
                  {getPaginatedMessages(activeMessages, receivedPage).map((message) => {
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
            <PaginationControls
              currentPage={receivedPage}
              totalMessages={activeMessages.length}
              onPageChange={setReceivedPage}
            />
          </TabsContent>

          <TabsContent value="sent" className="mt-4">
            <ScrollArea className="h-96">
              {sentMessages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Keine gesendeten Nachrichten
                </p>
              ) : (
                <div className="space-y-3">
                  {getPaginatedMessages(sentMessages, sentPage).map((message) => {
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
                        
                        {/* Show recipients for targeted messages */}
                        {!message.is_for_all_users && message.recipients && message.recipients.length > 0 && (
                          <div className="space-y-2 mt-2">
                            <div className="text-xs font-medium text-muted-foreground">Empfänger:</div>
                            <div className="flex flex-wrap gap-2">
                              {message.recipients.map((recipient) => (
                                <div key={recipient.recipient_id} className="flex items-center gap-1 text-xs bg-muted/50 rounded px-2 py-1">
                                  <Avatar className="h-4 w-4">
                                    <AvatarImage src={recipient.profile?.avatar_url} />
                                    <AvatarFallback className="text-xs">
                                      {recipient.profile?.display_name?.charAt(0) || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{recipient.profile?.display_name || 'Unbekannt'}</span>
                                  {recipient.has_read ? (
                                    <div className="flex items-center gap-1 text-green-600">
                                      <Check className="h-3 w-3" />
                                      <span className="text-xs">
                                        {recipient.read_at && new Date(recipient.read_at).toLocaleDateString('de-DE', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Nicht gelesen</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                         {/* Show confirmations for "all users" messages */}
                         {message.is_for_all_users && message.confirmations && message.confirmations.length > 0 && (
                           <div className="space-y-2 mt-2">
                             <div className="text-xs font-medium text-muted-foreground">Bestätigt von:</div>
                             <div className="flex flex-wrap gap-2">
                               {message.confirmations.map((confirmation) => (
                                 <div key={confirmation.user_id} className="flex items-center gap-1 text-xs bg-muted/50 rounded px-2 py-1">
                                   <Avatar className="h-4 w-4">
                                     <AvatarImage src={(confirmation as any).profiles?.avatar_url} />
                                     <AvatarFallback className="text-xs">
                                       {(confirmation as any).profiles?.display_name?.charAt(0) || 'U'}
                                     </AvatarFallback>
                                   </Avatar>
                                   <span>{(confirmation as any).profiles?.display_name || 'Unbekannt'}</span>
                                   <div className="flex items-center gap-1 text-green-600">
                                     <Check className="h-3 w-3" />
                                     <span className="text-xs">
                                       {new Date(confirmation.confirmed_at).toLocaleDateString('de-DE', {
                                         day: '2-digit',
                                         month: '2-digit',
                                         hour: '2-digit',
                                         minute: '2-digit'
                                       })}
                                     </span>
                                   </div>
                                 </div>
                               ))}
                             </div>
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
            <PaginationControls
              currentPage={sentPage}
              totalMessages={sentMessages.length}
              onPageChange={setSentPage}
            />
          </TabsContent>

          <TabsContent value="archived" className="mt-4">
            <ScrollArea className="h-96">
              {archivedMessages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Keine archivierten Nachrichten
                </p>
              ) : (
                <div className="space-y-3">
                  {getPaginatedMessages(archivedMessages, archivePage).map((message) => (
                    <div key={message.id} className="p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Archive className="h-4 w-4 text-muted-foreground" />
                            {message.author?.display_name && (
                              <span className="text-sm font-medium">
                                Von: {message.author.display_name}
                              </span>
                            )}
                            {message.author_id === user?.id && (
                              <span className="text-sm font-medium text-primary">
                                Gesendet
                              </span>
                            )}
                            {message.is_for_all_users && (
                              <Badge variant="secondary" className="text-xs">
                                An alle
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-medium text-sm mb-1">{message.title}</h4>
                          <p className="text-xs text-muted-foreground mb-2">
                            {message.content}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Gesendet: {new Date(message.created_at).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          
                          {/* Show read confirmation for received messages */}
                          {message.author_id !== user?.id && (
                            <div className="mt-2">
                              <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded inline-block">
                                ✓ Als gelesen bestätigt
                              </div>
                            </div>
                          )}
                          
                          {/* Show confirmations for sent "all users" messages */}
                          {message.author_id === user?.id && message.is_for_all_users && message.confirmations && message.confirmations.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs font-medium text-muted-foreground mb-1">Bestätigt von:</div>
                              <div className="flex flex-wrap gap-1">
                                {message.confirmations.map((confirmation) => (
                                  <div key={confirmation.user_id} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                    {(confirmation as any).profiles?.display_name || 'Unbekannt'} - {new Date(confirmation.confirmed_at).toLocaleDateString('de-DE', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Show read status for sent targeted messages */}
                          {message.author_id === user?.id && !message.is_for_all_users && message.recipients && message.recipients.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs font-medium text-muted-foreground mb-1">Gelesen von:</div>
                              <div className="flex flex-wrap gap-1">
                                {message.recipients
                                  .filter(r => r.has_read)
                                  .map((recipient) => (
                                    <div key={recipient.recipient_id} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                      {recipient.profile?.display_name || 'Unbekannt'} - {recipient.read_at && new Date(recipient.read_at).toLocaleDateString('de-DE', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <PaginationControls
              currentPage={archivePage}
              totalMessages={archivedMessages.length}
              onPageChange={setArchivePage}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}