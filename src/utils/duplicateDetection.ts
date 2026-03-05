/**
 * Utility functions for detecting duplicate contacts
 */

export interface Contact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
  organization_id?: string | null;
  contact_type?: string;
}

export interface DuplicateMatch {
  contact: Contact;
  score: number;
  reasons: string[];
}

export interface DuplicatePair {
  contact1: Contact;
  contact2: Contact;
  matchScore: number;
  matchReasons: string[];
}

interface CandidatePairMeta {
  index1: number;
  index2: number;
  minBucketSize: number;
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
          matrix[i - 1][j] + 1,
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
  return phone.replace(/[\s()-]/g, "");
}

function normalizeEmail(email?: string | null): string {
  return email?.toLowerCase().trim() ?? "";
}

function normalizeName(name?: string | null): string {
  return name?.toLowerCase().trim().replace(/\s+/g, " ") ?? "";
}

function getNamePrefix(name: string, length = 3): string {
  return normalizeName(name).replace(/[^a-z0-9]/g, "").slice(0, length);
}

function collectPairCandidates(contacts: Contact[]): CandidatePairMeta[] {
  const bucketMap = new Map<string, number[]>();
  const addToBucket = (key: string, index: number) => {
    if (!bucketMap.has(key)) {
      bucketMap.set(key, [index]);
      return;
    }

    bucketMap.get(key)?.push(index);
  };

  contacts.forEach((contact, index) => {
    const email = normalizeEmail(contact.email);
    if (email) addToBucket(`email:${email}`, index);

    const phone = contact.phone ? normalizePhone(contact.phone) : "";
    if (phone.length > 5) addToBucket(`phone:${phone}`, index);

    const namePrefix = getNamePrefix(contact.name);
    if (namePrefix.length >= 2) addToBucket(`name:${namePrefix}`, index);
  });

  const pairCandidates = new Map<string, CandidatePairMeta>();

  bucketMap.forEach((indices) => {
    if (indices.length < 2) return;

    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const index1 = Math.min(indices[i], indices[j]);
        const index2 = Math.max(indices[i], indices[j]);
        const key = `${index1}-${index2}`;
        const existing = pairCandidates.get(key);

        if (!existing) {
          pairCandidates.set(key, {
            index1,
            index2,
            minBucketSize: indices.length,
          });
          continue;
        }

        existing.minBucketSize = Math.min(existing.minBucketSize, indices.length);
      }
    }
  });

  return Array.from(pairCandidates.values());
}

function evaluatePair(
  contact1: Contact,
  contact2: Contact,
  options: { allowLevenshtein: boolean },
): DuplicatePair | null {
  const matchReasons: string[] = [];
  let matchScore = 0;

  // Exact email match (very strong indicator)
  if (contact1.email && contact2.email) {
    const email1 = normalizeEmail(contact1.email);
    const email2 = normalizeEmail(contact2.email);

    if (email1 === email2) {
      matchScore += 80;
      matchReasons.push("Identische E-Mail-Adresse");
    }
  }

  // Exact phone match (strong indicator)
  if (contact1.phone && contact2.phone) {
    const phone1 = normalizePhone(contact1.phone);
    const phone2 = normalizePhone(contact2.phone);

    if (phone1 === phone2 && phone1.length > 5) {
      matchScore += 70;
      matchReasons.push("Identische Telefonnummer");
    }
  }

  let nameSimilarity = 0;
  if (options.allowLevenshtein) {
    nameSimilarity = stringSimilarity(contact1.name, contact2.name);
    if (nameSimilarity > 0.8) {
      matchScore += nameSimilarity * 50;
      matchReasons.push(
        `Ähnlicher Name (${Math.round(nameSimilarity * 100)}% Übereinstimmung)`,
      );
    }
  } else if (normalizeName(contact1.name) === normalizeName(contact2.name)) {
    matchScore += 45;
    nameSimilarity = 1;
    matchReasons.push("Identischer Name");
  }

  // Organization match (if both are persons)
  if (
    contact1.contact_type === "person" &&
    contact2.contact_type === "person" &&
    contact1.organization &&
    contact2.organization
  ) {
    const orgSimilarity = options.allowLevenshtein
      ? stringSimilarity(contact1.organization, contact2.organization)
      : normalizeName(contact1.organization) === normalizeName(contact2.organization)
        ? 1
        : 0;

    if (orgSimilarity > 0.85 && nameSimilarity > 0.6) {
      matchScore += 30;
      matchReasons.push(`Gleiche Organisation (${contact1.organization})`);
    }
  }

  if (matchScore < 70 || matchReasons.length === 0) return null;

  return {
    contact1,
    contact2,
    matchScore: Math.min(matchScore, 100),
    matchReasons,
  };
}

