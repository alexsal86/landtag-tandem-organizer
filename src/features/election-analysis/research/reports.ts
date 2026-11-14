const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/** Export a separate static document; strip behavior and keep rendered SVG figures, never external screenshots. */
export function analysisReport(
  root: HTMLElement,
  title: string,
  url: string,
  createdAt: string,
) {
  const clone = root.cloneNode(true) as HTMLElement;
  const originalInputs = root.querySelectorAll("input,select,textarea");
  const clonedInputs = clone.querySelectorAll("input,select,textarea");
  originalInputs.forEach((node, index) => {
    const target = clonedInputs[index];
    if (!target) return;
    const span = document.createElement("span");
    if (node instanceof HTMLInputElement)
      span.textContent =
        node.type === "file"
          ? "Lokale Datei"
          : node.type === "checkbox"
            ? node.checked
              ? "Ja"
              : "Nein"
            : node.value;
    else if (node instanceof HTMLSelectElement)
      span.textContent = node.selectedOptions[0]?.textContent || node.value;
    else if (node instanceof HTMLTextAreaElement) span.textContent = node.value;
    target.replaceWith(span);
  });
  const originals = root.querySelectorAll("svg"),
    figures = clone.querySelectorAll("svg");
  originals.forEach((svg, index) => {
    const copy = figures[index];
    if (!copy) return;
    const rect = svg.getBoundingClientRect();
    if (!copy.hasAttribute("viewBox") && rect.width && rect.height)
      copy.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    const sourceNodes = [svg, ...svg.querySelectorAll("*")],
      targetNodes = [copy, ...copy.querySelectorAll("*")];
    sourceNodes.forEach((source, i) => {
      const target = targetNodes[i];
      if (!target) return;
      const css = getComputedStyle(source);
      for (const key of [
        "fill",
        "stroke",
        "stroke-width",
        "opacity",
        "font-family",
        "font-size",
        "font-weight",
        "color",
      ])
        target.setAttribute(key, css.getPropertyValue(key));
      if(source.tagName.toLowerCase()==="text"){target.setAttribute("fill","#20251d");target.setAttribute("stroke","none");}
    });
  });
  clone.querySelectorAll(".bw-election-map").forEach((map) => {
    const svg = map.querySelector("svg");
    const figure = document.createElement("figure");
    if (svg) {
      const copy = svg.cloneNode(true) as SVGElement;
      copy.removeAttribute("style");
      copy.setAttribute("width", "100%");
      copy.setAttribute("height", "auto");
      figure.append(copy);
      const caption = document.createElement("figcaption");
      caption.textContent =
        "Kartenausschnitt wie angezeigt; Geometrie und Datenstand gemäß Quellenangabe.";
      figure.append(caption);
    } else figure.textContent = "Karte nicht verfügbar.";
    map.replaceWith(figure);
  });
  clone
    .querySelectorAll(
      "[data-report-exclude],script,iframe,object,embed,foreignObject,canvas,button,nav",
    )
    .forEach((node) => node.remove());
  clone
    .querySelectorAll("details")
    .forEach((node) => node.setAttribute("open", ""));
  clone.querySelectorAll("*").forEach((node) => {
    for (const attr of [...node.attributes]) {
      if (
        /^on/i.test(attr.name) ||
        (/^(src|href|xlink:href)$/i.test(attr.name) &&
          !/^(https?:|#)/i.test(attr.value))
      )
        node.removeAttribute(attr.name);
    }
    if (node.tagName.toLowerCase() !== "svg") node.removeAttribute("tabindex");
  });
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'"><title>${escape(title)}</title><style>body{font:14px/1.5 system-ui,sans-serif;color:#20251d;background:#fff;max-width:1100px;margin:32px auto;padding:0 20px}h1,h2,h3{line-height:1.25}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{padding:7px;text-align:left;border-bottom:1px solid #ccd1c7;vertical-align:top}th{background:#edf0e8}p,details{margin:12px 0}a{color:#234f83}svg{max-width:100%}figure{margin:20px 0}figcaption,footer{font-size:11px;color:#62695b}.recharts-wrapper{max-width:100%;height:auto!important}.recharts-responsive-container{height:auto!important;min-height:250px}.space-y-4>*{margin-bottom:16px}@media print{body{margin:0;max-width:none}h2,h3{break-after:avoid}tr,figure{break-inside:avoid}a{color:inherit;text-decoration:none}svg{max-height:24cm}}</style></head><body><header><h1>${escape(title)}</h1><p>Erstellt: ${escape(createdAt)}<br>Auswahl: ${escape(url)}</p><p>Bericht umfasst die aktuell dargestellten Tabellenzeilen und geladenen Grafiken. Für vollständige Rohdaten den CSV-Export der jeweiligen Ansicht verwenden. Szenarien und Modellwerte sind keine amtlichen Wahlergebnisse.</p></header><main>${clone.innerHTML}</main><footer>Quellen, Datenstände, Annahmen und Einschränkungen stehen bei den jeweiligen Auswertungen. Fehlende Daten wurden nicht durch null Stimmen ersetzt.</footer></body></html>`;
}
export function downloadReport(html: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([html], { type: "text/html;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function printReport(html: string) {
  const popup = window.open("", "_blank");
  if (!popup)
    throw new Error(
      "Druckansicht wurde vom Browser blockiert. Bitte Bericht herunterladen.",
    );
  popup.opener = null;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 250);
}
