import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { ResponseOption, COLOR_OPTIONS } from "@/lib/decisionTemplates";

interface ResponseOptionsEditorProps {
  options: ResponseOption[];
  onChange: (options: ResponseOption[]) => void;
}

export const ResponseOptionsEditor = ({ options, onChange }: ResponseOptionsEditorProps) => {
  const addOption = () => {
    const newKey = `option_${Date.now()}`;
    onChange([
      ...options,
      { key: newKey, label: "", color: "blue", requires_comment: false }
    ]);
  };

  const updateOption = (index: number, updates: Partial<ResponseOption>) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], ...updates };
    
    // Auto-generate key from label if label changed
    if (updates.label !== undefined) {
      const sanitizedKey = updates.label
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 20);
      newOptions[index].key = sanitizedKey || `option_${index}`;
    }
    
    onChange(newOptions);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) {
      return; // Minimum 2 options required
    }
    onChange(options.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Eigene Optionen:</div>
      
      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={option.key} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
            
            <Input
              value={option.label}
              onChange={(e) => updateOption(index, { label: e.target.value })}
              placeholder="Bezeichnung"
              className="flex-1 h-8"
            />
            
            <Select
              value={option.color}
              onValueChange={(value) => updateOption(index, { color: value })}
            >
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLOR_OPTIONS.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${color.bgClass} ${color.borderClass} border`} />
                      {color.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-1">
              <Checkbox
                id={`comment-${index}`}
                checked={option.requires_comment || false}
                onCheckedChange={(checked) => updateOption(index, { requires_comment: checked === true })}
              />
              <label htmlFor={`comment-${index}`} className="text-xs text-muted-foreground whitespace-nowrap">
                Kommentar
              </label>
            </div>
            
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeOption(index)}
              disabled={options.length <= 2}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addOption}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-1" />
        Option hinzufügen
      </Button>
      
      <p className="text-xs text-muted-foreground">
        Mindestens 2 Optionen erforderlich. "Kommentar" bedeutet, dass bei Auswahl dieser Option ein Kommentar eingegeben werden muss.
      </p>
    </div>
  );
};
