import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MessageSquare, Settings, Wifi, WifiOff, Loader2, AlertCircle, Search, Plus, Lock, ExternalLink, PanelLeft, PanelLeftClose } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import type { MatrixReplyPreview } from '@/types/matrix';

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
    refreshMessages,
    loadOlderMessages,
    totalUnreadCount,
    roomMessages,
    roomHistoryState,
    typingUsers,
    sendTypingNotification,
    sendReadReceiptForLatestVisibleEvent,
    addReaction,
    removeReaction,
    createRoom,
    resetCryptoStore,
  } = useMatrixClient();

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [roomFilter, setRoomFilter] = useState<RoomFilterType>('all');
  const [replyTo, setReplyTo] = useState<MatrixReplyPreview | null>(null);
  const [isRoomListCollapsed, setIsRoomListCollapsed] = useState(false);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [scrollToEventId, setScrollToEventId] = useState<string | null>(null);
  const previousRoomIdRef = useRef<string | null>(null);

  // Get messages from context
  const messages = selectedRoomId ? (roomMessages.get(selectedRoomId) || []) : [];
  const currentTypingUsers = selectedRoomId ? (typingUsers.get(selectedRoomId) || []) : [];
  const currentRoomHistoryState = selectedRoomId
    ? (roomHistoryState.get(selectedRoomId) || { isLoadingMore: false, hasMoreHistory: true })
    : { isLoadingMore: false, hasMoreHistory: true };

  // Filter rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      if (roomFilter === 'all') return true;
      if (roomFilter === 'direct') return room.isDirect;
      if (roomFilter === 'groups') return !room.isDirect;
      return true;
    });
  }, [rooms, roomFilter]);

  const roomCounts = useMemo(() => ({
    all: rooms.length,
    direct: rooms.filter(r => r.isDirect).length,
    groups: rooms.filter(r => !r.isDirect).length,
  }), [rooms]);

  const selectedRoom = rooms.find(r => r.roomId === selectedRoomId);
  const isLovableHost = window.location.hostname.includes('lovable');
  const isTopLevelTab = (() => { try { return window.self === window.top; } catch { return false; } })();

  // Auto-select first room
  useEffect(() => {
    if (rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(rooms[0].roomId);
    }
  }, [rooms, selectedRoomId]);

  // Load initial messages when room is selected
  useEffect(() => {
    if (selectedRoomId && isConnected) {
      refreshMessages(selectedRoomId, 100);
    }
  }, [selectedRoomId, isConnected, refreshMessages]);

  useEffect(() => {
    const previousRoomId = previousRoomIdRef.current;

    if (previousRoomId && previousRoomId !== selectedRoomId) {
      sendTypingNotification(previousRoomId, false);
    }

    previousRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId, sendTypingNotification]);

  useEffect(() => {
    return () => {
      const currentRoomId = previousRoomIdRef.current;
      if (currentRoomId) {
        sendTypingNotification(currentRoomId, false);
      }
    };
  }, [sendTypingNotification]);


  // Fallback refresh for encrypted timelines if event callbacks are delayed/missed
  useEffect(() => {
    if (!selectedRoomId || !isConnected || !selectedRoom?.isEncrypted) return;

    const intervalId = window.setInterval(() => {
      refreshMessages(selectedRoomId, 100);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [selectedRoomId, selectedRoom?.isEncrypted, isConnected, refreshMessages]);

  const handleSendMessage = useCallback(async (message: string): Promise<void> => {
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

  const handleTyping = useCallback((isTyping: boolean): void => {
    if (selectedRoomId) {
      sendTypingNotification(selectedRoomId, isTyping);
    }
  }, [selectedRoomId, sendTypingNotification]);

  const handleReply = useCallback((eventId: string, sender: string, content: string): void => {
    setReplyTo({ eventId, sender, content });
  }, []);

  const handleAddReaction = useCallback(async (eventId: string, emoji: string): Promise<void> => {
    if (selectedRoomId) {
      await addReaction(selectedRoomId, eventId, emoji);
    }
  }, [selectedRoomId, addReaction]);

  const handleRemoveReaction = useCallback(async (eventId: string, emoji: string): Promise<void> => {
    if (selectedRoomId) {
      await removeReaction(selectedRoomId, eventId, emoji);
    }
  }, [selectedRoomId, removeReaction]);

  const handleLoadOlderMessages = useCallback((): void => {
    if (!selectedRoomId) return;
    void loadOlderMessages(selectedRoomId, 50);
  }, [loadOlderMessages, selectedRoomId]);

  const handleSelectMessage = useCallback((eventId: string): void => {
    setScrollToEventId(eventId);
    setHighlightedEventId(eventId);
    setShowSearch(false);
  }, []);

  useEffect(() => {
    if (!scrollToEventId) return;

    const timeoutId = window.setTimeout(() => {
      setScrollToEventId((current) => (current === scrollToEventId ? null : current));
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [scrollToEventId]);

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
              isConnecting
                ? "bg-amber-500/10 text-amber-600"
                : isConnected
                  ? "bg-green-500/10 text-green-600"
                  : "bg-red-500/10 text-red-600"
            )}>
              {isConnecting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Verbinde...</span>
                </>
              ) : isConnected ? (
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
        {!isRoomListCollapsed && (
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
          {isConnecting && rooms.length === 0 ? (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                  <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <RoomList
              rooms={filteredRooms}
              selectedRoomId={selectedRoomId}
              onSelectRoom={setSelectedRoomId}
            />
          )}
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedRoom ? (
            <>
              {/* Room Header */}
              <div className="px-4 py-3 border-b bg-background">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setIsRoomListCollapsed(!isRoomListCollapsed)}
                    title={isRoomListCollapsed ? 'Raumliste anzeigen' : 'Raumliste ausblenden'}
                  >
                    {isRoomListCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  </Button>
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
                    {e2eeDiagnostics.coiBlockedReason && (
                      <p className="font-medium mb-2">
                        Für verschlüsselte Räume bitte in neuem Tab öffnen.
                      </p>
                    )}
                    {e2eeDiagnostics.coiBlockedReason === 'iframe-preview' && (
                      <p className="text-xs mb-2">
                        Lovable läuft hier im eingebetteten Preview-iframe. In diesem Modus ist die benötigte Cross-Origin-Isolation technisch blockiert.
                      </p>
                    )}
                    {isLovableHost && isTopLevelTab && (
                      <p className="text-xs mb-2">
                        Diagnose: Lovable-Host im Top-Level-Tab erkannt (kein iframe). COI wird hier nicht pauschal blockiert.
                      </p>
                    )}
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
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <a 
                        href={window.location.href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline font-medium hover:no-underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        App in neuem Tab öffnen
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
                        onClick={async () => {
                          try {
                            await resetCryptoStore();
                          } catch {}
                        }}
                      >
                        Crypto zurücksetzen
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSettings(true)}
                      >
                        Einstellungen
                      </Button>
                    </div>
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
                onLoadOlderMessages={handleLoadOlderMessages}
                isLoadingOlderMessages={currentRoomHistoryState.isLoadingMore}
                hasMoreHistory={currentRoomHistoryState.hasMoreHistory}
                scrollToEventId={scrollToEventId}
                highlightedEventId={highlightedEventId}
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
              onSelectMessage={handleSelectMessage}
              onClose={() => setShowSearch(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
