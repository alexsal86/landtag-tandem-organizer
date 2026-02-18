import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Listener = () => void;

/**
 * Shared Realtime hook for messages, message_recipients, and message_confirmations.
 * All message-related components (BlackBoard, MessageSystem, CombinedMessagesWidget)
 * should use this single hook instead of creating their own Realtime subscriptions.
 * 
 * Events are debounced to prevent rapid-fire refetches.
 */
const listeners = new Set<Listener>();
let channelRef: ReturnType<typeof supabase.channel> | null = null;
let currentUserId: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function notifyListeners() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    listeners.forEach(fn => fn());
  }, 1000);
}

function ensureChannel(userId: string) {
  if (channelRef && currentUserId === userId) return;
  
  // Clean up old channel
  if (channelRef) {
    supabase.removeChannel(channelRef);
    channelRef = null;
  }

  currentUserId = userId;
  channelRef = supabase
    .channel('shared-messages-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `author_id=eq.${userId}`,
    }, notifyListeners)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `author_id=eq.${userId}`,
    }, notifyListeners)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'message_recipients',
      filter: `recipient_id=eq.${userId}`,
    }, notifyListeners)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'message_confirmations',
    }, notifyListeners)
    .subscribe();
}

function cleanupChannel() {
  if (listeners.size > 0) return; // Other subscribers still active
  if (channelRef) {
    supabase.removeChannel(channelRef);
    channelRef = null;
    currentUserId = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

/**
 * Subscribe to shared messages realtime events.
 * Call the returned callback (onEvent) whenever messages/confirmations/recipients change.
 * The callback is debounced at 1s to prevent rapid refetches.
 */
export function useMessagesRealtime(onEvent: () => void) {
  const { user } = useAuth();
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  const stableCallback = useCallback(() => {
    callbackRef.current();
  }, []);

  useEffect(() => {
    if (!user) return;

    listeners.add(stableCallback);
    ensureChannel(user.id);

    return () => {
      listeners.delete(stableCallback);
      cleanupChannel();
    };
  }, [user, stableCallback]);
}
