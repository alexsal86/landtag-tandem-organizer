import { useCallback, useEffect, useRef } from 'react';

/** Ziel eines bestätigten Verlassens: interne Route oder Browser-Zurück. */
export type UnsavedLeaveTarget = string | 'back';

interface UnsavedChangesGuardOptions {
  dirty: boolean;
  onLeaveRequest: (target: UnsavedLeaveTarget) => void;
}

/**
 * Merkmal des zusätzlichen History-Eintrags, der den Zurück-Knopf abfängt.
 * Bewusst klein und stabil, damit sich der Eintrag nicht mit Router-State beißt.
 */
const SENTRY_STATE = { unsavedEditorGuard: true };

/**
 * Schützt das Verlassen der Seite trotz deklarativem `BrowserRouter`, der keinen
 * `useBlocker` anbietet:
 *
 * - Reload und Tab schließen: `beforeunload`
 * - interne Links: Capture-Click-Listener; React Router führt einen Link nicht
 *   aus, wenn `defaultPrevented` gesetzt ist
 * - Zurück/Vor: ein zusätzlicher History-Eintrag mit derselben URL, damit der
 *   Zurück-Knopf auf der Seite landet statt sie zu verlassen
 *
 * Der Aufrufer entscheidet im Dialog. Wer bleibt, ruft `keepOnPage`, damit der
 * Zurück-Knopf erneut abgefangen wird.
 */
export function useUnsavedChangesGuard({ dirty, onLeaveRequest }: UnsavedChangesGuardOptions) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const requestRef = useRef(onLeaveRequest);
  requestRef.current = onLeaveRequest;
  const sentryRef = useRef(false);

  const pushSentry = useCallback(() => {
    window.history.pushState(SENTRY_STATE, '', window.location.href);
    sentryRef.current = true;
  }, []);

  useEffect(() => {
    if (!dirty) return;
    if (!sentryRef.current) pushSentry();
    const handlePopState = () => {
      // Der Sentry-Eintrag ist verlassen; wir stehen wieder auf der Briefseite.
      sentryRef.current = false;
      requestRef.current('back');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dirty, pushSentry]);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!dirtyRef.current) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor) return;
      if (anchor.getAttribute('target') === '_blank' || anchor.hasAttribute('download')) return;
      let url: URL;
      try {
        url = new URL(anchor.getAttribute('href') ?? '', window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      requestRef.current(`${url.pathname}${url.search}`);
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  /** Nach „Weiter bearbeiten" den Sentry-Eintrag erneuern. */
  const keepOnPage = useCallback(() => {
    if (!dirtyRef.current || sentryRef.current) return;
    pushSentry();
  }, [pushSentry]);

  return { keepOnPage };
}
