import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import SimpleLexicalEditor from './SimpleLexicalEditor';
import EnhancedLexicalEditor from './EnhancedLexicalEditor';

export default function EditorTestPage() {
  const [simpleContent, setSimpleContent] = useState('');
  const [enhancedContent, setEnhancedContent] = useState('');
  const [enhancedShowToolbar, setEnhancedShowToolbar] = useState(true);

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Lexical Editor Test Suite</h1>
        <p className="text-muted-foreground">
          Vergleich zwischen SimpleLexicalEditor (Plain Text) und EnhancedLexicalEditor (Rich Text)
        </p>
      </div>

      <Tabs defaultValue="enhanced" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="simple">Simple Editor (Plain Text)</TabsTrigger>
          <TabsTrigger value="enhanced">Enhanced Editor (Rich Text)</TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Simple Lexical Editor
                <Badge variant="outline">Plain Text</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p><strong>Content Length:</strong> {simpleContent.length} characters</p>
              </div>
              <SimpleLexicalEditor
                content={simpleContent}
                onChange={setSimpleContent}
                placeholder="Start writing in plain text mode..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enhanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Enhanced Lexical Editor
                <Badge variant="default">Rich Text</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Label className="flex items-center gap-2">
                  <Switch
                    checked={enhancedShowToolbar}
                    onCheckedChange={setEnhancedShowToolbar}
                  />
                  Toolbar anzeigen
                </Label>
              </div>

              <div className="text-sm text-muted-foreground">
                <p><strong>Content Length:</strong> {enhancedContent.length} characters</p>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Alle Features (Playground-Parität):</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                  <ul className="space-y-1">
                    <li>✅ <strong>Text:</strong> Bold, Italic, Underline, Strikethrough</li>
                    <li>✅ <strong>Überschriften:</strong> H1, H2, H3</li>
                    <li>✅ <strong>Listen:</strong> Aufzählung, Nummeriert, Checkliste</li>
                    <li>✅ <strong>Code:</strong> Inline-Code, Code-Block</li>
                  </ul>
                  <ul className="space-y-1">
                    <li>✅ <strong>Tabelle:</strong> Offizielles Plugin mit Merge</li>
                    <li>✅ <strong>Links:</strong> Manuell + AutoLink + ClickableLink</li>
                    <li>✅ <strong>Bild:</strong> Echter ImageNode mit Resize</li>
                    <li>✅ <strong>HR:</strong> Horizontale Linie</li>
                  </ul>
                  <ul className="space-y-1">
                    <li>✅ <strong>Schrift:</strong> Familie, Größe, Farbe, Highlight</li>
                    <li>✅ <strong>Ausrichtung:</strong> Links, Zentriert, Rechts, Blocksatz</li>
                    <li>✅ <strong>Sub/Superscript:</strong> Hoch-/Tiefgestellt</li>
                    <li>✅ <strong>Sonstiges:</strong> Zeilenhöhe, Markdown-Shortcuts</li>
                  </ul>
                </div>
              </div>

              <EnhancedLexicalEditor
                content={enhancedContent}
                onChange={(text) => setEnhancedContent(text)}
                placeholder="Start writing with rich text formatting..."
                showToolbar={enhancedShowToolbar}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
