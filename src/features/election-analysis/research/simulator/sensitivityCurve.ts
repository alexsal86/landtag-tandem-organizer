import { attempt } from "../lab/shared";
import { secondVoteScenario } from "./model";
import { allocateBw2026 } from "./seats";
import type { SeatInput } from "./types";

const STEPS = 41;
const CENTER = 20;

/**
 * Sitzzahl einer Partei bei schrittweiser Verschiebung ihres Zweitstimmanteils
 * von −2 bis +2 Prozentpunkten (41 Punkte, 0,1-%-Schritte).
 */
export function buildSensitivityCurve(
  input: SeatInput,
  target: string,
  balancing: string | readonly string[],
) {
  return Array.from({ length: STEPS }, (_, i) => {
    const delta = (i - CENTER) / 10;
    const scenario = attempt(() => {
      const next = secondVoteScenario(
        input.parties,
        input.validSecond,
        { [target]: delta },
        balancing,
      );
      return allocateBw2026({
        ...input,
        parties: next.parties,
        excludedSecondVotes:
          delta === 0 ? input.excludedSecondVotes : undefined,
      });
    });
    return {
      delta,
      total: scenario.value?.total ?? null,
      seats: scenario.value?.rows.find((r) => r.id === target)?.total ?? null,
      error: scenario.error,
    };
  });
}
