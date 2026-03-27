import React from 'react';
import { Mail, Phone, MapPin, Building, User, Calendar, Globe, ExternalLink, Tag, Linkedin, Facebook, Instagram, Hash, Euro } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatGermanDate } from '@/lib/utils';
import type { Contact } from '@/types/contact';

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

export const ContactInfoTab: React.FC<ContactInfoTabProps> = React.memo(({ contact, allTags }) => {
  return (
    <div className="space-y-4">
      {/* Classification */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3"><Tag className="h-4 w-4 text-primary" /><h3 className="font-semibold">Klassifizierung</h3></div>
          <div className="grid grid-cols-2 gap-3">
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
          {contact.email && (
            <div className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0"><p className="text-xs text-muted-foreground">E-Mail</p><p className="text-sm font-medium truncate">{contact.email}</p></div>
              <Button size="sm" variant="outline" asChild><a href={`mailto:${contact.email}`}><Mail className="h-3.5 w-3.5" /></a></Button>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0"><p className="text-xs text-muted-foreground">Telefon</p><p className="text-sm font-medium">{contact.phone}</p></div>
              <Button size="sm" variant="outline" asChild><a href={`tel:${contact.phone}`}><Phone className="h-3.5 w-3.5" /></a></Button>
            </div>
          )}
          {contact.contact_type === "person" && contact.organization && (
            <div className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
              <Building className="h-4 w-4 text-muted-foreground" />
              <div><p className="text-xs text-muted-foreground">Organisation</p><p className="text-sm font-medium">{contact.organization}</p></div>
            </div>
          )}
          {contact.birthday && (
            <div className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div><p className="text-xs text-muted-foreground">Geburtstag</p><p className="text-sm font-medium">{formatGermanDate(contact.birthday)}</p></div>
            </div>
          )}
          {contact.website && (
            <div className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0"><p className="text-xs text-muted-foreground">Website</p><p className="text-sm font-medium truncate">{contact.website}</p></div>
              <Button size="sm" variant="outline" asChild>
                <a href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
              </Button>
            </div>
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
                <div className="grid grid-cols-2 gap-2">
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
      {(contact.linkedin || contact.twitter || contact.facebook || contact.instagram || contact.xing) && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Social Media</h3>
            <div className="space-y-2">
              {[
                { key: 'linkedin', icon: <Linkedin className="h-4 w-4 text-blue-600" />, label: 'LinkedIn', value: contact.linkedin },
                { key: 'twitter', icon: <Hash className="h-4 w-4 text-foreground" />, label: 'X', value: contact.twitter },
                { key: 'facebook', icon: <Facebook className="h-4 w-4 text-blue-600" />, label: 'Facebook', value: contact.facebook },
                { key: 'instagram', icon: <Instagram className="h-4 w-4 text-pink-500" />, label: 'Instagram', value: contact.instagram },
                { key: 'xing', icon: <User className="h-4 w-4 text-green-600" />, label: 'XING', value: contact.xing },
              ].filter(s => s.value).map(social => (
                <div key={social.key} className="flex items-center gap-3">
                  {social.icon}
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium">{social.label}</p><p className="text-xs text-muted-foreground truncate">@{cleanUsername(social.value!)}</p></div>
                  <Button size="sm" variant="outline" asChild><a href={generateSocialMediaUrl(social.key, social.value!)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
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
      {contact.additional_info && (<Card><CardContent className="p-4"><h3 className="font-semibold mb-2">Zusätzliche Informationen</h3><p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.additional_info}</p></CardContent></Card>)}
      {contact.last_contact && (<Card><CardContent className="p-4"><h3 className="font-semibold mb-2">Letzter Kontakt</h3><p className="text-sm text-muted-foreground">{contact.last_contact}</p></CardContent></Card>)}
    </div>
  );
});

ContactInfoTab.displayName = 'ContactInfoTab';
