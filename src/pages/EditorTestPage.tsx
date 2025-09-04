import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Edit3, Users, Settings } from 'lucide-react';
import LexicalEditor from '@/components/LexicalEditor';

/**
 * Enhanced test page to demonstrate the refactored LexicalEditor with collaboration
 * Shows both collaborative and non-collaborative modes
 */
const EditorTestPage: React.FC = () => {
  const [enableCollaboration, setEnableCollaboration] = useState(true);
  const [documentId, setDocumentId] = useState('test-document-123');
  const [exportData, setExportData] = useState<string | null>(null);

  const handleExportJSON = (jsonData: string) => {
    setExportData(jsonData);
    console.log('Exported JSON:', jsonData);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Editor Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="collaboration"
                checked={enableCollaboration}
                onCheckedChange={setEnableCollaboration}
              />
              <Label htmlFor="collaboration">Enable Real-time Collaboration</Label>
            </div>
            
            {enableCollaboration && (
              <div className="space-y-2">
                <Label htmlFor="docId">Document ID</Label>
                <Input
                  id="docId"
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
                  placeholder="Enter document ID for collaboration"
                />
                <p className="text-xs text-muted-foreground">
                  Users with the same document ID will collaborate in real-time
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Editor Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {enableCollaboration ? (
                <>
                  <Users className="h-5 w-5" />
                  Collaborative Editor - REFACTORED ✨
                </>
              ) : (
                <>
                  <Edit3 className="h-5 w-5" />
                  Rich Text Editor
                </>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {enableCollaboration ? (
                <>
                  ✅ <strong>Collaboration Plugin Re-enabled!</strong> Multiple users can edit this document 
                  simultaneously with real-time sync and user awareness. The collaboration features 
                  now use the official CollaborationPlugin with improved integration.
                </>
              ) : (
                "Single-user mode with standard rich text editing capabilities."
              )}
            </p>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg min-h-[600px]">
              <LexicalEditor
                initialContent="Welcome to the refactored LexicalEditor! 

This editor now properly integrates with the CollaborationPlugin and demonstrates:

• ✅ Re-enabled real-time collaboration using official CollaborationPlugin
• ✅ Improved integration with CollaborationContext  
• ✅ Better TypeScript types and code organization
• ✅ Enhanced user awareness and connection status
• ✅ Robust error handling and cleanup
• ✅ Snapshot functionality for version control

Try opening this page in multiple browser tabs with the same document ID to see real-time collaboration in action!"
                placeholder="Start writing your collaborative document..."
                showToolbar={true}
                enableCollaboration={enableCollaboration}
                documentId={enableCollaboration ? documentId : undefined}
                onChange={(content) => {
                  if (!enableCollaboration) {
                    console.log('Document content changed:', content.length, 'characters');
                  }
                }}
                onExportJSON={handleExportJSON}
              />
            </div>
          </CardContent>
        </Card>

        {/* Export Results */}
        {exportData && (
          <Card>
            <CardHeader>
              <CardTitle>Exported Document Data</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-64">
                {exportData}
              </pre>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => setExportData(null)}
              >
                Clear
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Refactoring Highlights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-green-600">✅ Improvements Made</h4>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>• Re-enabled CollaborationPlugin</li>
                  <li>• Created useCollaborationEditor hook</li>
                  <li>• Removed manual Yjs setup</li>
                  <li>• Better TypeScript types</li>
                  <li>• Enhanced error handling</li>
                  <li>• Cleaner component architecture</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-blue-600">🔧 Technical Details</h4>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>• Uses CollaborationContext for state management</li>
                  <li>• Integrates with useCollaborationPersistence</li>
                  <li>• Leverages CollaborationStatus component</li>
                  <li>• Maintains backward compatibility</li>
                  <li>• Improved connection pooling</li>
                  <li>• Better cleanup mechanisms</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditorTestPage;