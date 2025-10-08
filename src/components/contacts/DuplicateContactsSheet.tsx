import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Merge, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { findDuplicates } from '@/utils/duplicateDetection';
import { MergeContactsDialog } from './MergeContactsDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  contact_type?: string;
  avatar_url?: string;
  [key: string]: any;
}

interface DuplicateMatch {
  contact1: Contact;
  contact2: Contact;
  matchScore: number;
  matchReasons: string[];
}

interface DuplicateContactsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onDuplicatesResolved: () => void;
}

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const getScoreColor = (score: number) => {
  if (score >= 90) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  if (score >= 75) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
  return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
};

export function DuplicateContactsSheet({
  isOpen,
  onClose,
  onDuplicatesResolved,
}: DuplicateContactsSheetProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<DuplicateMatch | null>(null);
  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  useEffect(() => {
    if (isOpen && currentTenant) {
      fetchContactsAndFindDuplicates();
    }
  }, [isOpen, currentTenant]);

  const fetchContactsAndFindDuplicates = async () => {
    if (!currentTenant) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;

      setContacts(data || []);
      const foundDuplicates = findDuplicates(data || []);
      setDuplicates(foundDuplicates);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissPair = (match: DuplicateMatch) => {
    const pairKey = [match.contact1.id, match.contact2.id].sort().join('-');
    setDismissedPairs(prev => new Set([...prev, pairKey]));
  };

  const handleMergeComplete = () => {
    setSelectedMatch(null);
    fetchContactsAndFindDuplicates();
    onDuplicatesResolved();
  };

  const visibleDuplicates = duplicates.filter(match => {
    const pairKey = [match.contact1.id, match.contact2.id].sort().join('-');
    return !dismissedPairs.has(pairKey);
  });

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-[700px] sm:w-[640px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Duplikat-Prüfung</SheetTitle>
            <SheetDescription>
              Mögliche Duplikate basierend auf Name, E-Mail und Telefonnummer
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : visibleDuplicates.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Keine Duplikate gefunden</AlertTitle>
                <AlertDescription>
                  {dismissedPairs.size > 0
                    ? 'Alle gefundenen Duplikate wurden ignoriert oder zusammengeführt.'
                    : 'Es wurden keine potenziellen Duplikate gefunden.'}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{visibleDuplicates.length} potenzielle Duplikate gefunden</AlertTitle>
                  <AlertDescription>
                    Überprüfen Sie die folgenden Kontakte und führen Sie sie zusammen oder ignorieren Sie sie.
                  </AlertDescription>
                </Alert>

                {visibleDuplicates.map((match, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <Badge className={getScoreColor(match.matchScore)}>
                          {Math.round(match.matchScore)}% Übereinstimmung
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDismissPair(match)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {/* Contact 1 */}
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={match.contact1.avatar_url} />
                            <AvatarFallback>{getInitials(match.contact1.name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{match.contact1.name}</p>
                            <div className="text-sm text-muted-foreground space-y-1">
                              {match.contact1.email && <p>{match.contact1.email}</p>}
                              {match.contact1.phone && <p>{match.contact1.phone}</p>}
                              {match.contact1.organization && (
                                <p className="truncate">{match.contact1.organization}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Contact 2 */}
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={match.contact2.avatar_url} />
                            <AvatarFallback>{getInitials(match.contact2.name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{match.contact2.name}</p>
                            <div className="text-sm text-muted-foreground space-y-1">
                              {match.contact2.email && <p>{match.contact2.email}</p>}
                              {match.contact2.phone && <p>{match.contact2.phone}</p>}
                              {match.contact2.organization && (
                                <p className="truncate">{match.contact2.organization}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Match Reasons */}
                        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                          <p className="text-sm font-medium mb-2">Übereinstimmungen:</p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {match.matchReasons.map((reason, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <Button
                          onClick={() => setSelectedMatch(match)}
                          className="w-full"
                        >
                          <Merge className="h-4 w-4 mr-2" />
                          Zusammenführen
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {selectedMatch && (
        <MergeContactsDialog
          contact1={selectedMatch.contact1}
          contact2={selectedMatch.contact2}
          isOpen={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onMergeComplete={handleMergeComplete}
        />
      )}
    </>
  );
}
