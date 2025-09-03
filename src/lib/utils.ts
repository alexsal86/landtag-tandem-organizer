import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Email validation utility for German email format
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // German email format: xy@z.de (allowing more flexible patterns while maintaining basic structure)
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

// Contact duplicate detection utilities
export interface Contact {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
}

export interface DuplicateMatch {
  contact: Contact;
  matchType: 'email' | 'name_phone' | 'name_organization';
  confidence: 'high' | 'medium';
}

export function findPotentialDuplicates(
  newContact: Omit<Contact, 'id'>, 
  existingContacts: Contact[]
): DuplicateMatch[] {
  const duplicates: DuplicateMatch[] = [];
  
  // Normalize strings for comparison
  const normalize = (str?: string) => str?.toLowerCase().trim() || '';
  
  const newContactNormalized = {
    name: normalize(newContact.name),
    email: normalize(newContact.email),
    phone: normalize(newContact.phone),
    organization: normalize(newContact.organization),
  };
  
  for (const existing of existingContacts) {
    const existingNormalized = {
      name: normalize(existing.name),
      email: normalize(existing.email),
      phone: normalize(existing.phone),
      organization: normalize(existing.organization),
    };
    
    // High confidence: Exact email match
    if (newContactNormalized.email && 
        existingNormalized.email &&
        newContactNormalized.email === existingNormalized.email) {
      duplicates.push({
        contact: existing,
        matchType: 'email',
        confidence: 'high'
      });
      continue; // Skip other checks for this contact
    }
    
    // Medium confidence: Same name + same phone
    if (newContactNormalized.name && 
        existingNormalized.name &&
        newContactNormalized.phone &&
        existingNormalized.phone &&
        newContactNormalized.name === existingNormalized.name &&
        newContactNormalized.phone === existingNormalized.phone) {
      duplicates.push({
        contact: existing,
        matchType: 'name_phone',
        confidence: 'medium'
      });
      continue;
    }
    
    // Medium confidence: Same name + same organization
    if (newContactNormalized.name && 
        existingNormalized.name &&
        newContactNormalized.organization &&
        existingNormalized.organization &&
        newContactNormalized.name === existingNormalized.name &&
        newContactNormalized.organization === existingNormalized.organization) {
      duplicates.push({
        contact: existing,
        matchType: 'name_organization',
        confidence: 'medium'
      });
    }
  }
  
  return duplicates;
}

export function getDuplicateMessage(duplicate: DuplicateMatch): string {
  switch (duplicate.matchType) {
    case 'email':
      return `Gleiche E-Mail-Adresse: ${duplicate.contact.email}`;
    case 'name_phone':
      return `Gleicher Name und Telefonnummer: ${duplicate.contact.name}`;
    case 'name_organization':
      return `Gleicher Name und Organisation: ${duplicate.contact.name}`;
    default:
      return 'Mögliches Duplikat gefunden';
  }
}
