import { useEffect, useMemo, useState } from "react";

interface MermaidRendererProps {
  chart: string;
}

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
};

declare global {
  interface Window {
    mermaid?: MermaidApi;
  }
}

const MERMAID_SCRIPT_ID = "mermaid-cdn-script";
const MERMAID_SRC = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";

const ensureMermaidScript = async () => {
  const existing = document.getElementById(MERMAID_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    if (window.mermaid) return;
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Mermaid script failed to load")), { once: true });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
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
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const renderId = useMemo(() => `mywork-mermaid-${Math.random().toString(36).slice(2)}`, [chart]);

  useEffect(() => {
    let active = true;
    setError("");

    ensureMermaidScript()
      .then(async () => {
        if (!window.mermaid) throw new Error("Mermaid API unavailable");
        window.mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "default" });
        const result = await window.mermaid.render(renderId, chart);
        if (active) setSvg(result.svg);
      })
      .catch((e) => {
        console.error("Failed to render mermaid diagram", e);
        if (active) setError("Diagramm konnte nicht gerendert werden.");
      });

    return () => {
      active = false;
    };
  }, [chart, renderId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!svg) return <p className="text-sm text-muted-foreground">Diagramm wird geladen…</p>;

  return <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}
