import React from 'react';
import { Mail, Phone, MapPin, Building, User, Calendar, Globe, ExternalLink, Tag, Hash } from 'lucide-react';
import { Linkedin, Facebook, Instagram } from '@/components/icons/SocialIcons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatGermanDate } from '@/lib/utils';
import type { Contact } from '@/types/contact';
import type { LucideIcon } from 'lucide-react';

interface ContactInfoTabProps {
  contact: Contact;
  allTags: { direct: string[]; inherited: string[] };
}

const cleanUsername = (input: string): string => {
  if (!input) return '';
  return input.replace(/^https?:\/\//, '').replace(/^(www\.)?/, '')
    .replace(/^(linkedin\.com\/in\/|x\.com\/|facebook\.com\/|instagram\.com\/|xing\.com\/profile\/)/, '')
    .replace(/^@/, '').replace(/\/$/, '').trim();
};

const generateSocialMediaUrl = (platform: string, username: string): string => {
  const c = cleanUsername(username);
  switch (platform) {
    case 'linkedin': return `https://www.linkedin.com/in/${c}`;
    case 'twitter': return `https://x.com/${c}`;
    case 'facebook': return `https://www.facebook.com/${c}`;
    case 'instagram': return `https://www.instagram.com/${c}`;
    case 'xing': return `https://www.xing.com/profile/${c}`;
    default: return `https://${c}`;
  }
};

const getCategoryColor = (category?: string) => {
  switch (category) {
    case "citizen": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "colleague": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "business": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "media": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "lobbyist": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    default: return "bg-muted text-muted-foreground";
  }
};

const categoryLabels: Record<string, string> = {
  citizen: 'Bürger', colleague: 'Kollege', business: 'Wirtschaft', media: 'Medien', lobbyist: 'Lobbyist',
};

interface InfoRowProps {
  icon: LucideIcon;
  label: string;
  value: string;
  actionHref?: string;
  actionLabel?: string;
  actionExternal?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon: Icon, label, value, actionHref, actionLabel, actionExternal = false }) => (
  <div className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium truncate">{value}</p>
    </div>
    {actionHref && (
      <Button size="sm" variant="outline" asChild>
        <a
          href={actionHref}
          target={actionExternal ? "_blank" : undefined}
          rel={actionExternal ? "noopener noreferrer" : undefined}
          aria-label={actionLabel ?? label}
          title={actionLabel ?? label}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </Button>
    )}
  </div>
);

