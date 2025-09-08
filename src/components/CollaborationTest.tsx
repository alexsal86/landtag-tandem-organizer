import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SimpleLexicalEditor from './SimpleLexicalEditor';

export default function CollaborationTest() {
  const [documentId, setDocumentId] = useState('test-doc-123');
  const [content, setContent] = useState('');
  const [enableCollaboration, setEnableCollaboration] = useState(true);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    console.log('Content changed:', newContent);
  };

  const generateNewDocId = () => {
    const newId = `test-doc-${Date.now()}`;
    setDocumentId(newId);
    setContent(''); // Reset content for new document
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔄 Supabase Realtime Collaboration Test
            {enableCollaboration && (
              <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                Collaboration Enabled
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Document ID:</label>
              <Input 
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="Enter document ID"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={generateNewDocId} variant="outline">
                New Document
              </Button>
              <Button 
                onClick={() => setEnableCollaboration(!enableCollaboration)}
                variant={enableCollaboration ? "default" : "secondary"}
              >
                {enableCollaboration ? "Disable" : "Enable"} Collaboration
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <p><strong>Instructions:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Open this page in multiple tabs/windows to test collaboration</li>
              <li>Use the same Document ID in all tabs</li>
              <li>Start typing - changes should sync in real-time across all tabs</li>
              <li>Check the browser console for collaboration logs</li>
            </ul>
          </div>

          <SimpleLexicalEditor
            content={content}
            onChange={handleContentChange}
            placeholder="Start typing to test real-time collaboration..."
            documentId={documentId}
            enableCollaboration={enableCollaboration}
          />

          <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded">
            <strong>Current Content Length:</strong> {content.length} characters
            <br />
            <strong>Document ID:</strong> {documentId}
            <br />
            <strong>Collaboration:</strong> {enableCollaboration ? 'Enabled' : 'Disabled'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}