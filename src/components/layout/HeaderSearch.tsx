import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

export function HeaderSearch() {
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K shortcut -> dispatch event to open GlobalSearchCommand
  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        window.dispatchEvent(new Event('openGlobalSearch'));
      }
    };

    document.addEventListener('keydown', handleGlobalKeydown);
    return () => document.removeEventListener('keydown', handleGlobalKeydown);
  }, []);

  const handleClick = () => {
    window.dispatchEvent(new Event('openGlobalSearch'));
  };

  return (
    <div className="relative cursor-pointer" onClick={handleClick}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--nav-muted))]" />
      <div
        ref={inputRef as any}
        className="w-64 pl-9 pr-12 py-1.5 text-sm rounded-md bg-[hsl(var(--nav-hover))] border border-[hsl(var(--nav-foreground)/0.2)] text-[hsl(var(--nav-muted))] select-none"
      >
        Suchen...
      </div>
      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-[hsl(var(--nav-foreground)/0.2)] bg-[hsl(var(--nav-hover))] px-1.5 font-mono text-[10px] font-medium text-[hsl(var(--nav-muted))]">
        ⌘K
      </kbd>
    </div>
  );
}
