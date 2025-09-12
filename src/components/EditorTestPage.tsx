import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import SimpleLexicalEditor from './SimpleLexicalEditor';
import EnhancedLexicalEditor from './EnhancedLexicalEditor';

export default function EditorTestPage() {
  // Simple Editor State
  const [simpleContent, setSimpleContent] = useState('');
  const [simpleDocumentId, setSimpleDocumentId] = useState('simple-doc-001');
  const [simpleCollaboration, setSimpleCollaboration] = useState(false);
  const [simpleUseYjs, setSimpleUseYjs] = useState(true);

  // Enhanced Editor State  
  const [enhancedContent, setEnhancedContent] = useState('');
  const [enhancedDocumentId, setEnhancedDocumentId] = useState('enhanced-doc-001');
  const [enhancedCollaboration, setEnhancedCollaboration] = useState(false);
  const [enhancedUseYjs, setEnhancedUseYjs] = useState(true);
  const [enhancedShowToolbar, setEnhancedShowToolbar] = useState(true);

  const generateNewDocId = (type: 'simple' | 'enhanced') => {
    const newId = `${type}-doc-${Math.random().toString(36).substr(2, 9)}`;
    if (type === 'simple') {
      setSimpleDocumentId(newId);
      setSimpleContent('');
    } else {
      setEnhancedDocumentId(newId);
      setEnhancedContent('');
    }
  };

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
              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="simple-doc-id">Document ID</Label>
                  <Input
                    id="simple-doc-id"
                    value={simpleDocumentId}
                    onChange={(e) => setSimpleDocumentId(e.target.value)}
                    placeholder="Document ID"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Actions</Label>
                  <Button 
                    onClick={() => generateNewDocId('simple')}
                    variant="outline"
                    className="w-full"
                  >
                    Generate New Document
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Switch
                      checked={simpleCollaboration}
                      onCheckedChange={setSimpleCollaboration}
                    />
                    Enable Collaboration
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Switch
                      checked={simpleUseYjs}
                      onCheckedChange={setSimpleUseYjs}
                      disabled={!simpleCollaboration}
                    />
                    Use Yjs (vs Supabase Realtime)
                  </Label>
                </div>
              </div>

              {/* Status */}
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Status:</strong> {simpleCollaboration ? (simpleUseYjs ? 'Yjs Collaboration' : 'Supabase Realtime') : 'Single User'}</p>
                <p><strong>Document:</strong> {simpleDocumentId}</p>
                <p><strong>Content Length:</strong> {simpleContent.length} characters</p>
              </div>

              {/* Editor */}
              <SimpleLexicalEditor
                content={simpleContent}
                onChange={setSimpleContent}
                placeholder="Start writing in plain text mode..."
                documentId={simpleDocumentId}
                enableCollaboration={simpleCollaboration}
                useYjsCollaboration={simpleUseYjs}
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
              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="enhanced-doc-id">Document ID</Label>
                  <Input
                    id="enhanced-doc-id"
                    value={enhancedDocumentId}
                    onChange={(e) => setEnhancedDocumentId(e.target.value)}
                    placeholder="Document ID"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Actions</Label>
                  <Button 
                    onClick={() => generateNewDocId('enhanced')}
                    variant="outline"
                    className="w-full"
                  >
                    Generate New Document
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Switch
                      checked={enhancedCollaboration}
                      onCheckedChange={setEnhancedCollaboration}
                    />
                    Enable Collaboration
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Switch
                      checked={enhancedUseYjs}
                      onCheckedChange={setEnhancedUseYjs}
                      disabled={!enhancedCollaboration}
                    />
                    Use Yjs (vs Supabase Realtime)
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Switch
                      checked={enhancedShowToolbar}
                      onCheckedChange={setEnhancedShowToolbar}
                    />
                    Show Toolbar
                  </Label>
                </div>
              </div>

              {/* Status */}
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Status:</strong> {enhancedCollaboration ? (enhancedUseYjs ? 'Enhanced Yjs Collaboration' : 'Enhanced Supabase Realtime') : 'Enhanced Single User'}</p>
                <p><strong>Document:</strong> {enhancedDocumentId}</p>
                <p><strong>Content Length:</strong> {enhancedContent.length} characters</p>
                <p><strong>Toolbar:</strong> {enhancedShowToolbar ? 'Visible' : 'Hidden'}</p>
              </div>

              {/* Features Info */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Rich Text Features:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <ul className="space-y-1">
                    <li>• <strong>Text Formatting:</strong> Bold, Italic, Underline, Strikethrough</li>
                    <li>• <strong>Headings:</strong> H1, H2, H3 with proper styling</li>
                    <li>• <strong>Lists:</strong> Bullet and numbered lists</li>
                    <li>• <strong>Code:</strong> Inline code and code blocks</li>
                  </ul>
                  <ul className="space-y-1">
                    <li>• <strong>Quotes:</strong> Block quotes with styling</li>
                    <li>• <strong>Keyboard Shortcuts:</strong> Ctrl+B, Ctrl+I, Ctrl+U</li>
                    <li>• <strong>Markdown:</strong> **bold**, *italic*, `code`, # headings</li>
                    <li>• <strong>Links:</strong> Automatic link detection</li>
                  </ul>
                </div>
              </div>

              {/* Editor */}
              <EnhancedLexicalEditor
                content={enhancedContent}
                onChange={setEnhancedContent}
                placeholder="Start writing with rich text formatting..."
                documentId={enhancedDocumentId}
                enableCollaboration={enhancedCollaboration}
                useYjsCollaboration={enhancedUseYjs}
                showToolbar={enhancedShowToolbar}
              />
            </CardContent>
          </Card>

          {/* Usage Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>How to Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Single User Mode:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>1. Disable collaboration</li>
                    <li>2. Try formatting with toolbar buttons</li>
                    <li>3. Use keyboard shortcuts (Ctrl+B, Ctrl+I, etc.)</li>
                    <li>4. Try markdown shortcuts (**bold**, *italic*, # heading)</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Collaboration Mode:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>1. Enable collaboration</li>
                    <li>2. Use the same document ID in multiple tabs/browsers</li>
                    <li>3. Format text and see real-time synchronization</li>
                    <li>4. Compare Yjs vs Supabase Realtime performance</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}