import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Clipboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMessagesRealtime } from "@/hooks/useMessagesRealtime";
import { BlackBoard } from "./BlackBoard";
import { MessageSystem } from "./MessageSystem";

interface CombinedMessagesWidgetProps {
  configuration?: any;
}

export function CombinedMessagesWidget({ configuration }: CombinedMessagesWidgetProps) {
  const { user } = useAuth();
  const [blackboardCount, setBlackboardCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [activeTab, setActiveTab] = useState("blackboard");

  const fetchUnreadCounts = useCallback(async () => {
    if (!user) return;

    try {
      // Single RPC call instead of two identical ones
      const { data, error } = await (supabase as any)
        .rpc('get_user_messages', { user_id_param: user.id });

      if (!error && data) {
        const unconfirmedBlackboardMessages = data
          .filter(msg => msg.is_for_all_users && !msg.has_read && msg.author_id !== user.id);
        setBlackboardCount(unconfirmedBlackboardMessages.length);

        const unreadPersonalMessages = data
          .filter(msg => !msg.is_for_all_users && !msg.has_read && msg.author_id !== user.id);
        setMessagesCount(unreadPersonalMessages.length);
      }
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCounts();
  }, [user, fetchUnreadCounts]);

  // Use shared messages realtime subscription instead of 3 separate channels
  useMessagesRealtime(() => {
    fetchUnreadCounts();
  });

  const totalCount = blackboardCount + messagesCount;

  return (
    <Card className="bg-card shadow-card border-border h-full w-full max-w-full overflow-hidden hover:shadow-elegant transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 truncate text-lg">
            <MessageCircle className="h-5 w-5" />
            <span className="truncate">Nachrichten & Brett</span>
          </CardTitle>
          {totalCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {totalCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 h-full overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mx-4 mt-2">
            <TabsTrigger value="blackboard" className="relative">
              <Clipboard className="h-4 w-4 mr-2" />
              Schwarzes Brett
              {blackboardCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="ml-2 h-5 w-5 p-0 text-xs animate-pulse"
                >
                  {blackboardCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="messages" className="relative">
              <MessageCircle className="h-4 w-4 mr-2" />
              Nachrichten
              {messagesCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="ml-2 h-5 w-5 p-0 text-xs animate-pulse"
                >
                  {messagesCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="blackboard" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <div className="flex-1 overflow-hidden">
                <BlackBoard />
              </div>
            </TabsContent>

            <TabsContent value="messages" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <div className="flex-1 overflow-hidden">
                <MessageSystem />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}