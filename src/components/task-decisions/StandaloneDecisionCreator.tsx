import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Vote, Mail, Plus, MessageSquare, Globe, Star, Loader2, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { DecisionFileUpload } from "./DecisionFileUpload";
import { TopicSelector } from "@/components/topics/TopicSelector";
import { ResponseOptionsEditor } from "./ResponseOptionsEditor";
import { ResponseOptionsPreview } from "./ResponseOptionsPreview";
import { DECISION_TEMPLATES } from "@/lib/decisionTemplates";
import { useDecisionCreator } from "./hooks/useDecisionCreator";

interface StandaloneDecisionCreatorProps {
  onDecisionCreated: () => void;
  variant?: 'button' | 'icon';
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  caseItemId?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  onCreatedWithId?: (decisionId: string) => void;
}

const WIZARD_STEPS = [
  { title: "Inhalt", description: "Titel, Beschreibung und Frist" },
  { title: "Antworten", description: "Antworttyp und Empfehlung" },
  { title: "Empfänger", description: "Teilnehmer, Versand und Anhänge" },
] as const;

function DecisionWizardStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      {WIZARD_STEPS.map((step, index) => {
        const stepNumber = index + 1;
        const isDone = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;

        return (
          <div key={step.title} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 text-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : stepNumber}
              </div>
              <div className="space-y-0.5">
                <div className={`text-xs ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {step.title}
                </div>
                <div className="hidden sm:block text-[10px] text-muted-foreground">
                  {step.description}
                </div>
              </div>
            </div>
            {index < WIZARD_STEPS.length - 1 && (
              <div className={`mx-2 h-px flex-1 ${isDone ? "bg-primary/40" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export const StandaloneDecisionCreator = ({ 
  onDecisionCreated, 
  variant = 'button',
  isOpen: externalIsOpen,
  onOpenChange,
  caseItemId,
  defaultTitle,
  defaultDescription,
  onCreatedWithId,
}: StandaloneDecisionCreatorProps) => {
  const {
    isOpen,
    handleOpenChange,
    loadProfiles,
    handleSubmit,
    title,
    setTitle,
    description,
    setDescription,
    responseDeadline,
    setResponseDeadline,
    selectedUsers,
    setSelectedUsers,
    profilesLoaded,
    userOptions,
    isLoading,
    uploadStatus,
    sendByEmail,
    setSendByEmail,
    sendViaMatrix,
    setSendViaMatrix,
    visibleToAll,
    setVisibleToAll,
    setSelectedFiles,
    setSelectedFileMetadata,
    selectedTopicIds,
    setSelectedTopicIds,
    priority,
    setPriority,
    selectedTemplateId,
    handleTemplateChange,
    customOptions,
    setCustomOptions,
    currentOptions,
  } = useDecisionCreator({
    taskId: undefined,
    caseItemId,
    isOpen: externalIsOpen,
    onOpenChange,
    initialTitle: defaultTitle,
    initialDescription: defaultDescription,
    onDecisionCreated,
    onCreatedWithId,
  });
  const [step, setStep] = useState(1);

  const recommendedOption = currentOptions.find((option) => option.recommended);
  const canGoToNextStep = useMemo(() => {
    if (step === 1) {
      return Boolean(title.trim());
    }

    if (step === 2) {
      return currentOptions.length > 0;
    }

    return true;
  }, [currentOptions.length, step, title]);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
    }
  }, [isOpen]);

  const setRecommendedOption = (optionKey: string) => {
    if (optionKey === "none") {
      setCustomOptions((prev) => prev.map((option) => ({ ...option, recommended: false, recommendation_reason: "" })));
      return;
    }

    setCustomOptions((prev) => prev.map((option) => ({
      ...option,
      recommended: option.key === optionKey,
      recommendation_reason: option.key === optionKey ? option.recommendation_reason : "",
    })));
  };

  const setRecommendationReason = (reason: string) => {
    setCustomOptions((prev) => prev.map((option) =>
      option.recommended ? { ...option, recommendation_reason: reason } : option,
    ));
  };

  const TriggerButton = variant === 'icon' ? (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={loadProfiles}
      className="text-primary hover:text-primary/80"
    >
      <Vote className="h-4 w-4" />
    </Button>
  ) : (
    <Button 
      onClick={loadProfiles}
      size="sm"
    >
      <Plus className="h-3 w-3 mr-1" />
      Neue Entscheidung
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {TriggerButton}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Entscheidung anfordern</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 my-4">
          <DecisionWizardStepper currentStep={step} />

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Titel</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Kurze Beschreibung der Entscheidung"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Beschreibung (optional)</label>
                <SimpleRichTextEditor
                  initialContent={description}
                  onChange={setDescription}
                  placeholder="Zusätzliche Details zur Entscheidung"
                  minHeight="120px"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Antwortfrist (optional)</label>
                <Input
                  type="datetime-local"
                  value={responseDeadline}
                  onChange={(e) => setResponseDeadline(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center space-x-2 rounded-md border p-3">
                  <Checkbox
                    id="visible-to-all"
                    checked={visibleToAll}
                    onCheckedChange={(checked) => setVisibleToAll(checked === true)}
                  />
                  <label htmlFor="visible-to-all" className="text-sm font-medium flex items-center">
                    <Globe className="h-4 w-4 mr-1" />
                    Öffentlich (für alle sichtbar)
                  </label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border p-3">
                  <Checkbox
                    id="priority"
                    checked={priority}
                    onCheckedChange={(checked) => setPriority(checked === true)}
                  />
                  <label htmlFor="priority" className="text-sm font-medium flex items-center">
                    <Star className="h-4 w-4 mr-1 text-amber-500" />
                    Als prioritär markieren
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Antworttyp</label>
                  <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Antworttyp wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DECISION_TEMPLATES).map(([id, template]) => (
                        <SelectItem key={id} value={id}>
                          <div className="flex flex-col items-start">
                            <span>{template.name}</span>
                            <span className="text-xs text-muted-foreground">{template.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Vorschau</label>
                  <div className="mt-1 min-h-[48px] rounded-md border bg-muted/30 p-3">
                    {currentOptions.length > 0 ? (
                      <ResponseOptionsPreview options={currentOptions} />
                    ) : (
                      <p className="text-xs text-muted-foreground">Wählen Sie einen Antworttyp</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Empfohlene Antwort (optional)</label>
                  <Select value={recommendedOption?.key || "none"} onValueChange={setRecommendedOption}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Keine Empfehlung" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keine Empfehlung</SelectItem>
                      {currentOptions.map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.label || option.key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Begründung der Empfehlung (Tooltip)</label>
                  <Input
                    value={recommendedOption?.recommendation_reason || ""}
                    onChange={(e) => setRecommendationReason(e.target.value)}
                    placeholder="z. B. wegen Frist oder fachlicher Priorität"
                    disabled={!recommendedOption}
                    className="mt-1"
                  />
                </div>
              </div>

              {(selectedTemplateId === "custom" || selectedTemplateId === "rating5" || selectedTemplateId === "optionABC") && (
                <div className="space-y-2 rounded-md border p-4">
                  {(selectedTemplateId === "rating5" || selectedTemplateId === "optionABC") && (
                    <p className="text-xs text-muted-foreground">
                      Sie können die Beschreibungen der Optionen hier anpassen. Für komplett eigene Optionen wählen Sie "Benutzerdefiniert".
                    </p>
                  )}
                  <ResponseOptionsEditor
                    options={customOptions}
                    onChange={setCustomOptions}
                  />
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Benutzer auswählen{!visibleToAll && ' (mindestens einer erforderlich)'}</label>
                  {profilesLoaded ? (
                    <MultiSelect
                      options={userOptions}
                      selected={selectedUsers}
                      onChange={setSelectedUsers}
                      placeholder="Benutzer auswählen"
                    />
                  ) : (
                    <div className="flex h-10 w-full items-center rounded-md bg-muted px-3 text-muted-foreground">
                      Lade Benutzer...
                    </div>
                  )}
                </div>
                <div className="space-y-3 rounded-md border p-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="send-by-email"
                      checked={sendByEmail}
                      onCheckedChange={(checked) => setSendByEmail(checked === true)}
                    />
                    <label htmlFor="send-by-email" className="text-sm font-medium flex items-center">
                      <Mail className="h-4 w-4 mr-1" />
                      Auch per E-Mail versenden
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="send-via-matrix"
                      checked={sendViaMatrix}
                      onCheckedChange={(checked) => setSendViaMatrix(checked === true)}
                    />
                    <label htmlFor="send-via-matrix" className="text-sm font-medium flex items-center">
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Auch via Matrix versenden
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[70%_30%]">
                <div>
                  <label className="text-sm font-medium">Dateien anhängen (optional)</label>
                  <DecisionFileUpload
                    mode="creation"
                    onFilesSelected={setSelectedFiles}
                    onFilesPrepared={({ metadataByIdentity }) => setSelectedFileMetadata(metadataByIdentity)}
                    canUpload={true}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Themen (optional)</label>
                  <TopicSelector
                    selectedTopicIds={selectedTopicIds}
                    onTopicsChange={setSelectedTopicIds}
                    compact
                    placeholder="Themen hinzufügen..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Schritt {step} von {WIZARD_STEPS.length}: {WIZARD_STEPS[step - 1].description}
          </p>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setStep((current) => Math.max(1, current - 1))}
              disabled={isLoading || step === 1}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Zurück
            </Button>
          <Button 
            variant="outline" 
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Abbrechen
          </Button>
            {step < WIZARD_STEPS.length ? (
              <Button
                onClick={() => setStep((current) => Math.min(WIZARD_STEPS.length, current + 1))}
                disabled={isLoading || !canGoToNextStep}
              >
                Weiter
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {uploadStatus ?? "Erstelle..."}
                    </>
                  ) : "Erstellen"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
