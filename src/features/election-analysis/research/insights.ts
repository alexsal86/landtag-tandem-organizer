export interface InsightPartyInput {
  party: string;
  before: number | null;
  after: number | null;
}

export interface InsightInput {
  beforeYear: number;
  afterYear: number;
  ballotLabel: string;
  turnoutBefore: number | null;
  turnoutAfter: number | null;
  parties: InsightPartyInput[];
  source: string;
  release?: string | null;
}

export interface InsightSentence {
  id: string;
  text: string;
  basis: string;
}

export interface InsightDigest {
  generated: true;
  sentences: InsightSentence[];
  compared: number;
  excluded: number;
}

const decimal = (value: number, digits = 1) =>
  value.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const signed = (value: number) => `${value > 0 ? "+" : ""}${decimal(value)}`;

const partyLabel = (party: string) => (party === "GRÜNE" ? "Grüne" : party);

/**
 * Generates sentences only from complete pairs. Missing values never become zero,
 * every sentence names its inputs, and the result is explicitly marked generated.
 */
export function buildInsightDigest(input: InsightInput): InsightDigest {
  const pairs = input.parties
    .filter(
      (row): row is { party: string; before: number; after: number } =>
        row.before !== null &&
        row.after !== null &&
        Number.isFinite(row.before) &&
        Number.isFinite(row.after),
    )
    .map((row) => ({ ...row, delta: row.after - row.before }))
    .sort((a, b) => b.delta - a.delta);
  const sentences: InsightSentence[] = [];
  const period = `${input.beforeYear} → ${input.afterYear}, ${input.ballotLabel}`;

  if (
    input.turnoutBefore !== null &&
    input.turnoutAfter !== null &&
    Number.isFinite(input.turnoutBefore) &&
    Number.isFinite(input.turnoutAfter)
  ) {
    const delta = input.turnoutAfter - input.turnoutBefore;
    sentences.push({
      id: "turnout",
      text:
        delta === 0
          ? `Die Wahlbeteiligung bleibt bei ${decimal(input.turnoutAfter)} % (${input.beforeYear}: ${decimal(input.turnoutBefore)} %).`
          : `Die Wahlbeteiligung ${delta > 0 ? "steigt" : "sinkt"} um ${decimal(Math.abs(delta))} Prozentpunkte auf ${decimal(input.turnoutAfter)} % (${input.beforeYear}: ${decimal(input.turnoutBefore)} %).`,
      basis: `turnout ${input.beforeYear}=${input.turnoutBefore}; turnout ${input.afterYear}=${input.turnoutAfter}`,
    });
  }

  if (pairs.length) {
    const gains = pairs.filter((row) => row.delta > 0);
    const losses = pairs.filter((row) => row.delta < 0);
    if (gains.length) {
      const top = gains[0];
      const totalGain = gains.reduce((sum, row) => sum + row.delta, 0);
      const share = totalGain > 0 ? (top.delta / totalGain) * 100 : null;
      sentences.push({
        id: "largest-gain",
        text: `Den größten Zugewinn verzeichnet ${partyLabel(top.party)} mit ${signed(top.delta)} Prozentpunkten (${decimal(top.before)} % → ${decimal(top.after)} %)${share !== null ? `; das sind ${decimal(share, 0)} % des gesamten Zugewinns der verglichenen Parteien` : ""}.`,
        basis: `${top.party}: ${top.before} → ${top.after}; Zugewinne: ${gains.map((row) => `${row.party} ${row.delta}`).join(", ")}`,
      });
    }
    if (losses.length) {
      const bottom = losses[losses.length - 1];
      sentences.push({
        id: "largest-loss",
        text: `Den größten Verlust verzeichnet ${partyLabel(bottom.party)} mit ${signed(bottom.delta)} Prozentpunkten (${decimal(bottom.before)} % → ${decimal(bottom.after)} %).`,
        basis: `${bottom.party}: ${bottom.before} → ${bottom.after}`,
      });
    }
    sentences.push({
      id: "balance",
      text: `${gains.length} der ${pairs.length} verglichenen Parteien gewinnen, ${losses.length} verlieren${pairs.length - gains.length - losses.length > 0 ? `, ${pairs.length - gains.length - losses.length} bleiben unverändert` : ""}.`,
      basis: `Zugewinne: ${gains.length}; Verluste: ${losses.length}; verglichen: ${pairs.length}`,
    });
  } else {
    sentences.push({
      id: "no-pairs",
      text: `Für ${period} liegen keine vollständigen Parteiwerte für beide Wahlen vor; es wird keine Veränderung behauptet.`,
      basis: "keine vollständigen Wertepaare",
    });
  }

  sentences.push({
    id: "provenance",
    text: `Grundlage: ${input.source}${input.release ? `, Datenstand ${input.release}` : ""}, ${period}; fehlende Werte bleiben unbekannt.`,
    basis: `${input.source}${input.release ? `, ${input.release}` : ""}`,
  });

  return {
    generated: true,
    sentences,
    compared: pairs.length,
    excluded: input.parties.length - pairs.length,
  };
}

/** Only generated sentences are offered for copying; values stay in `basis`. */
export function insightCitation(digest: InsightDigest, source: string) {
  return {
    title: "Automatisch generierter Insight-Digest",
    values: digest.sentences
      .filter((sentence) => sentence.id !== "provenance")
      .map((sentence) => sentence.text),
    source,
  };
}
