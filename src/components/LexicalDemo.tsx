import React, { useState, useRef } from 'react';
import LexicalEditor from './LexicalEditor';
import PlainTextEditor, { type PlainTextEditorRef } from './PlainTextEditor';

const LexicalDemo: React.FC = () => {
  const [richTextContent, setRichTextContent] = useState('');
  const [plainTextContent, setPlainTextContent] = useState('');
  const [exportedData, setExportedData] = useState<string>('');
  const plainTextRef = useRef<PlainTextEditorRef>(null);

  const handleRichTextChange = (text: string) => {
    setRichTextContent(text);
  };

  const handlePlainTextChange = (text: string) => {
    setPlainTextContent(text);
  };

  const handleExport = (jsonData: string) => {
    setExportedData(jsonData);
    console.log('Exported JSON:', jsonData);
  };

  const clearExport = () => {
    setExportedData('');
  };

  const focusPlainText = () => {
    plainTextRef.current?.focus();
  };

  const setPlainTextValue = () => {
    plainTextRef.current?.setValue('Programmatically set content');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem', fontWeight: 'bold' }}>
        Lexical Editor Demo
      </h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Rich Text Editor */}
        <div>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '600' }}>
            Rich Text Editor
          </h2>
          <LexicalEditor
            placeholder="Start typing with rich text..."
            onChange={handleRichTextChange}
            onExportJSON={handleExport}
            initialContent="Welcome to the enhanced Lexical editor!"
          />
          <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#f3f4f6', borderRadius: '0.25rem' }}>
            <strong>Plain text content:</strong> {richTextContent}
          </div>
        </div>

        {/* Plain Text Editor */}
        <div>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '600' }}>
            Plain Text Editor
          </h2>
          <PlainTextEditor
            ref={plainTextRef}
            placeholder="Start typing plain text..."
            onChange={handlePlainTextChange}
            onExportJSON={handleExport}
            initialContent="This is a plain text editor alternative."
          />
          <div style={{ marginTop: '1rem' }}>
            <button 
              onClick={focusPlainText}
              style={{ 
                marginRight: '0.5rem', 
                padding: '0.25rem 0.5rem', 
                border: '1px solid #ccc', 
                borderRadius: '0.25rem',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              Focus Editor
            </button>
            <button 
              onClick={setPlainTextValue}
              style={{ 
                padding: '0.25rem 0.5rem', 
                border: '1px solid #ccc', 
                borderRadius: '0.25rem',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              Set Content
            </button>
          </div>
          <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#f3f4f6', borderRadius: '0.25rem' }}>
            <strong>Plain text content:</strong> {plainTextContent}
          </div>
        </div>
      </div>

      {/* Exported JSON Display */}
      {exportedData && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Exported JSON</h2>
            <button 
              onClick={clearExport}
              style={{ 
                padding: '0.25rem 0.5rem', 
                border: '1px solid #dc2626', 
                borderRadius: '0.25rem',
                background: '#dc2626',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          </div>
          <pre 
            style={{ 
              background: '#1f2937', 
              color: '#f9fafb', 
              padding: '1rem', 
              borderRadius: '0.5rem', 
              overflow: 'auto',
              fontSize: '0.875rem'
            }}
          >
            {exportedData}
          </pre>
        </div>
      )}
    </div>
  );
};

export default LexicalDemo;