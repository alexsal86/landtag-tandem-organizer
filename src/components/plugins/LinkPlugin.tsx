import React, { useState, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createLinkNode, $isLinkNode, LinkNode } from '@lexical/link';
import { $getSelection, $isRangeSelection, $createTextNode } from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { CLICK_COMMAND, KEY_ESCAPE_COMMAND, COMMAND_PRIORITY_NORMAL } from 'lexical';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link, ExternalLink } from 'lucide-react';

interface FloatingLinkEditorProps {
  url: string;
  onUrlChange: (url: string) => void;
  onSave: () => void;
  onCancel: () => void;
  position: { x: number; y: number };
}

const FloatingLinkEditor: React.FC<FloatingLinkEditorProps> = ({
  url,
  onUrlChange,
  onSave,
  onCancel,
  position
}) => {
  return (
    <Card 
      className="absolute z-50 w-80 shadow-lg border"
      style={{ left: position.x, top: position.y }}
    >
      <CardContent className="p-3">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://example.com"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSave();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
              }
            }}
          />
          <Button size="sm" onClick={onSave}>
            <Link className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            ✕
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export function LinkPlugin() {
  const [editor] = useLexicalComposerContext();
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPosition, setLinkPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          const target = event.target as HTMLElement;
          if (target.tagName === 'A') {
            event.preventDefault();
            const rect = target.getBoundingClientRect();
            setLinkPosition({ x: rect.left, y: rect.bottom + 5 });
            setLinkUrl(target.getAttribute('href') || '');
            setShowLinkEditor(true);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (showLinkEditor) {
            setShowLinkEditor(false);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      )
    );
  }, [editor, showLinkEditor]);

  const createLink = (url: string, text?: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const linkNode = $createLinkNode(url);
        if (text) {
          linkNode.append($createTextNode(text));
        }
        selection.insertNodes([linkNode]);
      }
    });
  };

  const handleSaveLink = () => {
    if (linkUrl) {
      createLink(linkUrl);
    }
    setShowLinkEditor(false);
  };

  const handleCancelLink = () => {
    setShowLinkEditor(false);
  };

  return (
    <>
      {showLinkEditor && (
        <FloatingLinkEditor
          url={linkUrl}
          onUrlChange={setLinkUrl}
          onSave={handleSaveLink}
          onCancel={handleCancelLink}
          position={linkPosition}
        />
      )}
    </>
  );
}

export { LinkNode };