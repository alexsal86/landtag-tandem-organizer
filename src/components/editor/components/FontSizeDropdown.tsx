import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection } from 'lexical';
import { $patchStyleText } from '@lexical/selection';
import { ToolbarDropdown } from './ToolbarDropdown';
import { Type } from 'lucide-react';

const FONT_SIZE_OPTIONS = [
  { key: '10', label: '10px', value: '10px' },
  { key: '11', label: '11px', value: '11px' },
  { key: '12', label: '12px', value: '12px' },
  { key: '13', label: '13px', value: '13px' },
  { key: '14', label: '14px', value: '14px' },
  { key: '15', label: '15px', value: '15px' },
  { key: '16', label: '16px', value: '16px' },
  { key: '17', label: '17px', value: '17px' },
  { key: '18', label: '18px', value: '18px' },
  { key: '19', label: '19px', value: '19px' },
  { key: '20', label: '20px', value: '20px' },
  { key: '24', label: '24px', value: '24px' },
  { key: '28', label: '28px', value: '28px' },
  { key: '32', label: '32px', value: '32px' },
  { key: '36', label: '36px', value: '36px' },
  { key: '48', label: '48px', value: '48px' },
  { key: '60', label: '60px', value: '60px' },
  { key: '72', label: '72px', value: '72px' },
];

interface FontSizeDropdownProps {
  selectedFontSize: string;
}

export function FontSizeDropdown({ selectedFontSize }: FontSizeDropdownProps) {
  const [editor] = useLexicalComposerContext();

  const handleFontSizeChange = (fontSize: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, {
          'font-size': fontSize,
        });
      }
    });
  };

  const options = FONT_SIZE_OPTIONS.map(option => ({
    key: option.key,
    label: option.label,
    icon: <Type className="h-3 w-3" />,
    onClick: () => handleFontSizeChange(option.value),
  }));

  const selectedOption = FONT_SIZE_OPTIONS.find(
    option => option.value === selectedFontSize
  );

  return (
    <ToolbarDropdown
      options={options}
      selectedKey={selectedOption?.key || '16'}
      buttonLabel="Size"
      className="min-w-[80px]"
    />
  );
}