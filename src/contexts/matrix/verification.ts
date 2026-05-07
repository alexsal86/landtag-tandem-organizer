import type { Verifier } from 'matrix-js-sdk/lib/crypto-api/verification';
import type { MatrixVerificationRequest } from './types';

/**
 * Waits for verificationRequest.verifier to be populated by the SDK (via the 'change' event).
 * Returns the verifier as soon as it appears, or null if timeoutMs elapses first.
 */
export async function awaitVerifierFromRequest(
  req: MatrixVerificationRequest,
  timeoutMs: number,
): Promise<Verifier | null> {
  const existing = req.verifier;
  if (existing) return existing;
  return new Promise<Verifier | null>((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const check = () => {
      const v = req.verifier;
      if (v) {
        clearTimeout(timeoutId);
        req.off?.('change', check);
        resolve(v);
      }
    };
    req.on?.('change', check);
    timeoutId = setTimeout(() => {
      req.off?.('change', check);
      resolve(null);
    }, timeoutMs);
  });
}
