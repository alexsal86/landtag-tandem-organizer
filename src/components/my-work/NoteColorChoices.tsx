import { cn } from '@/lib/utils';
import { colorLabel, type NoteColorDef } from './useNoteColorPalette';

/** One picker for capture, card menus and filters, using the personal palette. */
export function NoteColorChoices({ palette, selected, onSelect }: {
  palette: NoteColorDef[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  return <div className="flex max-w-xs flex-wrap gap-2" role="group" aria-label="Notizfarbe">
    {palette.map(color => <button
      type="button" key={color.value} aria-label={colorLabel(color)}
      aria-pressed={selected?.toLowerCase() === color.value.toLowerCase()}
      title={colorLabel(color)}
      className={cn('inline-flex min-h-7 max-w-full items-center rounded-full border px-3 py-1 text-xs font-semibold leading-snug transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected?.toLowerCase() === color.value.toLowerCase() ? 'border-foreground ring-1 ring-foreground/30' : 'border-transparent')}
      style={{ backgroundColor: color.value, color: `color-mix(in srgb, ${color.value} 25%, black)` }}
      onClick={event => { event.stopPropagation(); onSelect(color.value); }}
    >{color.meaning?.trim() || color.name}</button>)}
  </div>;
}
