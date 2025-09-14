import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { 
  $createLinkNode, 
  $isLinkNode, 
  LinkNode,
  TOGGLE_LINK_COMMAND
} from '@lexical/link';
import { 
  $getSelection, 
  $isRangeSelection, 
  $createTextNode,
  COMMAND_PRIORITY_NORMAL,
  CLICK_COMMAND,
  KEY_ESCAPE_COMMAND,
  $isElementNode
} from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Link, 
  ExternalLink, 
  Copy, 
  Edit, 
  Trash2,
  Eye,
  AlertCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface LinkPreviewTooltipProps {
  url: string;
  position: { x: number; y: number };
  onEdit: () => void;
  onRemove: () => void;
  onClose: () => void;
}

const LinkPreviewTooltip: React.FC<LinkPreviewTooltipProps> = ({
  url,
  position,
  onEdit,
  onRemove,
  onClose
}) => {
  const [linkPreview, setLinkPreview] = useState<{
    title?: string;
    description?: string;
    image?: string;
    isValid: boolean;
  }>({ isValid: true });

  useEffect(() => {
    // Simple URL validation
    try {
      const urlObj = new URL(url);
      setLinkPreview({ isValid: true });
      
      // In a real implementation, you might fetch metadata here
      // For now, just show the URL
    } catch {
      setLinkPreview({ isValid: false });
    }
  }, [url]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link kopiert",
        description: "Der Link wurde in die Zwischenablage kopiert.",
      });
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const openLink = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card 
      className="absolute z-50 w-80 shadow-lg border bg-background"
      style={{ left: position.x, top: position.y + 5 }}
    >
      <CardContent className="p-3">
        <div className="space-y-3">
          {/* Link URL */}
          <div className="flex items-center gap-2">
            {linkPreview.isValid ? (
              <Link className="h-4 w-4 text-blue-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
            <span className="text-sm text-muted-foreground truncate flex-1">
              {url}
            </span>
          </div>

          {/* Link Preview (if available) */}
          {linkPreview.title && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium">{linkPreview.title}</h4>
              {linkPreview.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {linkPreview.description}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={openLink}
                title="Link öffnen"
                className="h-8 px-2"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyToClipboard}
                title="Link kopieren"
                className="h-8 px-2"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onEdit}
                title="Link bearbeiten"
                className="h-8 px-2"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={onRemove}
                title="Link entfernen"
                className="h-8 px-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-8 px-2"
              >
                ✕
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface LinkEditorProps {
  url: string;
  text: string;
  onUrlChange: (url: string) => void;
  onTextChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  position: { x: number; y: number };
}

const LinkEditor: React.FC<LinkEditorProps> = ({
  url,
  text,
  onUrlChange,
  onTextChange,
  onSave,
  onCancel,
  position
}) => {
  const [openInNewTab, setOpenInNewTab] = useState(true);
  const [isValidUrl, setIsValidUrl] = useState(true);

  const validateUrl = useCallback((urlToValidate: string) => {
    if (!urlToValidate) {
      setIsValidUrl(true);
      return;
    }
    
    try {
      new URL(urlToValidate.startsWith('http') ? urlToValidate : `https://${urlToValidate}`);
      setIsValidUrl(true);
    } catch {
      setIsValidUrl(false);
    }
  }, []);

  useEffect(() => {
    validateUrl(url);
  }, [url, validateUrl]);

  const handleSave = () => {
    if (url && isValidUrl) {
      onSave();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Card 
      className="absolute z-50 w-96 shadow-lg border bg-background"
      style={{ left: position.x, top: position.y + 5 }}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Link className="h-4 w-4" />
            <span className="text-sm font-medium">Link bearbeiten</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-url" className="text-xs">URL</Label>
            <Input
              id="link-url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://example.com"
              className={`text-sm ${!isValidUrl ? 'border-destructive' : ''}`}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            {!isValidUrl && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Ungültige URL
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-text" className="text-xs">Anzeigetext</Label>
            <Input
              id="link-text"
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Link-Text"
              className="text-sm"
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="new-tab"
              checked={openInNewTab}
              onCheckedChange={(checked) => setOpenInNewTab(checked === true)}
            />
            <Label htmlFor="new-tab" className="text-xs">
              In neuem Tab öffnen
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              className="text-xs"
            >
              Abbrechen
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!url || !isValidUrl}
              className="text-xs"
            >
              <Link className="h-3 w-3 mr-1" />
              Speichern
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export function EnhancedLinkPlugin() {
  const [editor] = useLexicalComposerContext();
  const [showLinkPreview, setShowLinkPreview] = useState(false);
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkPosition, setLinkPosition] = useState({ x: 0, y: 0 });
  const [activeLinkNode, setActiveLinkNode] = useState<LinkNode | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return mergeRegister(
      // Handle link clicks and hover
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          const target = event.target as HTMLElement;
          const linkElement = target.closest('a');
          
          if (linkElement) {
            event.preventDefault();
            
            if (event.ctrlKey || event.metaKey) {
              // Ctrl+Click to follow link
              window.open(linkElement.href, '_blank', 'noopener,noreferrer');
              return true;
            }
            
            // Regular click shows preview
            const rect = linkElement.getBoundingClientRect();
            setLinkPosition({ x: rect.left, y: rect.bottom });
            setLinkUrl(linkElement.href);
            
            // Find the corresponding Lexical node
            editor.getEditorState().read(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                const node = selection.anchor.getNode();
                const linkNode = node.getParent();
                if ($isLinkNode(linkNode)) {
                  setActiveLinkNode(linkNode);
                  setLinkText(linkNode.getTextContent());
                }
              }
            });
            
            setShowLinkPreview(true);
            setShowLinkEditor(false);
            return true;
          }
          
          // Click outside link
          setShowLinkPreview(false);
          setShowLinkEditor(false);
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      ),
      
      // Handle escape key
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (showLinkPreview || showLinkEditor) {
            setShowLinkPreview(false);
            setShowLinkEditor(false);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      ),
      
      // Register TOGGLE_LINK_COMMAND
      editor.registerCommand(
        TOGGLE_LINK_COMMAND,
        (payload) => {
          if (payload === null) {
            // Remove link
            if (activeLinkNode) {
              editor.update(() => {
                activeLinkNode.remove();
              });
            }
          } else {
            // Add/update link
            const url = typeof payload === 'string' ? payload : payload.url;
            const target = typeof payload === 'object' ? payload.target : undefined;
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                if (activeLinkNode) {
                  // Update existing link
                  activeLinkNode.setURL(url);
                  if (target) {
                    activeLinkNode.setTarget(target);
                  }
                } else {
                  // Create new link
                  const linkNode = $createLinkNode(url, { target });
                  if (selection.isCollapsed()) {
                    linkNode.append($createTextNode(linkText || url));
                  }
                  selection.insertNodes([linkNode]);
                }
              }
            });
          }
          return true;
        },
        COMMAND_PRIORITY_NORMAL
      )
    );
  }, [editor, showLinkPreview, showLinkEditor, activeLinkNode, linkText]);

  const createLink = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const selectedText = selection.getTextContent();
        setLinkText(selectedText || '');
        setLinkUrl('');
        
        // Position near selection
        const nativeSelection = window.getSelection();
        if (nativeSelection && nativeSelection.rangeCount > 0) {
          const range = nativeSelection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setLinkPosition({ x: rect.left, y: rect.bottom });
        }
        
        setShowLinkEditor(true);
        setShowLinkPreview(false);
        setActiveLinkNode(null);
      }
    });
  }, [editor]);

  const handleEditLink = useCallback(() => {
    setShowLinkEditor(true);
    setShowLinkPreview(false);
  }, []);

  const handleRemoveLink = useCallback(() => {
    if (activeLinkNode) {
      editor.update(() => {
        activeLinkNode.remove();
      });
      setShowLinkPreview(false);
      setActiveLinkNode(null);
    }
  }, [editor, activeLinkNode]);

  const handleSaveLink = useCallback(() => {
    if (linkUrl) {
      const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
      
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          if (activeLinkNode) {
            // Update existing link
            activeLinkNode.setURL(url);
            if (linkText && linkText !== activeLinkNode.getTextContent()) {
              activeLinkNode.clear();
              activeLinkNode.append($createTextNode(linkText));
            }
          } else {
            // Create new link
            const linkNode = $createLinkNode(url);
            if (linkText) {
              linkNode.append($createTextNode(linkText));
            } else {
              linkNode.append($createTextNode(url));
            }
            
            // If text is selected, replace it with the link
            if (!selection.isCollapsed()) {
              selection.removeText();
            }
            selection.insertNodes([linkNode]);
          }
        }
      });
      
      setShowLinkEditor(false);
      setActiveLinkNode(null);
      setLinkUrl('');
      setLinkText('');
    }
  }, [editor, linkUrl, linkText, activeLinkNode]);

  const handleCancelLink = useCallback(() => {
    setShowLinkEditor(false);
    setLinkUrl('');
    setLinkText('');
    setActiveLinkNode(null);
  }, []);

  // Auto-link detection
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) && selection.isCollapsed()) {
          const node = selection.anchor.getNode();
          if ($isElementNode(node)) {
            const textContent = node.getTextContent();
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const matches = textContent.match(urlRegex);
            
            if (matches) {
              // Auto-convert URLs to links
              // This is a simplified implementation
              editor.update(() => {
                matches.forEach(url => {
                  if (!textContent.includes(`href="${url}"`)) {
                    const linkNode = $createLinkNode(url);
                    linkNode.append($createTextNode(url));
                    // Replace URL text with link node
                    // This would need more sophisticated implementation
                  }
                });
              });
            }
          }
        }
      });
    });
  }, [editor]);

  return (
    <>
      {/* Link Preview Tooltip */}
      {showLinkPreview && (
        <LinkPreviewTooltip
          url={linkUrl}
          position={linkPosition}
          onEdit={handleEditLink}
          onRemove={handleRemoveLink}
          onClose={() => setShowLinkPreview(false)}
        />
      )}
      
      {/* Link Editor */}
      {showLinkEditor && (
        <LinkEditor
          url={linkUrl}
          text={linkText}
          onUrlChange={setLinkUrl}
          onTextChange={setLinkText}
          onSave={handleSaveLink}
          onCancel={handleCancelLink}
          position={linkPosition}
        />
      )}
    </>
  );
}

// Export for easy access to create links programmatically
export const createLinkCommand = (url: string, text?: string) => {
  return {
    type: 'CREATE_LINK',
    url,
    text
  };
};

export { LinkNode };