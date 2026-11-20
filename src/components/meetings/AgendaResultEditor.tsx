import SimpleRichTextEditor from '@/components/ui/SimpleRichTextEditor';
import { sanitizeRichHtml } from '@/utils/htmlSanitizer';
import type { AgendaItem } from './types';

export interface AgendaResult {
  result_text: string;
  result_html: string | null;
}

interface AgendaResultEditorProps {
  item: Pick<AgendaItem, 'result_text' | 'result_html'>;
  onChange: (result: AgendaResult) => void;
  placeholder: string;
  minHeight?: string;
}

export function AgendaResultEditor({ item, onChange, placeholder, minHeight = '80px' }: AgendaResultEditorProps) {
  const text = item.result_text ?? '';
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const initialContent = item.result_html ? sanitizeRichHtml(item.result_html) : escaped.split('\n').map(line => `<p>${line || '<br>'}</p>`).join('');

  return (
    <SimpleRichTextEditor
      initialContent={initialContent}
      placeholder={placeholder}
      minHeight={minHeight}
      compactToolbar
      onChange={(html, plainText) => {
        const result = { result_text: plainText.trim() ? plainText : '', result_html: plainText.trim() ? html : null };
        if (result.result_text !== text || result.result_html !== (item.result_html ?? null)) onChange(result);
      }}
    />
  );
}
