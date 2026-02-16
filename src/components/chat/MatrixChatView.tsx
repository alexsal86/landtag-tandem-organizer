import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Settings, Wifi, WifiOff, Loader2, AlertCircle, Search, Plus, Lock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMatrixClient } from '@/contexts/MatrixClientContext';
import { useToast } from '@/hooks/use-toast';
import { RoomList } from './RoomList';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { MatrixLoginForm } from './MatrixLoginForm';
import { TypingIndicator } from './TypingIndicator';
import { ChatSearch } from './ChatSearch';
import { RoomFilter, RoomFilterType } from './RoomFilter';
import { CreateRoomDialog } from './CreateRoomDialog';
import { ReplyPreview } from './ReplyPreview';
import { cn } from '@/lib/utils';

export function MatrixChatView() {
  const { toast } = useToast();
  const {
    isConnected,
    isConnecting,
    connectionError,
    cryptoEnabled,
    e2eeDiagnostics,
    rooms,
    credentials,
    sendMessage,
    getMessages,
    totalUnreadCount,
    roomMessages,
    typingUsers,
    sendTypingNotification,
    addReaction,
    removeReaction,
    createRoom,
  } = useMatrixClient();

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [roomFilter, setRoomFilter] = useState<RoomFilterType>('all');
  const [replyTo, setReplyTo] = useState<{ eventId: string; sender: string; content: string } | null>(null);

  // Get messages from context
  const messages = selectedRoomId ? (roomMessages.get(selectedRoomId) || []) : [];
  const currentTypingUsers = selectedRoomId ? (typingUsers.get(selectedRoomId) || []) : [];

  // Filter rooms
  const filteredRooms = rooms.filter(room => {
    if (roomFilter === 'all') return true;
    if (roomFilter === 'direct') return room.isDirect;
    if (roomFilter === 'groups') return !room.isDirect;
    return true;
  });

  const roomCounts = {
    all: rooms.length,
    direct: rooms.filter(r => r.isDirect).length,
    groups: rooms.filter(r => !r.isDirect).length,
  };

  // Auto-select first room
  useEffect(() => {
    if (rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(rooms[0].roomId);
    }
  }, [rooms, selectedRoomId]);

  // Load initial messages when room is selected
  useEffect(() => {
    if (selectedRoomId && isConnected) {
      getMessages(selectedRoomId, 100);
    }
  }, [selectedRoomId, isConnected, getMessages]);


  // Fallback refresh for encrypted timelines if event callbacks are delayed/missed
  useEffect(() => {
    if (!selectedRoomId || !isConnected) return;

    const intervalId = window.setInterval(() => {
      getMessages(selectedRoomId, 100);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [selectedRoomId, isConnected, getMessages]);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!selectedRoomId) return;

    try {
      await sendMessage(selectedRoomId, message, replyTo?.eventId);
      setReplyTo(null);
    } catch (error) {
      toast({
        title: 'Fehler beim Senden',
        description: error instanceof Error ? error.message : 'Nachricht konnte nicht gesendet werden',
        variant: 'destructive'
      });
    }
  }, [selectedRoomId, sendMessage, replyTo, toast]);

  const handleTyping = useCallback((isTyping: boolean) => {
    if (selectedRoomId) {
      sendTypingNotification(selectedRoomId, isTyping);
    }
  }, [selectedRoomId, sendTypingNotification]);

  const handleReply = useCallback((eventId: string, sender: string, content: string) => {
    setReplyTo({ eventId, sender, content });
  }, []);

  const handleAddReaction = useCallback(async (eventId: string, emoji: string) => {
    if (selectedRoomId) {
      await addReaction(selectedRoomId, eventId, emoji);
    }
  }, [selectedRoomId, addReaction]);

  const handleRemoveReaction = useCallback(async (eventId: string, emoji: string) => {
    if (selectedRoomId) {
      await removeReaction(selectedRoomId, eventId, emoji);
    }
  }, [selectedRoomId, removeReaction]);

  const selectedRoom = rooms.find(r => r.roomId === selectedRoomId);

  // Show settings/login form
  if (showSettings || (!credentials && !isConnecting)) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Matrix Chat
          </h1>
          {credentials && (
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Zurück zum Chat
            </Button>
          )}
        </div>
        <MatrixLoginForm />
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
              onClick={() => setShowSettings(true)} 
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
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
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
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="text-sm font-medium">Räume</h2>
            <CreateRoomDialog
              onCreateRoom={createRoom}
              trigger={
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Plus className="h-4 w-4" />
                </Button>
              }
            />
          </div>
          <RoomFilter
            activeFilter={roomFilter}
            onFilterChange={setRoomFilter}
            counts={roomCounts}
          />
          <RoomList
            rooms={filteredRooms}
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
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{selectedRoom.name}</h2>
                  {selectedRoom.isEncrypted && (
                    <span className={cn(
                      "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded",
                      cryptoEnabled 
                        ? "text-green-600 bg-green-500/10" 
                        : "text-amber-600 bg-amber-500/10"
                    )}>
                      <Lock className="h-3 w-3" />
                      {cryptoEnabled ? 'E2EE' : 'E2EE nicht verfügbar'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedRoom.memberCount} Mitglieder
                </p>
              </div>

              {/* Warning for encrypted rooms without crypto */}
              {selectedRoom.isEncrypted && !cryptoEnabled && (
                <Alert variant="destructive" className="mx-4 mt-2 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Verschlüsselung nicht verfügbar</AlertTitle>
                  <AlertDescription className="mt-1">
                    Die Verschlüsselung konnte in dieser Sitzung nicht initialisiert werden. Laut Matrix JS SDK sollten für Rust-Crypto mindestens sicherer Kontext, Cross-Origin-Isolation und SharedArrayBuffer verfügbar sein.
                    <ul className="mt-2 space-y-1 text-xs">
                      <li>• HTTPS / sicherer Kontext: {e2eeDiagnostics.secureContext ? '✅' : '❌'}</li>
                      <li>• Cross-Origin-Isolation: {e2eeDiagnostics.crossOriginIsolated ? '✅' : '❌'}</li>
                      <li>• SharedArrayBuffer: {e2eeDiagnostics.sharedArrayBuffer ? '✅' : '❌'}</li>
                      <li>• Service Worker aktiv: {e2eeDiagnostics.serviceWorkerControlled ? '✅' : '❌'}</li>
                      <li>• Secret Storage bereit: {e2eeDiagnostics.secretStorageReady === null ? '–' : e2eeDiagnostics.secretStorageReady ? '✅' : '❌'}</li>
                      <li>• Cross-Signing bereit: {e2eeDiagnostics.crossSigningReady === null ? '–' : e2eeDiagnostics.crossSigningReady ? '✅' : '❌'}</li>
                      <li>• Key Backup aktiv: {e2eeDiagnostics.keyBackupEnabled === null ? '–' : e2eeDiagnostics.keyBackupEnabled ? '✅' : '❌'}</li>
                    </ul>
                    {e2eeDiagnostics.cryptoError && (
                      <p className="mt-2 text-xs break-words">
                        Letzter Fehler: {e2eeDiagnostics.cryptoError}
                      </p>
                    )}
                    <a 
                      href={window.location.href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 ml-2 underline font-medium hover:no-underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      App in neuem Tab öffnen
                    </a>
                  </AlertDescription>
                </Alert>
              )}

              {/* Messages */}
              <ChatMessages
                messages={messages}
                currentUserId={credentials?.userId}
                homeserverUrl={credentials?.homeserverUrl || 'https://matrix.org'}
                onReply={handleReply}
                onAddReaction={handleAddReaction}
                onRemoveReaction={handleRemoveReaction}
              />

              {/* Typing Indicator */}
              <TypingIndicator typingUsers={currentTypingUsers} />

              {/* Reply Preview */}
              {replyTo && (
                <ReplyPreview
                  replyTo={replyTo}
                  onCancel={() => setReplyTo(null)}
                  className="mx-4 mb-2"
                />
              )}

              {/* Input */}
              <ChatInput
                onSendMessage={handleSendMessage}
                onTyping={handleTyping}
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

        {/* Search Panel */}
        {showSearch && (
          <div className="w-80">
            <ChatSearch
              messages={messages}
              onClose={() => setShowSearch(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
