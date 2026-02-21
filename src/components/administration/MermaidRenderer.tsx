import { useEffect, useMemo, useRef, useState } from "react";

interface MermaidRendererProps {
  chart: string;
}

declare global {
  interface Window {
    mermaid?: {
      initialize: (config: Record<string, unknown>) => void;
      run: (options: { nodes: HTMLElement[] }) => Promise<void>;
    };
  }
}

const MERMAID_SCRIPT_ID = "mermaid-cdn-script";
const MERMAID_SRC = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";

const ensureMermaidScript = () => {
  const existing = document.getElementById(MERMAID_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      if (window.mermaid) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Mermaid script failed to load")), { once: true });
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = MERMAID_SCRIPT_ID;
    script.src = MERMAID_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Mermaid script failed to load"));
    document.head.appendChild(script);
  });
};

export function MermaidRenderer({ chart }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>("");
  const chartMarkup = useMemo(() => `<div class=\"mermaid\">${chart}</div>`, [chart]);

  useEffect(() => {
    let mounted = true;
    setError("");

    ensureMermaidScript()
      .then(async () => {
        if (!window.mermaid || !containerRef.current) return;

        window.mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "default" });
        await window.mermaid.run({ nodes: [containerRef.current] });
      })
      .catch((e) => {
        console.error("Failed to render mermaid diagram", e);
        if (mounted) setError("Diagramm konnte nicht gerendert werden.");
      });

    return () => {
      mounted = false;
    };
  }, [chartMarkup]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return <div ref={containerRef} className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: chartMarkup }} />;
}
