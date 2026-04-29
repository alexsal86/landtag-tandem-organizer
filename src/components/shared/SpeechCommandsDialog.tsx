import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CircleHelp, Search } from 'lucide-react';
import { SPEECH_COMMAND_REFERENCE } from '@/lib/speechCommandUtils';

export function SpeechCommandsDialog() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return SPEECH_COMMAND_REFERENCE;
    const q = search.toLowerCase();
    return SPEECH_COMMAND_REFERENCE
      .map((group) => ({
        ...group,
        commands: group.commands.filter(
          (cmd) => cmd.trigger.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q),
        ),
      }))
      .filter((group) => group.commands.length > 0);
  }, [search]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground"
          aria-label="Sprachbefehle anzeigen"
          onMouseDown={(e) => e.preventDefault()}
        >
          <CircleHelp className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[70vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Sprachbefehle</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Befehl suchen…"
            className="pl-8 h-9"
            autoFocus
          />
        </div>
        <div className="overflow-y-auto flex-1 space-y-4 pr-1 -mr-1">
          {filteredGroups.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Kein Befehl gefunden.</p>
          )}
          {filteredGroups.map((group) => (
            <div key={group.label}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {group.label}
              </h4>
              <div className="space-y-1">
                {group.commands.map((cmd) => (
                  <div
                    key={cmd.trigger}
                    className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 text-sm"
                  >
                    <span className="font-medium text-foreground">„{cmd.trigger}"</span>
                    <span className="text-muted-foreground text-xs text-right">{cmd.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="border-t pt-3 pb-1">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Tipp:</span> Halte <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px]">Strg+Shift+M</kbd> für Push-to-Talk
              oder klicke das Mikrofon zum Umschalten.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