async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(() => resolve(), 0);
  });
}

/**
 * Detect potential duplicate contacts - returns pairs of duplicates
 */
export function findDuplicates(contacts: Contact[]): DuplicatePair[] {
  const pairCandidates = collectPairCandidates(contacts);
  const duplicates: DuplicatePair[] = [];

  for (const pair of pairCandidates) {
    const result = evaluatePair(contacts[pair.index1], contacts[pair.index2], {
      allowLevenshtein: pair.minBucketSize <= 60,
    });
    if (result) duplicates.push(result);
  }

  return duplicates.sort((a, b) => b.matchScore - a.matchScore);
}

export async function findDuplicatesProgressive(
  contacts: Contact[],
  options?: {
    chunkSize?: number;
    onProgress?: (processedPairs: number, totalPairs: number) => void;
  },
): Promise<DuplicatePair[]> {
  const chunkSize = options?.chunkSize ?? 250;
  const pairCandidates = collectPairCandidates(contacts);
  const duplicates: DuplicatePair[] = [];

  for (let index = 0; index < pairCandidates.length; index += chunkSize) {
    const chunk = pairCandidates.slice(index, index + chunkSize);

    for (const pair of chunk) {
      const result = evaluatePair(contacts[pair.index1], contacts[pair.index2], {
        allowLevenshtein: pair.minBucketSize <= 60,
      });
      if (result) duplicates.push(result);
    }

    options?.onProgress?.(
      Math.min(index + chunk.length, pairCandidates.length),
      pairCandidates.length,
    );

    if (index + chunkSize < pairCandidates.length) {
      await yieldToBrowser();
    }
  }

  return duplicates.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Find duplicates for a specific contact (used during import)
 */
export function findPotentialDuplicates(
  newContact: Contact,
  existingContacts: Contact[],
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const existing of existingContacts) {
    const matchReasons: string[] = [];
    let matchScore = 0;

    // Exact email match (very strong indicator)
    if (newContact.email && existing.email) {
      const email1 = newContact.email.toLowerCase().trim();
      const email2 = existing.email.toLowerCase().trim();

      if (email1 === email2) {
        matchScore += 0.8;
        matchReasons.push("Identische E-Mail-Adresse");
      }
    }

    // Exact phone match (strong indicator)
    if (newContact.phone && existing.phone) {
      const phone1 = normalizePhone(newContact.phone);
      const phone2 = normalizePhone(existing.phone);

      if (phone1 === phone2 && phone1.length > 5) {
        matchScore += 0.7;
        matchReasons.push("Identische Telefonnummer");
      }
    }

    // Name similarity
    const nameSimilarity = stringSimilarity(newContact.name, existing.name);
    if (nameSimilarity > 0.8) {
      matchScore += nameSimilarity * 0.5;
      matchReasons.push(
        `Ähnlicher Name (${Math.round(nameSimilarity * 100)}%)`,
      );
    }

    // Organization ID match (preferred over free text)
    if (
      newContact.organization_id &&
      existing.organization_id &&
      newContact.organization_id === existing.organization_id &&
      nameSimilarity > 0.6
    ) {
      matchScore += 0.4;
      matchReasons.push("Gleiche Organisation (ID)");
    }

    // Organization match (legacy text fallback)
    if (newContact.organization && existing.organization) {
      const orgSimilarity = stringSimilarity(
        newContact.organization,
        existing.organization,
      );
      if (orgSimilarity > 0.85 && nameSimilarity > 0.6) {
        matchScore += 0.3;
        matchReasons.push(`Gleiche Organisation`);
      }
    }

    // If match score is high enough, add to matches
    if (matchScore >= 0.7 && matchReasons.length > 0) {
      matches.push({
        contact: existing,
        score: Math.min(matchScore, 1),
        reasons: matchReasons,
      });
    }
  }

  // Sort by score (highest first)
  return matches.sort((a, b) => b.score - a.score);
}
