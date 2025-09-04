import React from 'react';
import LexicalEditor from '@/components/LexicalEditor';

export default function LexicalEditorDemo() {
  const handleEditorChange = (editorState: any) => {
    console.log('Editor state changed:', editorState);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">LexicalEditor Demo</h1>
      
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Enhanced LexicalEditor with localStorage</h2>
          <p className="text-gray-600 mb-4">
            This demo shows the enhanced LexicalEditor with the following features:
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-4 space-y-1">
            <li>Automatic localStorage persistence (key: 'lexical-editor-content')</li>
            <li>Content loads automatically on page refresh</li>
            <li>Clear button to reset content and localStorage</li>
            <li>Live JSON debug view showing the current editor state</li>
            <li>Comments indicating where backend integration would occur</li>
          </ul>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">Try it out:</h3>
          <LexicalEditor onChange={handleEditorChange} />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-blue-800 mb-2">Testing Instructions:</h3>
          <ol className="list-decimal pl-6 text-blue-700 space-y-1">
            <li>Type some content in the editor above</li>
            <li>Refresh the page - your content should persist</li>
            <li>Check the JSON debug section to see the live state</li>
            <li>Use the "Clear Content" button to reset everything</li>
            <li>Open browser developer tools to see localStorage updates</li>
          </ol>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-green-800 mb-2">Backend Integration Notes:</h3>
          <p className="text-green-700">
            The component includes TODO comments showing where backend database 
            synchronization would be implemented. Currently, all persistence 
            happens via localStorage for standalone operation.
          </p>
        </div>
      </div>
    </div>
  );
}