export const ContactInfoTab: React.FC<ContactInfoTabProps> = React.memo(({ contact, allTags }) => {
  const contactInfoRows = [
    contact.email ? {
      icon: Mail, label: 'E-Mail', value: contact.email, actionHref: `mailto:${contact.email}`, actionLabel: 'E-Mail verfassen',
    } : null,
    contact.phone ? {
      icon: Phone, label: 'Telefon', value: contact.phone, actionHref: `tel:${contact.phone}`, actionLabel: 'Anrufen',
    } : null,
    contact.contact_type === "person" && contact.organization ? {
      icon: Building, label: 'Organisation', value: contact.organization,
    } : null,
    contact.birthday ? {
      icon: Calendar, label: 'Geburtstag', value: formatGermanDate(contact.birthday),
    } : null,
    contact.website ? {
      icon: Globe,
      label: 'Website',
      value: contact.website,
      actionHref: contact.website.startsWith('http') ? contact.website : `https://${contact.website}`,
      actionExternal: true,
      actionLabel: 'Website öffnen',
    } : null,
    contact.last_contact ? {
      icon: Calendar, label: 'Letzter Kontakt', value: contact.last_contact,
    } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const socialProfiles = [
    { key: 'linkedin', icon: <Linkedin className="h-4 w-4 text-blue-600" />, label: 'LinkedIn', value: contact.linkedin },
    { key: 'twitter', icon: <Hash className="h-4 w-4 text-foreground" />, label: 'X', value: contact.twitter },
    { key: 'facebook', icon: <Facebook className="h-4 w-4 text-blue-600" />, label: 'Facebook', value: contact.facebook },
    { key: 'instagram', icon: <Instagram className="h-4 w-4 text-pink-500" />, label: 'Instagram', value: contact.instagram },
    { key: 'xing', icon: <User className="h-4 w-4 text-green-600" />, label: 'XING', value: contact.xing },
  ].filter((social) => Boolean(social.value));

  return (
    <div className="space-y-4">
      {/* Classification */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3"><Tag className="h-4 w-4 text-primary" /><h3 className="font-semibold">Klassifizierung</h3></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Kategorie</p>
              <Badge className={getCategoryColor(contact.category ?? undefined)}>{categoryLabels[contact.category || ''] || 'Keine'}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Priorität</p>
              <Badge variant="outline" className={
                contact.priority === 'high' ? 'border-destructive text-destructive' :
                contact.priority === 'medium' ? 'border-yellow-500 text-yellow-600' : 'border-muted-foreground text-muted-foreground'
              }>
                {contact.priority === 'high' && '🔴 Hoch'}
                {contact.priority === 'medium' && '🟡 Mittel'}
                {contact.priority === 'low' && '🟢 Niedrig'}
                {!contact.priority && 'Keine'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2"><Phone className="h-4 w-4 text-primary" /><h3 className="font-semibold">Kontaktinformationen</h3></div>
          {contactInfoRows.length > 0 ? (
            contactInfoRows.map((row) => (
              <InfoRow
                key={`${row.label}-${row.value}`}
                icon={row.icon}
                label={row.label}
                value={row.value}
                actionHref={row.actionHref}
                actionExternal={row.actionExternal}
                actionLabel={row.actionLabel}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Keine Kontaktinformationen vorhanden.</p>
          )}
        </CardContent>
      </Card>

      {/* Address */}
      {(contact.business_street || contact.business_city || contact.address) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3"><MapPin className="h-4 w-4 text-primary" /><h3 className="font-semibold">Geschäftsadresse</h3></div>
            <div className="space-y-2 text-sm">
              {contact.business_street && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><p className="text-muted-foreground text-xs">Straße</p><p className="font-medium">{contact.business_street} {contact.business_house_number}</p></div>
                  <div><p className="text-muted-foreground text-xs">PLZ / Ort</p><p className="font-medium">{contact.business_postal_code} {contact.business_city}</p></div>
                </div>
              )}
              {contact.business_country && <div><p className="text-muted-foreground text-xs">Land</p><p className="font-medium">{contact.business_country}</p></div>}
              {!contact.business_street && contact.address && <p className="font-medium">{contact.address}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Social Media */}
      {socialProfiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Social Media</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {socialProfiles.map(social => (
                <div key={social.key} className="flex items-center gap-2.5 rounded-lg border bg-muted/20 px-2.5 py-2">
                  {social.icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none">{social.label}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1">@{cleanUsername(social.value!)}</p>
                  </div>
                  <Button size="icon" variant="ghost" asChild className="h-7 w-7 shrink-0">
                    <a
                      href={generateSocialMediaUrl(social.key, social.value!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${social.label} öffnen`}
                      title={`${social.label} öffnen`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      {(allTags.direct.length > 0 || allTags.inherited.length > 0) && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {allTags.inherited.map((tag) => (
                <Badge key={`inherited-${tag}`} variant="outline" className="bg-muted/30 text-muted-foreground border-dashed flex items-center gap-1 text-xs">
                  <Tag className="h-3 w-3" />{tag}<span className="text-[10px]">(geerbt)</span>
                </Badge>
              ))}
              {allTags.direct.map((tag) => (<Badge key={`direct-${tag}`} variant="secondary" className="text-xs">{tag}</Badge>))}
            </div>
          </CardContent>
        </Card>
      )}

      {contact.notes && (<Card><CardContent className="p-4"><h3 className="font-semibold mb-2">Notizen</h3><p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</p></CardContent></Card>)}
    </div>
  );
});

ContactInfoTab.displayName = 'ContactInfoTab';
