import { useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { analysisReport, downloadReport, printReport } from "./reports";
export function ReportActions({
  root,
  title,
}: {
  root: RefObject<HTMLDivElement | null>;
  title: string;
}) {
  const [error, setError] = useState("");
  const create = (print: boolean) => {
    try {
      if (!root.current)
        throw new Error("Auswertung ist noch nicht verfügbar.");
      const html = analysisReport(
        root.current,
        title,
        window.location.href,
        new Date().toLocaleString("de-DE"),
      );
      if (print) printReport(html);
      else
        downloadReport(
          html,
          `Wahlanalyse-${new Date().toISOString().slice(0, 10)}.html`,
        );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bericht nicht verfügbar.");
    }
  };
  return (
    <div className="flex flex-wrap gap-2" data-report-exclude>
      <Button variant="outline" onClick={() => create(false)}>
        Bericht herunterladen
      </Button>
      <Button variant="outline" onClick={() => create(true)}>
        Drucken / PDF
      </Button>
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
