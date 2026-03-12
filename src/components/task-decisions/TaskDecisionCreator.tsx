import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import { Vote, Mail, MessageSquare, Globe, Star, Loader2 } from "lucide-react";
import { DecisionFileUpload } from "./DecisionFileUpload";
import { TopicSelector } from "@/components/topics/TopicSelector";
import { ResponseOptionsEditor } from "./ResponseOptionsEditor";
import { ResponseOptionsPreview } from "./ResponseOptionsPreview";
import { DECISION_TEMPLATES } from "@/lib/decisionTemplates";
import { useDecisionCreator } from "./hooks/useDecisionCreator";

interface TaskDecisionCreatorProps {
  taskId: string;
  onDecisionCreated: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialTitle?: string;
  initialDescription?: string;
}

export const TaskDecisionCreator = ({ 
  taskId, 
  onDecisionCreated,
  isOpen: externalOpen,
  onOpenChange: externalOnOpenChange,
  initialTitle,
  initialDescription
}: TaskDecisionCreatorProps) => {
  const {
    isOpen,
    isControlled,
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
    taskId,
    isOpen: externalOpen,
    onOpenChange: externalOnOpenChange,
    initialTitle,
    initialDescription,
    onDecisionCreated,
  });

  const recommendedOption = currentOptions.find((option) => option.recommended);

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

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {/* Only render trigger when NOT externally controlled */}
      {!isControlled && (
        <DialogTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={loadProfiles}
            className="text-destructive hover:text-destructive/80"
          >
            <Vote className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Entscheidung anfordern</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 my-4">
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
              minHeight="100px"
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
          {/* Öffentlich + Priorität nebeneinander */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
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
            <div className="flex items-center space-x-2">
              <Checkbox
                id="task-priority"
                checked={priority}
                onCheckedChange={(checked) => setPriority(checked === true)}
              />
              <label htmlFor="task-priority" className="text-sm font-medium flex items-center">
                <Star className="h-4 w-4 mr-1 text-amber-500" />
                Als prioritär markieren
              </label>
            </div>
          </div>

          {/* Antworttyp + Vorschau nebeneinander */}
          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div>
              <label className="text-sm font-medium">Antworttyp</label>
              <Select
                value={selectedTemplateId}
                onValueChange={handleTemplateChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Antworttyp wählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(DECISION_TEMPLATES).map((template) => (
                    <SelectItem key={template.id} value={template.id}>
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
              <div className="mt-1 p-3 border rounded-md bg-muted/30 min-h-[40px]">
                {currentOptions.length > 0 ? (
                  <ResponseOptionsPreview options={currentOptions} />
                ) : (
                  <p className="text-xs text-muted-foreground">Wählen Sie einen Antworttyp</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          {/* Auto-expand options for Rating5 and OptionABC */}
          {(selectedTemplateId === "custom" || selectedTemplateId === "rating5" || selectedTemplateId === "optionABC") && (
            <div className="space-y-2">
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

          <div className="grid grid-cols-2 gap-4">
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
                <div className="w-full h-10 bg-muted rounded-md flex items-center px-3 text-muted-foreground">
                  Lade Benutzer...
                </div>
              )}
            </div>
            <div className="space-y-3 pt-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="task-send-by-email"
                  checked={sendByEmail}
                  onCheckedChange={(checked) => setSendByEmail(checked === true)}
                />
                <label htmlFor="task-send-by-email" className="text-sm font-medium flex items-center">
                  <Mail className="h-4 w-4 mr-1" />
                  Auch per E-Mail versenden
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="task-send-via-matrix"
                  checked={sendViaMatrix}
                  onCheckedChange={(checked) => setSendViaMatrix(checked === true)}
                />
                <label htmlFor="task-send-via-matrix" className="text-sm font-medium flex items-center">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Auch via Matrix versenden
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[70%_30%] gap-4">
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
        
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Abbrechen
          </Button>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
