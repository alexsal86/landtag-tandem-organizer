import { ChevronDownIcon, ChevronRightIcon, ClipboardListIcon, PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProgramRow } from "./types";

interface ProgramCardProps {
  programRows: ProgramRow[];
  expandedSection: boolean;
  onToggleSection: () => void;
  onAdd: () => void;
  onUpdate: (idx: number, field: keyof ProgramRow, value: string) => void;
  onRemove: (idx: number) => void;
}

export function ProgramCard({
  programRows,
  expandedSection,
  onToggleSection,
  onAdd,
  onUpdate,
  onRemove,
}: ProgramCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Collapsible open={expandedSection} onOpenChange={onToggleSection}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <ClipboardListIcon className="h-5 w-5 text-primary" />
              <h3 className="font-medium">Programm / Ablaufplan</h3>
              {programRows.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  {programRows.length} {programRows.length === 1 ? 'Punkt' : 'Punkte'}
                </span>
              )}
            </div>
            {expandedSection ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            {programRows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Zeit</TableHead>
                    <TableHead>Programmpunkt</TableHead>
                    <TableHead>Hinweise</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programRows.map((row, idx) => (
                    <TableRow key={row.id}>
                      <TableCell className="py-2">
                        <Input
                          value={row.time}
                          onChange={(e) => onUpdate(idx, 'time', e.target.value)}
                          placeholder="10:00"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <Input
                          value={row.item}
                          onChange={(e) => onUpdate(idx, 'item', e.target.value)}
                          placeholder="Programmpunkt"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <Input
                          value={row.notes}
                          onChange={(e) => onUpdate(idx, 'notes', e.target.value)}
                          placeholder="Hinweise"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemove(idx)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground px-1 mb-3">Noch keine Programmpunkte eingetragen.</p>
            )}
            <Button variant="outline" size="sm" onClick={onAdd} className="mt-3">
              <PlusIcon className="h-4 w-4 mr-2" />
              Programmpunkt hinzufügen
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
