import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mail, Phone, MapPin, Building, User, Star, ChevronUp, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Contact } from "@/hooks/useInfiniteContacts";
import { ContactDocumentRows } from "./ContactDocumentRows";
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
      <div className="flex items-center gap-2">
        {children}
        <div className="flex flex-col gap-0">
          <ChevronUp className={`h-3 w-3 transition-colors ${sortColumn === sortKey && sortDirection === "asc" ? "text-primary" : "text-muted-foreground/40"}`} />
          <ChevronDown className={`h-3 w-3 transition-colors -mt-0.5 ${sortColumn === sortKey && sortDirection === "desc" ? "text-primary" : "text-muted-foreground/40"}`} />
        </div>
      </div>
    </TableHead>
  );
}

export function ContactListTable({
  contacts, sortColumn, sortDirection, onSort, onContactClick, onToggleFavorite,
  documentCounts, expandedDocuments, toggleDocumentsExpanded,
}: ContactListTableProps) {
  const { toast } = useToast();

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Avatar</TableHead>
            <SortableTableHead sortKey="gender" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>Anrede</SortableTableHead>
            <SortableTableHead sortKey="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>Name</SortableTableHead>
            <SortableTableHead sortKey="organization" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>Organisation/Rolle</SortableTableHead>
            <SortableTableHead sortKey="email" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>Kontakt</SortableTableHead>
            <SortableTableHead sortKey="address" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>Adresse</SortableTableHead>
            <SortableTableHead sortKey="last_contact" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>Letzter Kontakt</SortableTableHead>
            <TableHead className="text-center w-24">Dokumente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <React.Fragment key={contact.id}>
              <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => onContactClick(contact.id)}>
                <TableCell>
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={contact.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">{getInitials(contact.name)}</AvatarFallback>
                    </Avatar>
                    <Button variant="ghost" size="icon"
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(contact.id, !contact.is_favorite); }}
                      className="absolute -top-1 -right-1 h-4 w-4 p-0 bg-background rounded-full shadow-sm hover:bg-muted">
                      <Star className={`h-3 w-3 transition-colors ${contact.is_favorite ? 'text-yellow-500 fill-current' : 'text-muted-foreground hover:text-yellow-500'}`} />
                    </Button>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{contact.contact_type === "organization" ? "Org." : getGenderLabel(contact.gender ?? undefined) || "–"}</Badge></TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{contact.name}</span>
                    {contact.tags && contact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">{contact.tags.slice(0, 3).map(tag => <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">{tag}</Badge>)}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{contact.contact_type === "organization" ? (contact.industry || contact.legal_form || "–") : (contact.organization || "–")}</span>
                    <span className="text-xs text-muted-foreground">{contact.role || (contact.contact_type === "organization" ? contact.main_contact_person : "") || ""}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {contact.email && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2 justify-start text-xs" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(contact.email!); toast({ title: "E-Mail kopiert" }); }}>
                          <Mail className="h-3 w-3 mr-1" />{contact.email.length > 20 ? contact.email.slice(0, 20) + '...' : contact.email}
                        </Button>
                      </TooltipTrigger><TooltipContent>{contact.email}</TooltipContent></Tooltip></TooltipProvider>
                    )}
                    {contact.phone && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2 justify-start text-xs" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(contact.phone!); toast({ title: "Telefon kopiert" }); }}>
                          <Phone className="h-3 w-3 mr-1" />{contact.phone}
                        </Button>
                      </TooltipTrigger><TooltipContent>{contact.phone}</TooltipContent></Tooltip></TooltipProvider>
                    )}
                    {contact.linkedin && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2 justify-start text-xs" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(contact.linkedin!); toast({ title: "LinkedIn kopiert" }); }}>
                          <User className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger><TooltipContent>{contact.linkedin}</TooltipContent></Tooltip></TooltipProvider>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {(contact.address || contact.location) ? (
                      <div className="flex items-start gap-1"><MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" /><div className="leading-tight"><div>{contact.address || contact.location}</div></div></div>
                    ) : "—"}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{contact.last_contact || "—"}</TableCell>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  {documentCounts[contact.id]?.total > 0 ? (
                    <Button variant="ghost" size="sm" onClick={() => toggleDocumentsExpanded(contact.id)} className="p-1 h-auto text-sm hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <ChevronRight className={`h-3 w-3 transition-transform ${expandedDocuments.has(contact.id) ? 'rotate-90' : ''}`} />
                        <FileText className="h-3 w-3" /><span>{documentCounts[contact.id].total}</span>
                      </div>
                    </Button>
                  ) : "—"}
                </TableCell>
              </TableRow>
              {expandedDocuments.has(contact.id) && <ContactDocumentRows contactId={contact.id} contactTags={contact.tags || []} />}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
