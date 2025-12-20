import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Settings, Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useMatrixClient } from '@/contexts/MatrixClientContext';
import { useToast } from '@/hooks/use-toast';
import { RoomList } from './RoomList';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { cn } from '@/lib/utils';

export function MatrixChatView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    isConnected,
    isConnecting,
    connectionError,
    rooms,
    credentials,
    sendMessage,
    getMessages,
    totalUnreadCount
  } = useMatrixClient();

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  // Load messages when room is selected
  useEffect(() => {
    if (selectedRoomId && isConnected) {
      const roomMessages = getMessages(selectedRoomId, 100);
      setMessages(roomMessages);
    }
  }, [selectedRoomId, isConnected, getMessages]);

  // Auto-select first room
  useEffect(() => {
    if (rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(rooms[0].roomId);
    }
  }, [rooms, selectedRoomId]);

  // Refresh messages periodically
  useEffect(() => {
    if (!selectedRoomId || !isConnected) return;

    const interval = setInterval(() => {
      const roomMessages = getMessages(selectedRoomId, 100);
      setMessages(roomMessages);
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedRoomId, isConnected, getMessages]);

  const handleSendMessage = async (message: string) => {
    if (!selectedRoomId) return;

    try {
      await sendMessage(selectedRoomId, message);
      // Refresh messages after sending
      setTimeout(() => {
        const roomMessages = getMessages(selectedRoomId, 100);
        setMessages(roomMessages);
      }, 500);
    } catch (error) {
      toast({
        title: 'Fehler beim Senden',
        description: error instanceof Error ? error.message : 'Nachricht konnte nicht gesendet werden',
        variant: 'destructive'
      });
    }
  };

  const selectedRoom = rooms.find(r => r.roomId === selectedRoomId);

  // Not connected - show setup prompt
  if (!credentials && !isConnecting) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Matrix Chat</CardTitle>
            <CardDescription>
              Verbinden Sie Ihren Matrix-Account, um den Chat zu nutzen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Mit der Matrix-Integration können Sie:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Nachrichten in Ihren Matrix-Räumen lesen</li>
                <li>Direkt aus der Plattform antworten</li>
                <li>Benachrichtigungen über neue Nachrichten erhalten</li>
              </ul>
            </div>
            <Button 
              onClick={() => navigate('/settings')} 
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Zu den Einstellungen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Connecting...
  if (isConnecting) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verbinde mit Matrix...</p>
        </div>
      </div>
    );
  }

  // Connection error
  if (connectionError) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Verbindungsfehler</AlertTitle>
          <AlertDescription className="mt-2">
            <p>{connectionError}</p>
            <Button 
              onClick={() => navigate('/settings')} 
              variant="outline" 
              size="sm" 
              className="mt-4"
            >
              Einstellungen überprüfen
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">Matrix Chat</h1>
              <p className="text-xs text-muted-foreground">
                {rooms.length} Räume • {totalUnreadCount} ungelesen
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
              isConnected 
                ? "bg-green-500/10 text-green-600" 
                : "bg-red-500/10 text-red-600"
            )}>
              {isConnected ? (
                <>
                  <Wifi className="h-3 w-3" />
                  <span>Verbunden</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  <span>Getrennt</span>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/settings')}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Room List */}
        <div className="w-72 border-r flex flex-col bg-muted/30">
          <div className="p-3 border-b">
            <h2 className="text-sm font-medium">Räume</h2>
          </div>
          <RoomList
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            onSelectRoom={setSelectedRoomId}
          />
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedRoom ? (
            <>
              {/* Room Header */}
              <div className="px-4 py-3 border-b bg-background">
                <h2 className="font-medium">{selectedRoom.name}</h2>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedRoom.roomId}
                </p>
              </div>

              {/* Messages */}
              <ChatMessages
                messages={messages}
                currentUserId={credentials?.userId}
              />

              {/* Input */}
              <ChatInput
                onSendMessage={handleSendMessage}
                disabled={!isConnected}
                placeholder={
                  isConnected 
                    ? `Nachricht an ${selectedRoom.name}...` 
                    : 'Nicht verbunden'
                }
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Wählen Sie einen Raum aus</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
