import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUnsavedChangesGuard } from '../useUnsavedChangesGuard';

const onLeaveRequest = vi.fn();

const renderGuard = (dirty: boolean) =>
  renderHook(({ dirty: value }: { dirty: boolean }) =>
    useUnsavedChangesGuard({ dirty: value, onLeaveRequest }), { initialProps: { dirty } });

/**
 * jsdom kennt keine echte Navigation; ein Capture-Listener auf window hebt die
 * Default-Aktion auf, damit der Test nicht „Not implemented: navigation“ spammt.
 * Er ruft die native Methode auf, damit der Spy auf preventDefault nur die
 * Aufrufe des Guards zählt.
 */
const suppressNavigation = (event: Event) => Event.prototype.preventDefault.call(event);

const clickAnchor = (href: string, init: MouseEventInit = {}) => {
  const anchor = document.createElement('a');
  anchor.setAttribute('href', href);
  document.body.appendChild(anchor);
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  const preventDefault = vi.spyOn(event, 'preventDefault');
  window.addEventListener('click', suppressNavigation, true);
  anchor.dispatchEvent(event);
  window.removeEventListener('click', suppressNavigation, true);
  anchor.remove();
  return preventDefault;
};

const dispatchBeforeUnload = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
};

describe('useUnsavedChangesGuard', () => {
  beforeEach(() => {
    onLeaveRequest.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fragt bei einem internen Link nach, statt zu navigieren', () => {
    renderGuard(true);
    const preventDefault = clickAnchor('/documents?tab=letters');

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onLeaveRequest).toHaveBeenCalledWith('/documents?tab=letters');
  });

  it('lässt Link-Klicks ohne Änderungen durch', () => {
    renderGuard(false);
    const preventDefault = clickAnchor('/documents');

    expect(preventDefault).not.toHaveBeenCalled();
    expect(onLeaveRequest).not.toHaveBeenCalled();
  });

  it('ignoriert externe Links, neue Tabs und Klicks mit Zusatztaste', () => {
    renderGuard(true);

    expect(clickAnchor('https://example.org/x')).not.toHaveBeenCalled();
    expect(clickAnchor('/documents', { metaKey: true })).not.toHaveBeenCalled();
    expect(clickAnchor('/documents', { button: 1 })).not.toHaveBeenCalled();
    expect(clickAnchor(window.location.pathname)).not.toHaveBeenCalled();
    expect(onLeaveRequest).not.toHaveBeenCalled();
  });

  it('fragt bei Browser-Zurück nach und legt danach keinen weiteren Eintrag an', () => {
    renderGuard(true);

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onLeaveRequest).toHaveBeenCalledWith('back');
  });

  it('sichert Reload und Tab-Schließen über beforeunload ab', () => {
    renderGuard(true);
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
  });

  it('blockiert beforeunload ohne Änderungen nicht', () => {
    renderGuard(false);
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
  });

  it('fängt den Zurück-Knopf nach „Weiter bearbeiten" erneut ab', () => {
    const { result } = renderGuard(true);

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onLeaveRequest).toHaveBeenCalledTimes(1);

    result.current.keepOnPage();
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onLeaveRequest).toHaveBeenCalledTimes(2);
    expect(onLeaveRequest).toHaveBeenLastCalledWith('back');
  });
});
