import React, { useState } from 'react';
import LexicalEditor from '@/components/LexicalEditor';

export default function LexicalEditorDemo() {
  const [demoContent, setDemoContent] = useState('');
  const [saveCount, setSaveCount] = useState(0);

  const handleEditorChange = (editorState: any) => {
    console.log('Editor state changed:', editorState);
  };

  const mockSaveCallback = async (jsonContent: string) => {
    console.log('Mock save called with content:', jsonContent.length, 'characters');
    setDemoContent(jsonContent);
    setSaveCount(prev => prev + 1);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">LexicalEditor Demo - Supabase Integration</h1>
      
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Enhanced LexicalEditor with Supabase Integration</h2>
          <p className="text-gray-600 mb-4">
            This demo shows the enhanced LexicalEditor with the following features:
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-4 space-y-1">
            <li>Supabase document integration with documentId and tenantId support</li>
            <li>Debounced saving to prevent excessive API calls</li>
            <li>Automatic fallback to localStorage for standalone mode</li>
            <li>Live JSON debug view showing the current editor state</li>
            <li>Real-time save status and content synchronization</li>
          </ul>
        </div>

        {/* Standalone Mode Test */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">Standalone Mode (localStorage):</h3>
          <LexicalEditor onChange={handleEditorChange} />
        </div>

        {/* Supabase Integration Mode Test */}
        <div className="border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">Supabase Integration Mode:</h3>
          <div className="mb-4 text-sm text-blue-600">
            Document ID: demo-doc-123 | Tenant ID: demo-tenant-456 | Saves: {saveCount}
          </div>
          <LexicalEditor 
            documentId="demo-doc-123"
            tenantId="demo-tenant-456"
            value={demoContent}
            onSave={mockSaveCallback}
            onChange={handleEditorChange}
            placeholder="Test the Supabase integration mode..."
          />
          
          {demoContent && (
            <div className="mt-4 p-3 bg-blue-50 rounded">
              <h4 className="font-medium text-blue-800 mb-2">Last Saved Content Preview:</h4>
              <pre className="text-xs text-blue-700 bg-white p-2 rounded border overflow-auto max-h-20">
                {demoContent.substring(0, 200)}...
              </pre>
            </div>
          )}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-green-800 mb-2">Integration Features Implemented:</h3>
          <ul className="list-disc pl-6 text-green-700 space-y-1">
            <li>✅ Document-specific content loading and saving</li>
            <li>✅ Tenant-aware operations</li>
            <li>✅ Debounced save operations (1 second delay)</li>
            <li>✅ Backward compatibility with localStorage</li>
            <li>✅ Real-time JSON state display with context information</li>
            <li>✅ Custom placeholder and styling support</li>
          </ul>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-blue-800 mb-2">Testing Instructions:</h3>
          <ol className="list-decimal pl-6 text-blue-700 space-y-1">
            <li>Test standalone mode (top editor) - content persists in localStorage</li>
            <li>Test Supabase mode (bottom editor) - watch save counter increment</li>
            <li>Compare JSON state displays - note different storage contexts</li>
            <li>Verify debouncing by typing quickly and watching save counter</li>
            <li>Check browser console for detailed logging</li>
          </ol>
        </div>
      </div>
    </div>
  );
}