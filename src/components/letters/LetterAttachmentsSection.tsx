import type { ComponentProps } from "react";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LetterAttachmentList } from "./LetterContentBlocks";
import type { EditableAttachment } from "./letterRecipient";

interface LetterAttachmentsSectionProps {
  attachments?: ComponentProps<typeof LetterAttachmentList>["attachments"];
  hasSignature: boolean;
  fontSizePt: number;
  canEdit: boolean;
  editableAttachments: EditableAttachment[];
  onAttachmentNameChange?: (attachmentId: string, displayName: string) => void;
  hovered: boolean;
  open: boolean;
  onHoveredChange: (hovered: boolean) => void;
  onOpenChange: (open: boolean) => void;
}

/** Anlagenliste der Seite inkl. Inline-Bearbeitung der Anzeigenamen. */
export function LetterAttachmentsSection({
  attachments,
  hasSignature,
  fontSizePt,
  canEdit,
  editableAttachments,
  onAttachmentNameChange,
  hovered,
  open,
  onHoveredChange,
  onOpenChange,
}: LetterAttachmentsSectionProps) {
  const canEditAttachments = canEdit && !!onAttachmentNameChange && editableAttachments.length > 0;

  return (
    <LetterAttachmentList
      attachments={attachments}
      hasSignature={hasSignature}
      fontSizePt={fontSizePt}
      dash="–"
      containerStyle={{
        color: "#000",
        fontFamily: 'Calibri,Carlito,"Segoe UI",Arial,sans-serif',
        position: "relative",
        zIndex: 25,
        pointerEvents: "auto",
        border: canEditAttachments && (hovered || open)
          ? "1.5px dashed rgba(59, 130, 246, 0.6)"
          : "1.5px dashed transparent",
        background: canEditAttachments && (hovered || open)
          ? "rgba(59, 130, 246, 0.03)"
          : "transparent",
        borderRadius: "6px",
        padding: canEditAttachments ? "2mm" : 0,
      }}
      onMouseEnter={() => canEditAttachments && onHoveredChange(true)}
      onMouseLeave={() => canEditAttachments && !open && onHoveredChange(false)}
    >
      {canEditAttachments && (hovered || open) && (
        <Popover
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            if (!next) onHoveredChange(false);
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Anlagen bearbeiten"
              style={{
                position: "absolute",
                top: "-8px",
                right: "-8px",
                width: "26px",
                height: "26px",
              }}
              className="rounded-full bg-palette-green text-white shadow-md flex items-center justify-center hover:bg-palette-green transition-colors z-30"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 z-50" side="right" align="start" sideOffset={8}>
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Anlagen</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {editableAttachments.map((attachment) => (
                  <div key={attachment.id} className="space-y-1">
                    <Label className="text-xs">{attachment.file_name || "Anlage"}</Label>
                    <Input
                      className="h-8 text-xs"
                      defaultValue={attachment.display_name || attachment.file_name || ""}
                      onBlur={(event) => {
                        onAttachmentNameChange?.(attachment.id, event.target.value.trim());
                      }}
                      placeholder="Anzeigename"
                    />
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </LetterAttachmentList>
  );
}
