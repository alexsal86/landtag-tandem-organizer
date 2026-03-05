export type CoiBlockedReason = 'iframe' | 'preview-host' | 'iframe-preview' | null;

export interface CoiCapabilityStatus {
  blocked: boolean;
  reason: CoiBlockedReason;
  isInIframe: boolean;
  isPreviewHost: boolean;
}

declare global {
  interface Window {
    __coiCapabilityStatus?: CoiCapabilityStatus;
  }
}

export function isLovablePreviewHost(hostname: string): boolean {
  return (
    hostname.endsWith('lovable.app') ||
    hostname.endsWith('lovableproject.com') ||
    hostname.includes('lovable')
  );
}

export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function evaluateCoiCapabilityStatus(): CoiCapabilityStatus {
  const inIframe = isInIframe();
  const isPreviewHost = isLovablePreviewHost(window.location.hostname);

  let reason: CoiBlockedReason = null;
  if (inIframe && isPreviewHost) reason = 'iframe-preview';
  else if (inIframe) reason = 'iframe';

  return {
    blocked: Boolean(reason),
    reason,
    isInIframe: inIframe,
    isPreviewHost,
  };
}

export function setCoiCapabilityStatus(status: CoiCapabilityStatus): void {
  window.__coiCapabilityStatus = status;
}

export function getCoiCapabilityStatus(): CoiCapabilityStatus {
  return window.__coiCapabilityStatus ?? evaluateCoiCapabilityStatus();
}
