import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clipboard, Check, AlertTriangle, Clock, Users, Pin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface BlackBoardMessage {
  id: string;
  title: string;
  content: string;
  author_id: string;
  created_at: string;
  author_name: string;
  author_avatar: string;
  has_read: boolean;
}

export function BlackBoard() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<BlackBoardMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPublicMessages = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .rpc('get_user_messages', { user_id_param: user.id });

      if (error) {
        console.error('Error fetching public messages:', error);
        return;
      }

      // Filter for relevant messages:
      // 1. Unread "An alle" messages from others
      // 2. Own "An alle" messages (regardless of read status)
      // 3. Unread personal messages addressed to the user
      const relevantMessages = (data || [])
        .filter(msg => {
          // Own "An alle" messages
          if (msg.is_for_all_users && msg.author_id === user.id) {
            return true;
          }
          // Unread "An alle" messages from others
          if (msg.is_for_all_users && !msg.has_read && msg.author_id !== user.id) {
            return true;
          }
          // Unread personal messages to the user
          if (!msg.is_for_all_users && !msg.has_read) {
            return true;
          }
          return false;
        })
        .slice(0, 5); // Limit to 5 most recent

      setMessages(relevantMessages);
    } catch (error) {
      console.error('Error fetching public messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicMessages();

    // Set up real-time subscription
    const messagesChannel = supabase.channel('blackboard-messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, () => {
        fetchPublicMessages();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_confirmations'
      }, () => {
        fetchPublicMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [user]);

  const confirmMessage = async (messageId: string) => {
    if (!user) return;

    try {
      await (supabase as any)
        .rpc('mark_message_read', {
          message_id_param: messageId,
          user_id_param: user.id,
          is_for_all_param: true
        });

      toast({
        title: "Bekanntmachung bestätigt",
        description: "Sie haben die Nachricht zur Kenntnis genommen."
      });

      fetchPublicMessages();
    } catch (error) {
      console.error('Error confirming message:', error);
      toast({
        title: "Fehler",
        description: "Die Bekanntmachung konnte nicht bestätigt werden.",
        variant: "destructive"
      });
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "vor wenigen Minuten";
    if (diffInHours < 24) return `vor ${diffInHours}h`;
    return `vor ${Math.floor(diffInHours / 24)}d`;
  };

  const getPriorityIcon = (createdAt: string) => {
    const hoursAgo = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
    
    if (hoursAgo < 2) return <AlertTriangle className="h-3 w-3 text-orange-500" />;
    if (hoursAgo < 24) return <Clock className="h-3 w-3 text-blue-500" />;
    return <Pin className="h-3 w-3 text-muted-foreground" />;
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Clipboard className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Schwarzes Brett</h3>
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-12 bg-muted rounded"></div>
          <div className="h-12 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Clipboard className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Schwarzes Brett</h3>
        </div>
        <div className="text-center py-4">
          <Clipboard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Keine neuen Bekanntmachungen</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clipboard className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Schwarzes Brett</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          <Users className="h-3 w-3 mr-1" />
          {messages.length}
        </Badge>
      </div>

      <div className="space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className="border rounded-lg p-3 bg-card hover:bg-accent/5 transition-colors"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={message.author_avatar} />
                    <AvatarFallback className="text-xs">
                      {message.author_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium truncate">
                    {message.author_name || 'Unbekannt'}
                  </span>
                  <div className="flex items-center gap-1">
                    {getPriorityIcon(message.created_at)}
                    <span className="text-xs text-muted-foreground">
                      {getTimeAgo(message.created_at)}
                    </span>
                  </div>
                </div>
                
                <h4 className="font-medium text-sm mb-1 line-clamp-1">
                  {message.title}
                </h4>
                
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {message.content.length > 80 
                    ? message.content.substring(0, 80) + '...'
                    : message.content
                  }
                </p>
              </div>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => confirmMessage(message.id)}
                className="shrink-0 h-8 w-8 p-0"
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {messages.length > 0 && (
        <div className="mt-3 pt-2 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Bestätigen Sie Bekanntmachungen mit <Check className="h-3 w-3 inline mx-1" />
          </p>
        </div>
      )}
    </div>
  );
}