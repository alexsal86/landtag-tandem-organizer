import React, { useLayoutEffect, useRef } from 'react';

interface InlineEditableTextProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const normalizeText = (text: string, multiline: boolean): string => {
  const cleaned = text.replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n');
  return multiline ? cleaned : cleaned.replace(/\n+/g, ' ');
};

/**
 * Plain-text field that can be typed into directly on the DIN sheet.
 * Uncontrolled while focused so the caret never jumps; the value from the
 * parent is only written back when the field is not being edited.
 */
export const InlineEditableText: React.FC<InlineEditableTextProps> = ({
  value,
  onChange,
  ariaLabel,
  placeholder,
  multiline = false,
  className = '',
  style,
}) => {
  const fieldRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);

  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field || isFocusedRef.current) return;
    if (field.innerText !== value) {
      field.innerText = value;
    }
  }, [value]);

  return (
    <div
      ref={fieldRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={ariaLabel}
      aria-multiline={multiline || undefined}
      data-placeholder={placeholder}
      tabIndex={0}
      spellCheck
      className={`inline-edit-field ${className}`}
      style={{
        outline: 'none',
        minWidth: 0,
        whiteSpace: 'pre-wrap',
        ...style,
      }}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={(event) => {
        isFocusedRef.current = false;
        onChange(normalizeText(event.currentTarget.innerText, multiline));
      }}
      onInput={(event) => onChange(normalizeText(event.currentTarget.innerText, multiline))}
      onPaste={(event) => {
        event.preventDefault();
        const pasted = normalizeText(event.clipboardData.getData('text/plain'), multiline);
        document.execCommand('insertText', false, pasted);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.currentTarget.blur();
          return;
        }
        if (!multiline && event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
};
