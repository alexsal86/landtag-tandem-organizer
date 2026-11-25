import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copyText, todayLabel } from "./citation";
import type { InsightDigest as Digest } from "./research/insights";

/** Labels generated prose as generated and never hides its calculation basis. */
export function InsightDigest({
  digest,
  source,
  title = "Kurzfazit",
}: {
  digest: Digest;
  source: string;
  title?: string;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const copyAll = async () => {
    const text = [
      `${title} (automatisch generiert aus den geladenen Werten, ${todayLabel()})`,
      ...digest.sentences.map((sentence) => `• ${sentence.text}`),
      `Quelle: ${source}`,
    ].join("\n");
    try {
      await copyText(text);
      setStatus("Kurzfazit kopiert.");
    } catch {
      setStatus("Kopieren war nicht möglich.");
    }
  };
  return (
    <Card className="min-w-0">
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant="secondary">automatisch generiert</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Ausschließlich aus den geladenen Werten berechnet. Keine Prognose, keine
          Kausalaussage; Sätze mit fehlenden Grundwerten entfallen.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2 text-sm">
          {digest.sentences.map((sentence) => (
            <li key={sentence.id} className={sentence.id === "provenance" ? "text-muted-foreground" : undefined}>
              <p>{sentence.text}</p>
              <p className="text-[11px] text-muted-foreground">Grundlage: {sentence.basis}</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void copyAll()}>
            Kurzfazit kopieren
          </Button>
          <span className="text-xs text-muted-foreground">
            {digest.compared} vollständige Wertepaare · {digest.excluded} ohne Paar
          </span>
          {status && <span role="status" className="text-xs text-muted-foreground">{status}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
