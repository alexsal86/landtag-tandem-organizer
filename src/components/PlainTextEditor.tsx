import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';

interface PlainTextEditorProps {
  initialContent?: string;
  onChange?: (text: string) => void;
  placeholder?: string;
  onExportJSON?: (jsonData: string) => void;
  disabled?: boolean;
  className?: string;
}

interface PlainTextEditorRef {
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
  exportToJSON: () => void;
}

const PlainTextEditor = forwardRef<PlainTextEditorRef, PlainTextEditorProps>(({
  initialContent = '',
  onChange,
  placeholder = 'Text eingeben...',
  onExportJSON,
  disabled = false,
  className = '',
}, ref) => {
  const [value, setValue] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    getValue: () => value,
    setValue: (newValue: string) => {
      setValue(newValue);
      onChange?.(newValue);
    },
    focus: () => textareaRef.current?.focus(),
    exportToJSON: handleExportJSON,
  }));

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChange?.(newValue);
  };

  const handleExportJSON = () => {
    if (!onExportJSON) return;
    
    const jsonData = JSON.stringify({
      timestamp: new Date().toISOString(),
      content: value,
      plainText: true,
      wordCount: value.split(/\s+/).filter(word => word.length > 0).length,
      characterCount: value.length,
      version: '1.0'
    }, null, 2);
    
    onExportJSON(jsonData);
  };

  const hasContent = value.trim().length > 0;

  return (
    <div className={`plaintext-editor ${className}`}>
      <style jsx>{`
        .plaintext-editor {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: white;
        }
        .toolbar {
          padding: 8px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
          border-radius: 8px 8px 0 0;
        }
        .toolbar-button {
          padding: 6px 12px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
        }
        .toolbar-button:hover {
          background: #2563eb;
        }
        .toolbar-button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        .plaintext-placeholder {
          position: absolute;
          top: 12px;
          left: 12px;
          color: #9ca3af;
          pointer-events: none;
          font-size: 14px;
        }
        .plaintext-textarea {
          width: 100%;
          min-height: 300px;
          padding: 12px;
          border: none;
          outline: none;
          resize: vertical;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.5;
          background: transparent;
        }
      `}</style>
      {onExportJSON && (
        <div className="toolbar">
          <button
            type="button"
            onClick={handleExportJSON}
            className="toolbar-button export-button"
            title="Als JSON exportieren"
            disabled={disabled}
          >
            JSON
          </button>
        </div>
      )}
      
      <div style={{ position: 'relative' }}>
        {!hasContent && placeholder && (
          <div className="plaintext-placeholder">
            {placeholder}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder=""
          className="plaintext-textarea"
        />
      </div>
    </div>
  );
});

PlainTextEditor.displayName = 'PlainTextEditor';

export default PlainTextEditor;
export type { PlainTextEditorRef };