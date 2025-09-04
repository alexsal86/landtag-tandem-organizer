import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit3 } from 'lucide-react';
import LexicalEditor from '@/components/LexicalEditor';

/**
 * Temporary test page to demonstrate the Editor functionality without authentication
 * This will be removed - it's only for testing the implementation
 */
const EditorTestPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Collaborative Editor (Test Mode)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Create and edit documents collaboratively in real-time with other users.
              This is a test version that bypasses authentication for demonstration.
            </p>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg min-h-[600px]">
              <LexicalEditor
                documentId="shared-document"
                enableCollaboration={true}
                initialContent=""
                placeholder="Start writing your document..."
                showToolbar={true}
                onChange={(content) => {
                  console.log('Document content changed:', content.length, 'characters');
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditorTestPage;