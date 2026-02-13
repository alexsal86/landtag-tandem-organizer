import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

export function HeaderSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  // Cmd+K shortcut -> focus input
  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeydown);
    return () => document.removeEventListener('keydown', handleGlobalKeydown);
  }, []);

  const openSearch = (query: string) => {
    window.dispatchEvent(new CustomEvent('openGlobalSearch', { detail: { query } }));
    setValue('');
    inputRef.current?.blur();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    if (v.length >= 1) {
      openSearch(v);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value) {
      openSearch(value);
    }
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--nav-muted))]" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Suchen..."
        className="w-64 pl-9 pr-12 py-1.5 text-sm rounded-md bg-[hsl(var(--nav-hover))] border border-[hsl(var(--nav-foreground)/0.2)] text-[hsl(var(--nav-foreground))] placeholder:text-[hsl(var(--nav-muted))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--nav-foreground)/0.3)]"
      />
      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-[hsl(var(--nav-foreground)/0.2)] bg-[hsl(var(--nav-hover))] px-1.5 font-mono text-[10px] font-medium text-[hsl(var(--nav-muted))]">
        ⌘K
      </kbd>
    </div>
  );
}
