import { CaseFile } from "@/features/cases/files/hooks";
import { CaseFileContact, CaseFileDocument, CONTACT_ROLES } from "@/features/cases/files/hooks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TopicSelector } from "@/components/topics/TopicSelector";
import { UserSelector } from "@/components/admin/UserSelector";
import {
  Plus,
  Phone,
  Mail,
} from "lucide-react";

interface CaseFileLeftSidebarProps {
  caseFile: CaseFile;
  contacts: CaseFileContact[];
  documents: CaseFileDocument[];
  assignedTopics: string[];
  onTopicsChange: (topicIds: string[]) => void;
  onAddContact: () => void;
  onAssignUser?: (userId: string) => void;
}

function SectionHeader({
  label,
  count,
  onAdd,
}: {
  label: string;
  count?: number;
  onAdd?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
        {label}
        {typeof count === "number" && (
          <span className="ml-2 text-muted-foreground/70">· {count}</span>
        )}
      </div>
      {onAdd && (
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-card p-4">{children}</div>;
}

export function CaseFileLeftSidebar({
  caseFile,
  contacts,
  assignedTopics,
  onTopicsChange,
  onAddContact,
  onAssignUser,
}: CaseFileLeftSidebarProps) {
  const getRoleLabel = (roleValue: string) => {
    return CONTACT_ROLES.find((r) => r.value === roleValue)?.label || roleValue;
  };

  const personContacts = contacts.filter(
    (c) => !c.contact?.contact_type || c.contact.contact_type === "person"
  );
  const orgContacts = contacts.filter(
    (c) => c.contact?.contact_type === "organization"
  );

  const renderPerson = (item: CaseFileContact) => (
    <div key={item.id} className="flex items-start gap-2.5 py-1.5">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={item.contact?.avatar_url || undefined} />
        <AvatarFallback className="text-[10px] font-medium">
          {item.contact?.name
            ?.split(" ")
            .slice(0, 2)
            .map((p) => p[0])
            .join("") || "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{item.contact?.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {item.role ? getRoleLabel(item.role) : item.contact?.organization || ""}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100">
        {item.contact?.phone && (
          <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
            <a href={`tel:${item.contact.phone}`}>
              <Phone className="h-3 w-3" />
            </a>
          </Button>
        )}
        {item.contact?.email && (
          <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
            <a href={`mailto:${item.contact.email}`}>
              <Mail className="h-3 w-3" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );

  const renderOrg = (item: CaseFileContact) => (
    <div
      key={item.id}
      className="rounded-md border bg-background px-3 py-2 hover:bg-muted/40 transition-colors"
    >
      <div className="text-sm font-semibold leading-tight">{item.contact?.name}</div>
      <div className="text-xs text-muted-foreground mt-0.5">
        {item.role ? getRoleLabel(item.role) : item.contact?.organization || "—"}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Zuständig */}
      <SectionCard>
        <SectionHeader label="Zuständig" />
        <UserSelector
          onSelect={(user) => onAssignUser?.(user.id)}
          selectedUserId={caseFile.assigned_to || undefined}
          placeholder="Bearbeiter zuweisen..."
        />
      </SectionCard>

      {/* Personen */}
      <SectionCard>
        <SectionHeader label="Personen" count={personContacts.length} onAdd={onAddContact} />
        {personContacts.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Keine verknüpft</p>
        ) : (
          <div className="space-y-0">{personContacts.map(renderPerson)}</div>
        )}
      </SectionCard>

      {/* Institutionen */}
      <SectionCard>
        <SectionHeader label="Institutionen" count={orgContacts.length} onAdd={onAddContact} />
        {orgContacts.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Keine verknüpft</p>
        ) : (
          <div className="space-y-2">{orgContacts.map(renderOrg)}</div>
        )}
      </SectionCard>

      {/* Themen */}
      <SectionCard>
        <SectionHeader label="Themen" />
        <TopicSelector
          selectedTopicIds={assignedTopics}
          onTopicsChange={onTopicsChange}
          compact
        />
      </SectionCard>

      {caseFile.tags && caseFile.tags.length > 0 && (
        <SectionCard>
          <SectionHeader label="Tags" />
          <div className="flex flex-wrap gap-1">
            {caseFile.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
