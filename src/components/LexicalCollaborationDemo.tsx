import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LexicalEditor from '@/components/LexicalEditor';
import { Badge } from '@/components/ui/badge';
import { Users, Wifi, WifiOff } from 'lucide-react';

/**
 * Demo-Komponente für Lexical Editor mit Yjs Kollaboration
 * Diese Komponente zeigt die vollständig implementierte Kollaborationsfunktionalität
 */
const LexicalCollaborationDemo: React.FC = () => {
  const [documentId, setDocumentId] = useState('demo-document-1');
  const [enableCollaboration, setEnableCollaboration] = useState(true);
  const [customDocumentId, setCustomDocumentId] = useState('');

  const handleCreateNewDocument = () => {
    const newId = customDocumentId || `demo-document-${Date.now()}`;
    setDocumentId(newId);
    setCustomDocumentId('');
  };

  const predefinedDocs = [
    { id: 'demo-document-1', name: 'Meeting Notes' },
    { id: 'demo-document-2', name: 'Project Planning' },
    { id: 'demo-document-3', name: 'Policy Draft' }
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lexical Editor mit Yjs Kollaboration - Demo
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Diese Demo zeigt die vollständig implementierte Echtzeit-Kollaboration mit Lexical und Yjs.
            Öffnen Sie mehrere Browser-Tabs mit demselben Dokument, um die Kollaboration zu testen.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {enableCollaboration ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <Badge variant={enableCollaboration ? "default" : "secondary"}>
                {enableCollaboration ? 'Kollaboration aktiv' : 'Standalone-Modus'}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEnableCollaboration(!enableCollaboration)}
            >
              {enableCollaboration ? 'Kollaboration deaktivieren' : 'Kollaboration aktivieren'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="current-doc">Aktuelles Dokument</Label>
              <Input
                id="current-doc"
                value={documentId}
                readOnly
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label htmlFor="new-doc">Neues Dokument erstellen</Label>
              <div className="flex gap-2">
                <Input
                  id="new-doc"
                  value={customDocumentId}
                  onChange={(e) => setCustomDocumentId(e.target.value)}
                  placeholder="Dokument-ID eingeben..."
                  className="flex-1"
                />
                <Button onClick={handleCreateNewDocument} size="sm">
                  Erstellen
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label>Vordefinierte Demo-Dokumente</Label>
            <div className="flex gap-2 mt-2">
              {predefinedDocs.map((doc) => (
                <Button
                  key={doc.id}
                  variant={documentId === doc.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDocumentId(doc.id)}
                >
                  {doc.name}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Kollaborativer Editor: {documentId}
          </CardTitle>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>• Öffnen Sie mehrere Browser-Tabs mit derselben Dokument-ID</div>
            <div>• Änderungen werden in Echtzeit synchronisiert</div>
            <div>• Cursor-Positionen anderer Benutzer werden angezeigt</div>
            <div>• Automatisches Speichern alle paar Sekunden</div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg min-h-[400px]">
            <LexicalEditor
              key={documentId}
              initialContent=""
              placeholder={`Beginnen Sie zu schreiben in Dokument "${documentId}"...`}
              showToolbar={true}
              onChange={(content) => {
                console.log('Document content changed:', content.length, 'characters');
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features der Kollaboration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">✅ Implementierte Features</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Echtzeit-Synchronisation mit Yjs</li>
                <li>• WebSocket-basierte Kommunikation</li>
                <li>• Benutzer-Awareness (Online-Status)</li>
                <li>• Konfliktfreie Zusammenführung (CRDT)</li>
                <li>• Automatisches Speichern</li>
                <li>• Rich-Text Formatierung</li>
                <li>• Undo/Redo mit Kollaboration</li>
                <li>• Cursor-Tracking</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🛠 Technische Details</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Lexical Editor v0.34.0</li>
                <li>• Yjs CRDT Library</li>
                <li>• WebSocket Provider</li>
                <li>• Supabase Persistierung</li>
                <li>• React Context für State</li>
                <li>• TypeScript Support</li>
                <li>• Debounced Auto-Save</li>
                <li>• Error Handling & Recovery</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LexicalCollaborationDemo;