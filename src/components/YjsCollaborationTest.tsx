import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import SimpleLexicalEditor from './SimpleLexicalEditor';

export const YjsCollaborationTest: React.FC = () => {
  const [documentId, setDocumentId] = useState('yjs-test-doc-1');
  const [content, setContent] = useState('');
  const [enableCollaboration, setEnableCollaboration] = useState(true);
  const [useYjsCollaboration, setUseYjsCollaboration] = useState(true);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const generateNewDocId = () => {
    const newId = 'yjs-doc-' + Math.random().toString(36).substr(2, 9);
    setDocumentId(newId);
    setContent('');
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>🧪 Yjs Collaboration Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Label htmlFor="doc-id">Document ID:</Label>
            <Input
              id="doc-id"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              className="w-48"
            />
          </div>
          
          <Button onClick={generateNewDocId} variant="outline">
            Generate New Document
          </Button>
          
          <div className="flex items-center gap-2">
            <Switch
              id="collaboration"
              checked={enableCollaboration}
              onCheckedChange={setEnableCollaboration}
            />
            <Label htmlFor="collaboration">Enable Collaboration</Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              id="yjs-mode"
              checked={useYjsCollaboration}
              onCheckedChange={setUseYjsCollaboration}
            />
            <Label htmlFor="yjs-mode">Use Yjs (vs Supabase Realtime)</Label>
          </div>
        </div>

        {/* Instructions */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold mb-2">🧪 Test Instructions:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Open this page in multiple tabs/windows with the same Document ID</li>
            <li>Type in one tab and watch it appear in real-time in other tabs</li>
            <li>Toggle between Yjs and Supabase Realtime to compare</li>
            <li>Yjs should provide better conflict resolution for concurrent editing</li>
            <li>Watch the browser console for collaboration logs</li>
          </ul>
        </div>

        {/* Editor */}
        <SimpleLexicalEditor
          content={content}
          onChange={handleContentChange}
          placeholder="Start typing to test collaboration..."
          documentId={documentId}
          enableCollaboration={enableCollaboration}
          useYjsCollaboration={useYjsCollaboration}
        />

        {/* Status */}
        <div className="text-sm text-muted-foreground space-y-1">
          <div>Content length: {content.length} characters</div>
          <div>Document ID: {documentId}</div>
          <div>Collaboration: {enableCollaboration ? 'Enabled' : 'Disabled'}</div>
          <div>Provider: {useYjsCollaboration ? 'Yjs CRDT' : 'Supabase Realtime'}</div>
        </div>
      </CardContent>
    </Card>
  );
};