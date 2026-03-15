import { useState } from "react";
import { RULE_TEMPLATES } from "./AutomationRuleWizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BookTemplate, Search, Zap } from "lucide-react";

const MODULE_LABELS: Record<string, string> = {
  tasks: "Aufgaben",
  meetings: "Meetings",
  decisions: "Entscheidungen",
  knowledge: "Wissen",
  cases: "Fallakten",
  casefiles: "Fallakten",
  contacts: "Kontakte",
};

const ACTION_LABELS: Record<string, string> = {
  create_notification: "Benachrichtigung",
  create_task: "Aufgabe erstellen",
  update_record_status: "Status ändern",
  send_push_notification: "Push senden",
  send_email_template: "E-Mail senden",
  create_approval_request: "Approval anfordern",
};

const TRIGGER_LABELS: Record<string, string> = {
  record_changed: "Datenänderung",
  schedule: "Zeitgesteuert",
  manual: "Manuell",
};

interface AutomationTemplateGalleryProps {
  onUseTemplate: (templateId: string) => void;
}

export function AutomationTemplateGallery({ onUseTemplate }: AutomationTemplateGalleryProps) {
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);

  const modules = [...new Set(RULE_TEMPLATES.map((t) => t.module))];

  const filtered = RULE_TEMPLATES.filter((t) => {
    if (moduleFilter && t.module !== moduleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.module.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookTemplate className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Template-Galerie</CardTitle>
            <CardDescription>Vorgefertigte Regeln mit einem Klick übernehmen</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Templates durchsuchen…"
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Button
              variant={moduleFilter === null ? "default" : "outline"}
              size="sm"
              onClick={() => setModuleFilter(null)}
            >
              Alle
            </Button>
            {modules.map((mod) => (
              <Button
                key={mod}
                variant={moduleFilter === mod ? "default" : "outline"}
                size="sm"
                onClick={() => setModuleFilter(moduleFilter === mod ? null : mod)}
              >
                {MODULE_LABELS[mod] || mod}
              </Button>
            ))}
          </div>
        </div>

        {/* Template grid */}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Keine Templates gefunden.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((template) => (
              <div
                key={template.id}
                className="rounded-lg border bg-card p-4 space-y-3 hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="space-y-1.5">
                  <p className="font-medium text-sm leading-tight">{template.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">
                    {MODULE_LABELS[template.module] || template.module}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {TRIGGER_LABELS[template.triggerType] || template.triggerType}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {template.actions.length} {template.actions.length === 1 ? "Aktion" : "Aktionen"}
                  </Badge>
                </div>

                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <p>
                    <span className="font-medium">Wenn:</span> {template.triggerField} = „{template.triggerValue}"
                  </p>
                  <p>
                    <span className="font-medium">Dann:</span>{" "}
                    {template.actions.map((a) => ACTION_LABELS[a.type] || a.type).join(", ")}
                  </p>
                </div>

                <Button
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => onUseTemplate(template.id)}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Als Regel übernehmen
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
