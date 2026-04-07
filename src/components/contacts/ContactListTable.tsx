import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Mail, Phone, CalendarDays, User, Star, ChevronUp, ChevronDown, Clock, Tag } from "lucide-react";
import { Contact } from "@/hooks/useInfiniteContacts";
import { getGenderLabel } from "./hooks/useContactsViewState";
import { getInitials } from "./utils/contactFormatters";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface ContactListTableProps {
  contacts: Contact[];
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
  onContactClick: (id: string) => void;
  onToggleFavorite: (id: string, val: boolean) => void;
  isSelectionMode: boolean;
  selectedContactIds: Set<string>;
  onToggleSelection: (id: string) => void;
}

function SortableTableHead({ children, sortKey, sortColumn, sortDirection, onSort, className = "" }: {
  children: React.ReactNode; sortKey: string; sortColumn: string | null; sortDirection: "asc" | "desc"; onSort: (col: string) => void; className?: string;
}) {
  const ariaSort = sortColumn === sortKey ? (sortDirection === "asc" ? "ascending" : "descending") : "none";

  return (
    <TableHead aria-sort={ariaSort} className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex w-full items-center gap-1 rounded-sm px-1 py-1 text-left text-inherit transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <span>{children}</span>
        <div className="flex flex-col gap-0" aria-hidden="true">
          <ChevronUp className={`h-3 w-3 transition-colors ${sortColumn === sortKey && sortDirection === "asc" ? "text-primary" : "text-muted-foreground/40"}`} />
          <ChevronDown className={`-mt-0.5 h-3 w-3 transition-colors ${sortColumn === sortKey && sortDirection === "desc" ? "text-primary" : "text-muted-foreground/40"}`} />
        </div>
      </button>
    </TableHead>
  );
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function ContactListTable({
  contacts, sortColumn, sortDirection, onSort, onContactClick, onToggleFavorite,
  isSelectionMode, selectedContactIds, onToggleSelection,
}: ContactListTableProps) {
  const { toast } = useToast();
  const [splitNameMode, setSplitNameMode] = useState(() => {
    try { return localStorage.getItem("contacts-split-name") === "true"; } catch { return false; }
  });
  const [showSalutation, setShowSalutation] = useState(() => {
    try { return localStorage.getItem("contacts-show-salutation") === "true"; } catch { return false; }
  });
  const [orgColumn, setOrgColumn] = useState(() => {
    try { return localStorage.getItem("contacts-org-column") === "true"; } catch { return false; }
  });

  const toggleSplitName = () => {
    const next = !splitNameMode;
    setSplitNameMode(next);
    try { localStorage.setItem("contacts-split-name", String(next)); } catch {}
  };
  const toggleSalutation = () => {
    const next = !showSalutation;
    setShowSalutation(next);
    try { localStorage.setItem("contacts-show-salutation", String(next)); } catch {}
  };
  const toggleOrgColumn = () => {
    const next = !orgColumn;
    setOrgColumn(next);
    try { localStorage.setItem("contacts-org-column", String(next)); } catch {}
  };

  return (
    <div className="overflow-visible [&>div]:overflow-visible">
      <Table>
        <TableHeader>
          <TableRow>
            {isSelectionMode && (
              <TableHead className="w-10 px-2 sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"></TableHead>
            )}
            <TableHead className="w-10 px-2 sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"></TableHead>
            {splitNameMode ? (
              <>
                <SortableTableHead sortKey="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                  <span>Vorname</span>
                </SortableTableHead>
                <SortableTableHead sortKey="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                  <span>Nachname</span>
                </SortableTableHead>
              </>
            ) : (
              <SortableTableHead sortKey="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">Name</SortableTableHead>
            )}
            {orgColumn && (
              <SortableTableHead sortKey="organization" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">Organisation</SortableTableHead>
            )}
            <SortableTableHead sortKey="email" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">Kontakt</SortableTableHead>
            <SortableTableHead sortKey="address" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">Adresse</SortableTableHead>
            <TableHead className="w-44 sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="flex items-center gap-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded-sm px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                        onClick={toggleSplitName}
                        role="switch"
                        aria-checked={splitNameMode}
                        aria-label="Vor-/Nachname aufteilen"
                      >
                        <Switch checked={splitNameMode} className="scale-[0.6]" tabIndex={-1} aria-hidden="true" />
                        <span className="text-[10px]">V/N</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Vor-/Nachname aufteilen</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded-sm px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                        onClick={toggleSalutation}
                        role="switch"
                        aria-checked={showSalutation}
                        aria-label="Anrede inline anzeigen"
                      >
                        <Switch checked={showSalutation} className="scale-[0.6]" tabIndex={-1} aria-hidden="true" />
                        <span className="text-[10px]">Hr/Fr</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Anrede inline anzeigen</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded-sm px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                        onClick={toggleOrgColumn}
                        role="switch"
                        aria-checked={orgColumn}
                        aria-label="Organisation als eigene Spalte"
                      >
                        <Switch checked={orgColumn} className="scale-[0.6]" tabIndex={-1} aria-hidden="true" />
                        <span className="text-[10px]">Org</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Organisation als eigene Spalte</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => {
            const { firstName, lastName } = splitName(contact.name);
            const salutationPrefix = showSalutation && contact.contact_type !== "organization"
              ? (getGenderLabel(contact.gender ?? undefined) ? getGenderLabel(contact.gender ?? undefined) + " " : "")
              : "";
            const orgInline = !orgColumn && contact.contact_type !== "organization" && contact.organization;

            return (
              <TableRow key={contact.id} className="cursor-pointer hover:bg-muted/50 h-11" onClick={() => onContactClick(contact.id)}>
                {isSelectionMode && (
                  <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedContactIds.has(contact.id)}
                      onCheckedChange={() => onToggleSelection(contact.id)}
                      aria-label={`${contact.name} auswählen`}
                    />
                  </TableCell>
                )}
                {/* Avatar + Star */}
                <TableCell className="px-2 py-1">
                  <div className="relative inline-block">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={contact.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{getInitials(contact.name)}</AvatarFallback>
                    </Avatar>
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(contact.id, !contact.is_favorite); }}
                      className="absolute -top-1 -right-1.5 p-0 rounded-full hover:scale-110 transition-transform"
                    >
                      <Star className={`h-3 w-3 ${contact.is_favorite ? 'text-yellow-500 fill-current' : 'text-muted-foreground/40 hover:text-yellow-500'}`} />
                    </button>
                  </div>
                </TableCell>

                {/* Name */}
                {splitNameMode ? (
                  <>
                    <TableCell className="py-1">
                      <span className="text-sm truncate block max-w-[140px]">{salutationPrefix}{firstName}</span>
                      {orgInline && <span className="text-xs text-muted-foreground truncate block max-w-[140px]">{contact.organization}</span>}
                    </TableCell>
                    <TableCell className="py-1">
                      <HoverCard openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <span className="text-sm font-semibold truncate block max-w-[140px] underline-offset-2 hover:underline">{lastName}</span>
                        </HoverCardTrigger>
                        <HoverCardContent align="start" className="w-80 space-y-3">
                          <div>
                            <p className="font-semibold leading-tight">{contact.name}</p>
                            <p className="text-sm text-muted-foreground">{contact.role || contact.organization || "Keine Rolle hinterlegt"}</p>
                          </div>
                          <div className="space-y-1.5 text-sm">
                            {contact.birthday && <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />{format(new Date(contact.birthday), "dd.MM.yyyy", { locale: de })}</div>}
                            {contact.last_contact && <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-muted-foreground" />Letzter Kontakt: {format(new Date(contact.last_contact), "dd.MM.yyyy", { locale: de })}</div>}
                            {contact.notes && <p className="text-muted-foreground line-clamp-2">{contact.notes}</p>}
                          </div>
                          {!!contact.tags?.length && <div className="flex flex-wrap gap-1">{contact.tags.slice(0, 4).map(tag => <Badge key={tag} variant="secondary" className="text-xs"><Tag className="h-3 w-3 mr-1" />{tag}</Badge>)}</div>}
                        </HoverCardContent>
                      </HoverCard>
                    </TableCell>
                  </>
                ) : (
                  <TableCell className="py-1">
                    <HoverCard openDelay={200} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <div className="max-w-[200px]">
                          <span className="text-sm font-semibold truncate block underline-offset-2 hover:underline">{salutationPrefix}{contact.name}</span>
                          {orgInline && <span className="text-xs text-muted-foreground truncate block">{contact.organization}</span>}
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent align="start" className="w-80 space-y-3">
                        <div>
                          <p className="font-semibold leading-tight">{contact.name}</p>
                          <p className="text-sm text-muted-foreground">{contact.role || contact.organization || "Keine Rolle hinterlegt"}</p>
                        </div>
                        <div className="space-y-1.5 text-sm">
                          {contact.birthday && <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />{format(new Date(contact.birthday), "dd.MM.yyyy", { locale: de })}</div>}
                          {contact.last_contact && <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-muted-foreground" />Letzter Kontakt: {format(new Date(contact.last_contact), "dd.MM.yyyy", { locale: de })}</div>}
                          {contact.notes && <p className="text-muted-foreground line-clamp-2">{contact.notes}</p>}
                        </div>
                        {!!contact.tags?.length && <div className="flex flex-wrap gap-1">{contact.tags.slice(0, 4).map(tag => <Badge key={tag} variant="secondary" className="text-xs"><Tag className="h-3 w-3 mr-1" />{tag}</Badge>)}</div>}
                      </HoverCardContent>
                    </HoverCard>
                  </TableCell>
                )}

                {/* Organisation (eigene Spalte, nur wenn Toggle aktiv) */}
                {orgColumn && (
                  <TableCell className="py-1">
                    <span className="text-sm truncate block max-w-[160px]">
                      {contact.contact_type === "organization" ? "–" : (contact.organization || "–")}
                    </span>
                  </TableCell>
                )}

                {/* Contact info */}
                <TableCell className="py-1">
                  <div className="flex items-center gap-2">
                    {contact.email && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(contact.email!); toast({ title: "E-Mail kopiert" }); }}>
                          <Mail className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger><TooltipContent>{contact.email}</TooltipContent></Tooltip></TooltipProvider>
                    )}
                    {contact.phone && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(contact.phone!); toast({ title: "Telefon kopiert" }); }}>
                          <Phone className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger><TooltipContent>{contact.phone}</TooltipContent></Tooltip></TooltipProvider>
                    )}
                    {contact.linkedin && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(contact.linkedin!); toast({ title: "LinkedIn kopiert" }); }}>
                          <User className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger><TooltipContent>{contact.linkedin}</TooltipContent></Tooltip></TooltipProvider>
                    )}
                  </div>
                </TableCell>

                {/* Address */}
                <TableCell className="py-1">
                  <span className="text-sm text-muted-foreground truncate block max-w-[180px]">
                    {contact.address || contact.business_city || "—"}
                  </span>
                </TableCell>

                {/* Empty cell for the toggle column */}
                <TableCell className="py-1"></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
