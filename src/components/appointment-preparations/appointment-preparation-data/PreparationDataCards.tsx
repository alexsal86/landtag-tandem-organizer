import { CheckCircleIcon, ChevronDownIcon, ChevronRightIcon, FileTextIcon, PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { KeyboardEvent } from "react";
import type { ExpandedSections, QAPair, TalkingPointItem, TopicItem } from "./types";
import { DRESS_CODE_OPTIONS, FIELD_SECTIONS } from "./constants";
import { getFilledFieldsCount } from "./utils";

interface PreparationDataCardsProps {
  qaPairs: QAPair[];
  keyTopicItems: TopicItem[];
  talkingPointItems: TalkingPointItem[];
  editData: Record<string, unknown>;
  expandedSections: ExpandedSections;
  onToggleSection: (section: keyof ExpandedSections) => void;
  onFieldChange: (field: string, value: string) => void;
  onAddQaPair: () => void;
  onUpdateQaPair: (idx: number, field: 'question' | 'answer', value: string) => void;
  onRemoveQaPair: (idx: number) => void;
  onAddKeyTopicItem: () => void;
  onUpdateKeyTopicItem: (idx: number, field: 'topic' | 'background', value: string) => void;
  onRemoveKeyTopicItem: (idx: number) => void;
  onKeyTopicKeyDown: (e: KeyboardEvent<HTMLInputElement>, idx: number) => void;
  onAddTalkingPointItem: () => void;
  onUpdateTalkingPointItem: (idx: number, field: 'point' | 'background', value: string) => void;
  onRemoveTalkingPointItem: (idx: number) => void;
  onTalkingPointKeyDown: (e: KeyboardEvent<HTMLInputElement>, idx: number) => void;
}

function PreparationSection({
  sectionKey,
  editData,
  expandedSections,
  onToggleSection,
  onFieldChange,
}: {
  sectionKey: keyof typeof FIELD_SECTIONS;
  editData: Record<string, unknown>;
  expandedSections: ExpandedSections;
  onToggleSection: (section: keyof ExpandedSections) => void;
  onFieldChange: (field: string, value: string) => void;
}) {
  const section = FIELD_SECTIONS[sectionKey];
  const SectionIcon = section.icon;
  const isExpanded = expandedSections[sectionKey];
  const filledCount = getFilledFieldsCount(sectionKey, editData);

  return (
    <Collapsible
      key={sectionKey}
      open={isExpanded}
      onOpenChange={() => onToggleSection(sectionKey)}
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <SectionIcon className="h-5 w-5 text-primary" />
          <h3 className="font-medium">{section.title}</h3>
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
            {filledCount}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDownIcon className="h-4 w-4" />
        ) : (
          <ChevronRightIcon className="h-4 w-4" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-4">
        <div className="grid gap-4 md:grid-cols-2">
          {section.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <label className="text-sm font-medium">{field.label}</label>

              {(field as { type?: string }).type === "select" ? (
                <div className="space-y-2">
                  <Select
                    value={(editData[field.key] as string) || ""}
                    onValueChange={(value) => onFieldChange(field.key, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={field.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {DRESS_CODE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {editData[field.key] === "custom" && (
                    <Input
                      value={(editData[`${field.key}_custom`] as string) || ""}
                      onChange={(e) => onFieldChange(`${field.key}_custom`, e.target.value)}
                      placeholder="Benutzerdefinierte Kleiderordnung eingeben..."
                    />
                  )}
                </div>
              ) : (field as { type?: string }).type === "date" ? (
                <Input
                  type="date"
                  value={(editData[field.key] as string) || ""}
                  onChange={(e) => onFieldChange(field.key, e.target.value)}
                />
              ) : (field as { multiline?: boolean }).multiline ? (
                <Textarea
                  value={(editData[field.key] as string) || ""}
                  onChange={(e) => onFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="resize-none"
                />
              ) : (
                <Input
                  value={(editData[field.key] as string) || ""}
                  onChange={(e) => onFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                />
              )}

              {(editData[field.key] as React.ReactNode) && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircleIcon className="h-3 w-3" />
                  Ausgefüllt
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PreparationDataCards({
  qaPairs,
  keyTopicItems,
  talkingPointItems,
  editData,
  expandedSections,
  onToggleSection,
  onFieldChange,
  onAddQaPair,
  onUpdateQaPair,
  onRemoveQaPair,
  onAddKeyTopicItem,
  onUpdateKeyTopicItem,
  onRemoveKeyTopicItem,
  onKeyTopicKeyDown,
  onAddTalkingPointItem,
  onUpdateTalkingPointItem,
  onRemoveTalkingPointItem,
  onTalkingPointKeyDown,
}: PreparationDataCardsProps) {
  const allEmpty = Object.values(FIELD_SECTIONS).every((section) =>
    section.fields.every((field) => !editData[field.key]),
  );

  return (
    <>
      {/* Inhalte & Kommunikation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Vorbereitungsdaten · Inhalte & Kommunikation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <PreparationSection
            sectionKey="basics"
            editData={editData}
            expandedSections={expandedSections}
            onToggleSection={onToggleSection}
            onFieldChange={onFieldChange}
          />
          <PreparationSection
            sectionKey="communication"
            editData={editData}
            expandedSections={expandedSections}
            onToggleSection={onToggleSection}
            onFieldChange={onFieldChange}
          />

          {/* Wichtige Themen */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">Wichtige Themen</h4>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {keyTopicItems.length}
              </span>
            </div>
            {keyTopicItems.map((item, idx) => (
              <div key={item.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Input
                    value={item.topic}
                    onChange={(e) => onUpdateKeyTopicItem(idx, 'topic', e.target.value)}
                    onKeyDown={(e) => onKeyTopicKeyDown(e, idx)}
                    placeholder="Thema eingeben..."
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveKeyTopicItem(idx)}
                    className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  value={item.background}
                  onChange={(e) => onUpdateKeyTopicItem(idx, 'background', e.target.value)}
                  placeholder="Hintergrundinformationen (optional)"
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={onAddKeyTopicItem}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Thema hinzufügen
            </Button>
          </div>

          {/* Ergänzende Gesprächspunkte */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">Ergänzende Gesprächspunkte</h4>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {talkingPointItems.length}
              </span>
            </div>
            {talkingPointItems.map((item, idx) => (
              <div key={item.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Input
                    value={item.point}
                    onChange={(e) => onUpdateTalkingPointItem(idx, 'point', e.target.value)}
                    onKeyDown={(e) => onTalkingPointKeyDown(e, idx)}
                    placeholder="Gesprächspunkt eingeben..."
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveTalkingPointItem(idx)}
                    className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  value={item.background}
                  onChange={(e) => onUpdateTalkingPointItem(idx, 'background', e.target.value)}
                  placeholder="Hintergrundinformationen (optional)"
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={onAddTalkingPointItem}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Gesprächspunkt hinzufügen
            </Button>
          </div>

          {/* Fragen & Antworten */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">Fragen & Antworten</h4>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {qaPairs.length}
              </span>
            </div>
            {qaPairs.map((pair, idx) => (
              <div key={pair.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <div>
                      <label className="text-xs text-muted-foreground font-medium">Frage</label>
                      <Input
                        value={pair.question}
                        onChange={(e) => onUpdateQaPair(idx, 'question', e.target.value)}
                        placeholder="Mögliche Frage..."
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-medium">Antwort</label>
                      <Textarea
                        value={pair.answer}
                        onChange={(e) => onUpdateQaPair(idx, 'answer', e.target.value)}
                        placeholder="Vorbereitete Antwort..."
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveQaPair(idx)}
                    className="h-8 w-8 shrink-0 text-destructive hover:text-destructive mt-5"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={onAddQaPair}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Frage hinzufügen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Personen, Unterlagen & Rahmen */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Vorbereitungsdaten · Personen, Unterlagen & Rahmen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PreparationSection
            sectionKey="people"
            editData={editData}
            expandedSections={expandedSections}
            onToggleSection={onToggleSection}
            onFieldChange={onFieldChange}
          />
          <PreparationSection
            sectionKey="materials"
            editData={editData}
            expandedSections={expandedSections}
            onToggleSection={onToggleSection}
            onFieldChange={onFieldChange}
          />
          <PreparationSection
            sectionKey="framework"
            editData={editData}
            expandedSections={expandedSections}
            onToggleSection={onToggleSection}
            onFieldChange={onFieldChange}
          />
          {allEmpty && (
            <div className="text-center py-8 text-muted-foreground">
              <FileTextIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Noch keine Vorbereitungsdaten vorhanden.</p>
              <p className="text-sm">Klappen Sie die Bereiche auf, um Daten hinzuzufügen.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
