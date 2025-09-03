import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection } from 'lexical';
import { $patchStyleText } from '@lexical/selection';
import { ToolbarDropdown } from './ToolbarDropdown';
import { Type } from 'lucide-react';

const FONT_FAMILY_OPTIONS = [
  { key: '', label: 'Default', value: '' },
  { key: 'arial', label: 'Arial', value: 'Arial, sans-serif' },
  { key: 'courier', label: 'Courier New', value: 'Courier New, monospace' },
  { key: 'georgia', label: 'Georgia', value: 'Georgia, serif' },
  { key: 'helvetica', label: 'Helvetica', value: 'Helvetica, sans-serif' },
  { key: 'times', label: 'Times New Roman', value: 'Times New Roman, serif' },
  { key: 'trebuchet', label: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
  { key: 'verdana', label: 'Verdana', value: 'Verdana, sans-serif' },
];

interface FontFamilyDropdownProps {
  selectedFontFamily: string;
}

export function FontFamilyDropdown({ selectedFontFamily }: FontFamilyDropdownProps) {
  const [editor] = useLexicalComposerContext();

  const handleFontFamilyChange = (fontFamily: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, {
          'font-family': fontFamily,
        });
      }
    });
  };

  const options = FONT_FAMILY_OPTIONS.map(option => ({
    key: option.key,
    label: option.label,
    icon: <Type className="h-4 w-4" />,
    onClick: () => handleFontFamilyChange(option.value),
  }));

  const selectedOption = FONT_FAMILY_OPTIONS.find(
    option => option.value === selectedFontFamily
  );

  return (
    <ToolbarDropdown
      options={options}
      selectedKey={selectedOption?.key || ''}
      buttonLabel="Font"
      className="min-w-[120px]"
    />
  );
}