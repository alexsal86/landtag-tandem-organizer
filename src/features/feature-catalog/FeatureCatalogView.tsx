import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { catalogPages, entityMapMarkdown, type CatalogPage } from "./catalogContent";
import { MarkdownView } from "./MarkdownView";

const entityPage: CatalogPage = { id: "entity-map", title: "Entitätskarte", markdown: entityMapMarkdown };

const labelFor = (page: CatalogPage) => (page.id === "README" ? "Übersicht" : page.title);

export function FeatureCatalogView() {
  const pages = useMemo(() => [...catalogPages, entityPage], []);
  const [selectedId, setSelectedId] = useState(pages[0]?.id ?? "README");
  const current = pages.find((page) => page.id === selectedId) ?? pages[0];

  if (!current) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Der Funktionskatalog wurde beim Build nicht eingebunden. <code>npm run update:feature-catalog</code> ausführen und neu bauen.
      </div>
    );
  }

  const handleNavigate = (id: string) => {
    if (pages.some((page) => page.id === id)) setSelectedId(id);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Funktionskatalog</h1>
        <p className="text-sm text-muted-foreground">
          Schreibgeschützt. Erzeugt aus den Selbsttest-Szenarien und den Fremdschlüsseln; gepflegt wird nur der Generator.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bereiche</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <nav className="flex flex-col gap-1" aria-label="Katalogbereiche">
              {pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => setSelectedId(page.id)}
                  aria-current={page.id === current.id ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 text-left text-sm transition-colors",
                    page.id === current.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted",
                  )}
                >
                  {labelFor(page)}
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>
        <Card>
          <ScrollArea className="max-h-[calc(100vh-14rem)]">
            <CardContent className="px-5 py-4">
              <MarkdownView markdown={current.markdown} onNavigatePage={handleNavigate} />
            </CardContent>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
