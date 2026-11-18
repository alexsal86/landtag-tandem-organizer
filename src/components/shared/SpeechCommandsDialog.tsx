import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CircleHelp, Search } from 'lucide-react';
import { SPEECH_COMMAND_REFERENCE, type SpeechCommand } from '@/lib/speechCommandUtils';

export function SpeechCommandsDialog({ availableCommands }: {
  availableCommands?: readonly SpeechCommand['type'][];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SPEECH_COMMAND_REFERENCE
      .map((group) => ({
        ...group,
        commands: group.commands.filter((cmd) =>
          (!cmd.requires || availableCommands?.includes(cmd.requires))
          && (cmd.trigger.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q)),
        ),
      }))
      .filter((group) => group.commands.length > 0);
  }, [search, availableCommands]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
          onMouseDown={(e) => e.preventDefault()}
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
          Sprachbefehle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[70vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Sprachbefehle</DialogTitle>
          <DialogDescription>
            Klicke auf das Mikrofon oder halte <kbd>Strg+Shift+M</kbd> gedrückt.
            Sprich Bearbeitungsbefehle wie „Letzten Satz löschen“ einzeln.
            Satzzeichen kannst du mitdiktieren, etwa „Der Antrag ist angenommen Punkt“.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search aria-hidden="true" className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Sprachbefehle durchsuchen"
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
                    <span className="font-medium text-foreground">„{cmd.trigger}“</span>
                    <span className="text-muted-foreground text-xs text-right">{cmd.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
