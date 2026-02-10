import { CaseFile } from "@/hooks/useCaseFiles";
import { CaseFileContact, CONTACT_ROLES } from "@/hooks/useCaseFileDetails";
import { useCaseFileTypes } from "@/hooks/useCaseFileTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { TopicSelector } from "@/components/topics/TopicSelector";
import { UserSelector } from "@/components/UserSelector";
import { icons, LucideIcon } from "lucide-react";
import {
  Users,
  Building2,
  Plus,
  Phone,
  Mail,
  Tag,
  Clock,
  CalendarDays,
  Eye,
  EyeOff,
  Globe,
  UserCheck,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface CaseFileLeftSidebarProps {
  caseFile: CaseFile;
  contacts: CaseFileContact[];
  assignedTopics: string[];
  onTopicsChange: (topicIds: string[]) => void;
  onAddContact: () => void;
  onAssignUser?: (userId: string) => void;
}

export function CaseFileLeftSidebar({
  caseFile,
  contacts,
  assignedTopics,
  onTopicsChange,
  onAddContact,
  onAssignUser,
}: CaseFileLeftSidebarProps) {
  const { caseFileTypes } = useCaseFileTypes();
  const typeConfig = caseFileTypes.find((t) => t.name === caseFile.case_type);

  const getIconComponent = (iconName?: string | null): LucideIcon | null => {
    if (!iconName) return null;
    const Icon = icons[iconName as keyof typeof icons] as LucideIcon;
    return Icon || null;
  };

  const TypeIcon = getIconComponent(typeConfig?.icon);

  const getRoleLabel = (roleValue: string) => {
    return CONTACT_ROLES.find((r) => r.value === roleValue)?.label || roleValue;
  };

  // Split contacts into persons and organizations
  const personContacts = contacts.filter(
    (c) => !c.contact?.contact_type || c.contact.contact_type === 'person'
  );
  const orgContacts = contacts.filter(
    (c) => c.contact?.contact_type === 'organization'
  );

  const visibilityConfig = {
    private: { icon: EyeOff, label: "Privat" },
    shared: { icon: Users, label: "Geteilt" },
    public: { icon: Globe, label: "Öffentlich" },
  };
  const visibility = visibilityConfig[caseFile.visibility as keyof typeof visibilityConfig] || visibilityConfig.public;
  const VisIcon = visibility.icon;

  const renderContactList = (contactList: CaseFileContact[]) => {
    if (contactList.length === 0) {
      return <p className="text-xs text-muted-foreground py-1">Keine verknüpft</p>;
    }
    return (
      <div className="space-y-2">
        {contactList.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={item.contact?.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {item.contact?.name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{item.contact?.name}</div>
              {item.contact?.organization && (
                <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Building2 className="h-3 w-3 shrink-0" />
                  {item.contact.organization}
                </div>
              )}
              <Badge variant="secondary" className="text-[10px] mt-1 h-5">
                {getRoleLabel(item.role)}
              </Badge>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
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
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Zuständiger Bearbeiter - FIRST */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Zuständig
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <UserSelector
            onSelect={(user) => onAssignUser?.(user.id)}
            selectedUserId={caseFile.assigned_to || undefined}
            placeholder="Bearbeiter zuweisen..."
          />
        </CardContent>
      </Card>

      {/* Beteiligte Personen */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Personen
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddContact}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {renderContactList(personContacts)}
        </CardContent>
      </Card>

      {/* Beteiligte Institutionen - always show */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Institutionen
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddContact}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {renderContactList(orgContacts)}
        </CardContent>
      </Card>

      {/* Themen / Politischer Kontext */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Themen
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <TopicSelector
            selectedTopicIds={assignedTopics}
            onTopicsChange={onTopicsChange}
            compact
          />
        </CardContent>
      </Card>

      {/* Metadaten (inkl. Kategorie + Sichtbarkeit) */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Metadaten
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          {/* Kategorie */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {TypeIcon && <TypeIcon className="h-3.5 w-3.5 shrink-0" style={{ color: typeConfig?.color || undefined }} />}
            <span>Kategorie: {typeConfig?.label || caseFile.case_type}</span>
          </div>

          {/* Sichtbarkeit */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <VisIcon className="h-3.5 w-3.5 shrink-0" />
            <span>Sichtbarkeit: {visibility.label}</span>
          </div>

          <Separator className="my-2" />

          {caseFile.start_date && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>Start: {format(new Date(caseFile.start_date), "dd.MM.yyyy", { locale: de })}</span>
            </div>
          )}
          {caseFile.target_date && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>Ziel: {format(new Date(caseFile.target_date), "dd.MM.yyyy", { locale: de })}</span>
            </div>
          )}
          {/* Aktualisiert first, then Erstellt */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>Aktualisiert: {format(new Date(caseFile.updated_at), "dd.MM.yyyy", { locale: de })}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>Erstellt: {format(new Date(caseFile.created_at), "dd.MM.yyyy", { locale: de })}</span>
          </div>

          {caseFile.tags && caseFile.tags.length > 0 && (
            <>
              <Separator className="my-2" />
              <div className="flex flex-wrap gap-1">
                {caseFile.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
