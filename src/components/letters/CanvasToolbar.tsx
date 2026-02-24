import React from 'react';
import { Undo2, Redo2, Ruler, Crosshair, Eye, Copy, ClipboardPaste, CopyPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

type CanvasToolbarProps = {
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  showRuler: boolean;
  onToggleRuler: () => void;
  showAxes: boolean;
  onToggleAxes: () => void;
  showMargins?: boolean;
  onToggleMargins?: () => void;
  canCopy?: boolean;
  onCopy?: () => void;
  canPaste?: boolean;
  onPaste?: () => void;
  canDuplicate?: boolean;
  onDuplicate?: () => void;
  trailingContent?: React.ReactNode;
};

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  showRuler,
  onToggleRuler,
  showAxes,
  onToggleAxes,
  showMargins,
  onToggleMargins,
  canCopy = false,
  onCopy,
  canPaste = false,
  onPaste,
  canDuplicate = false,
  onDuplicate,
  trailingContent,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2">
      <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onUndo} disabled={!onUndo || !canUndo}><Undo2 className="h-3.5 w-3.5 mr-1" />Undo</Button>
      <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onRedo} disabled={!onRedo || !canRedo}><Redo2 className="h-3.5 w-3.5 mr-1" />Redo</Button>
      <Button type="button" variant={showRuler ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={onToggleRuler}><Ruler className="h-3.5 w-3.5 mr-1" />Lineal</Button>
      <Button type="button" variant={showAxes ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={onToggleAxes}><Crosshair className="h-3.5 w-3.5 mr-1" />Achsen</Button>
      {typeof showMargins === 'boolean' && onToggleMargins && (
        <Button type="button" variant={showMargins ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={onToggleMargins}><Eye className="h-3.5 w-3.5 mr-1" />Ränder</Button>
      )}
      <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onCopy} disabled={!onCopy || !canCopy}><Copy className="h-3.5 w-3.5 mr-1" />Kopieren</Button>
      <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onPaste} disabled={!onPaste || !canPaste}><ClipboardPaste className="h-3.5 w-3.5 mr-1" />Einfügen</Button>
      <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onDuplicate} disabled={!onDuplicate || !canDuplicate}><CopyPlus className="h-3.5 w-3.5 mr-1" />Duplizieren</Button>
      {trailingContent}
    </div>
  );
};
