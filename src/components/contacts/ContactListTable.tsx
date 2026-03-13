import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Mail, Phone, MapPin, Building, User, Star, ChevronUp, ChevronDown } from "lucide-react";
import { Contact } from "@/hooks/useInfiniteContacts";
import { getGenderLabel } from "./hooks/useContactsViewState";
import { getInitials } from "./utils/contactFormatters";
import { useToast } from "@/hooks/use-toast";

interface ContactListTableProps {
  contacts: Contact[];
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
  onContactClick: (id: string) => void;
  onToggleFavorite: (id: string, val: boolean) => void;
  documentCounts: Record<string, { total: number }>;
  expandedDocuments: Set<string>;
  toggleDocumentsExpanded: (id: string) => void;
}

function SortableTableHead({ children, sortKey, sortColumn, sortDirection, onSort, className = "" }: {
  children: React.ReactNode; sortKey: string; sortColumn: string | null; sortDirection: "asc" | "desc"; onSort: (col: string) => void; className?: string;
}) {
  return (
    <TableHead className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className}`} onClick={() => onSort(sortKey)}>
      <div className="flex items-center gap-1">
        {children}
        <div className="flex flex-col gap-0">
          <ChevronUp className={`h-3 w-3 transition-colors ${sortColumn === sortKey && sortDirection === "asc" ? "text-primary" : "text-muted-foreground/40"}`} />
          <ChevronDown className={`h-3 w-3 transition-colors -mt-0.5 ${sortColumn === sortKey && sortDirection === "desc" ? "text-primary" : "text-muted-foreground/40"}`} />
        </div>
      </div>
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
}: ContactListTableProps) {
  const { toast } = useToast();
  const [splitNameMode, setSplitNameMode] = useState(() => {
    try { return localStorage.getItem("contacts-split-name") === "true"; } catch { return false; }
  });

  const toggleSplitName = () => {
    const next = !splitNameMode;
    setSplitNameMode(next);
    try { localStorage.setItem("contacts-split-name", String(next)); } catch {}
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 px-2"></TableHead>
            <SortableTableHead sortKey="gender" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-16">Anrede</SortableTableHead>
            {splitNameMode ? (
              <>
                <SortableTableHead sortKey="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>
                  <span>Vorname</span>
                </SortableTableHead>
                <SortableTableHead sortKey="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>
                  <span>Nachname</span>
                </SortableTableHead>
              </>
            ) : (
              <SortableTableHead sortKey="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>Name</SortableTableHead>
            )}
            <SortableTableHead sortKey="organization" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>Organisation</SortableTableHead>
            <SortableTableHead sortKey="email" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>Kontakt</SortableTableHead>
            <SortableTableHead sortKey="address" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>Adresse</SortableTableHead>
            <TableHead className="w-20">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 cursor-pointer" onClick={toggleSplitName}>
                      <Switch checked={splitNameMode} className="scale-75" tabIndex={-1} />
                      <span className="text-xs">V/N</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Vor-/Nachname aufteilen</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => {
            const { firstName, lastName } = splitName(contact.name);
            return (
              <TableRow key={contact.id} className="cursor-pointer hover:bg-muted/50 h-11" onClick={() => onContactClick(contact.id)}>
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

                {/* Anrede */}
                <TableCell className="py-1">
                  <span className="text-xs text-muted-foreground">
                    {contact.contact_type === "organization" ? "Org." : getGenderLabel(contact.gender ?? undefined) || "–"}
                  </span>
                </TableCell>

                {/* Name */}
                {splitNameMode ? (
                  <>
                    <TableCell className="py-1"><span className="text-sm truncate block max-w-[140px]">{firstName}</span></TableCell>
                    <TableCell className="py-1"><span className="text-sm font-medium truncate block max-w-[140px]">{lastName}</span></TableCell>
                  </>
                ) : (
                  <TableCell className="py-1"><span className="text-sm font-medium truncate block max-w-[200px]">{contact.name}</span></TableCell>
                )}

                {/* Organisation */}
                <TableCell className="py-1">
                  <span className="text-sm truncate block max-w-[160px]">
                    {contact.contact_type === "organization" ? (contact.industry || contact.legal_form || "–") : (contact.organization || "–")}
                  </span>
                </TableCell>

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
                    {contact.address || contact.location || "—"}
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
