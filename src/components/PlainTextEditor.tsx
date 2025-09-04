import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import './LexicalEditor.css';

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
      {onExportJSON && (
        <div className="lexical-toolbar">
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