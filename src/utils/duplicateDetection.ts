/**
 * Utility functions for detecting duplicate contacts
 */

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  contact_type?: string;
}

interface DuplicateMatch {
  contact1: Contact;
  contact2: Contact;
  matchScore: number;
  matchReasons: string[];
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function stringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const maxLength = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  
  return 1 - distance / maxLength;
}

/**
 * Normalize phone number for comparison
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '');
}

/**
 * Detect potential duplicate contacts
 */
export function findDuplicates(contacts: Contact[]): DuplicateMatch[] {
  const duplicates: DuplicateMatch[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < contacts.length; i++) {
    for (let j = i + 1; j < contacts.length; j++) {
      const contact1 = contacts[i];
      const contact2 = contacts[j];
      
      const pairKey = [contact1.id, contact2.id].sort().join('-');
      if (processed.has(pairKey)) continue;
      
      const matchReasons: string[] = [];
      let matchScore = 0;

      // Exact email match (very strong indicator)
      if (contact1.email && contact2.email) {
        const email1 = contact1.email.toLowerCase().trim();
        const email2 = contact2.email.toLowerCase().trim();
        
        if (email1 === email2) {
          matchScore += 80;
          matchReasons.push('Identische E-Mail-Adresse');
        }
      }

      // Exact phone match (strong indicator)
      if (contact1.phone && contact2.phone) {
        const phone1 = normalizePhone(contact1.phone);
        const phone2 = normalizePhone(contact2.phone);
        
        if (phone1 === phone2 && phone1.length > 5) {
          matchScore += 70;
          matchReasons.push('Identische Telefonnummer');
        }
      }

      // Name similarity
      const nameSimilarity = stringSimilarity(contact1.name, contact2.name);
      if (nameSimilarity > 0.8) {
        matchScore += nameSimilarity * 50;
        matchReasons.push(`Ähnlicher Name (${Math.round(nameSimilarity * 100)}% Übereinstimmung)`);
      }

      // Organization match (if both are persons)
      if (
        contact1.contact_type === 'person' && 
        contact2.contact_type === 'person' &&
        contact1.organization && 
        contact2.organization
      ) {
        const orgSimilarity = stringSimilarity(contact1.organization, contact2.organization);
        if (orgSimilarity > 0.85 && nameSimilarity > 0.6) {
          matchScore += 30;
          matchReasons.push(`Gleiche Organisation (${contact1.organization})`);
        }
      }

      // If match score is high enough, add to duplicates
      if (matchScore >= 70 && matchReasons.length > 0) {
        duplicates.push({
          contact1,
          contact2,
          matchScore: Math.min(matchScore, 100),
          matchReasons,
        });
        
        processed.add(pairKey);
      }
    }
  }

  // Sort by match score (highest first)
  return duplicates.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Find duplicates for a specific contact (used during import)
 */
export function findPotentialDuplicates(
  newContact: Contact,
  existingContacts: Contact[]
): DuplicateMatch[] {
  return findDuplicates([newContact, ...existingContacts])
    .filter(match => 
      match.contact1.id === newContact.id || match.contact2.id === newContact.id
    );
}
