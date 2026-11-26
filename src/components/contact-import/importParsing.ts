import Papa from "papaparse";
import VCF from "vcf";
import { isValidEmail } from "@/lib/utils";
import { FIELD_MAPPINGS, type FieldMapping, type ImportData } from "./types";
import { parseDistributionListNames } from "./distributionListNames";

/**
 * Reine Regeln der Importstrecke: CSV-/VCF-Quelltext einlesen, Spalten
 * automatisch zuordnen, eine Zeile in Kontaktwerte übersetzen und prüfen.
 * Der Upload-Hook und der Selbsttest nutzen dieselben Funktionen, damit der
 * Test nicht an einer zweiten Implementierung vorbeiprüft.
 */

export function toImportValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  return "";
}

/** Ordnet die Spaltenüberschriften anhand von FIELD_MAPPINGS zu. */
export function autoMapFields(sourceFields: string[]): FieldMapping[] {
  return sourceFields.map((sourceField) => ({
    sourceField,
    targetField: FIELD_MAPPINGS[sourceField] || "",
  }));
}

/** Liest CSV-Text ein; Trennzeichen erkennt Papa selbst (z. B. , oder ;). */
export function parseCsvSource(text: string): ImportData[] {
  const result = Papa.parse<ImportData>(text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: true,
  });
  return result.data;
}

/** vCard-Eigenschaft, wie `vcf` sie im Feld `data` ablegt. */
interface VcfProperty {
  valueOf(): unknown;
  type?: string | string[];
}

interface VcfCard {
  data?: Record<string, VcfProperty | VcfProperty[]>;
}

function propertyTypes(property: VcfProperty): string[] {
  if (Array.isArray(property.type)) return property.type.map(String);
  return property.type ? [String(property.type)] : [];
}

function propertiesOf(card: VcfCard, name: string): VcfProperty[] {
  const value = card.data?.[name];
  return Array.isArray(value) ? value : value ? [value] : [];
}

function textOf(property: VcfProperty): string {
  return toImportValue(property.valueOf());
}

/** vCard-Werte sind Semikolon-getrennt, z. B. "Mustermann;Max;;;" bei N. */
function segments(value: string): string[] {
  return value.split(";").map((segment) => segment.trim());
}

function vCardToImportData(card: VcfCard): ImportData {
  const data: ImportData = {};

  const formattedName = propertiesOf(card, "fn")[0];
  if (formattedName) data.Name = textOf(formattedName);

  const structuredName = propertiesOf(card, "n")[0];
  if (structuredName) {
    const [lastName, firstName] = segments(textOf(structuredName));
    if (lastName) data.Nachname = lastName;
    if (firstName) data.Vorname = firstName;
  }

  const organization = propertiesOf(card, "org")[0];
  if (organization) {
    const [company] = segments(textOf(organization));
    if (company) data.Firma = company;
  }

  const title = propertiesOf(card, "title")[0];
  if (title) data.Position = textOf(title);

  propertiesOf(card, "email").forEach((property, index) => {
    const value = textOf(property);
    if (index === 0) data["E-Mail 1"] = value;
    else if (index === 1) data["E-Mail 2"] = value;
    else if (index === 2) data["E-Mail 3"] = value;
  });

  let businessCount = 0;
  let privateCount = 0;
  propertiesOf(card, "tel").forEach((property) => {
    const value = textOf(property);
    const types = propertyTypes(property).map((type) => type.toLowerCase());
    if (types.some((type) => type.includes("cell") || type.includes("mobile"))) {
      data.Mobiltelefon = value;
    } else if (types.some((type) => type.includes("work"))) {
      if (businessCount === 0) { data["Telefon geschäftlich"] = value; businessCount++; }
      else data["Telefon geschäftlich 2"] = value;
    } else if (types.some((type) => type.includes("home"))) {
      if (privateCount === 0) { data["Telefon (privat)"] = value; privateCount++; }
      else data["Telefon (privat 2)"] = value;
    } else if (!data.Mobiltelefon) {
      data.Mobiltelefon = value;
    }
  });

  propertiesOf(card, "adr").forEach((property) => {
    const parts = segments(textOf(property));
    if (parts.length < 7) return;
    const [, , street, city, , postalCode, country] = parts;
    const isWork = propertyTypes(property).some((type) => type.toLowerCase().includes("work"));
    if (isWork) {
      if (street) data["Geschäftlich: Straße"] = street;
      if (city) data["Geschäftlich: Ort"] = city;
      if (postalCode) data["Geschäftlich: Postleitzahl"] = postalCode;
      if (country) data["Geschäftlich: Land"] = country;
    } else {
      if (street) data["Privat: Straße"] = street;
      if (city) data["Privat: Ort"] = city;
      if (postalCode) data["Privat: Postleitzahl"] = postalCode;
      if (country) data["Privat: Land"] = country;
    }
  });

  const website = propertiesOf(card, "url")[0];
  if (website) data.Website = textOf(website);
  const note = propertiesOf(card, "note")[0];
  if (note) data.Notizen = textOf(note);

  return data;
}

/**
 * Liest VCF-Text ein und übersetzt jede vCard in Importspalten. `vcf` liefert
 * Kartenobjekte mit einem Feld `data`; die Zeilenenden werden vorher auf CRLF
 * normalisiert, weil reine LF-Dateien sonst nicht eingelesen werden.
 */
export function parseVCardSource(text: string): ImportData[] {
  const normalized = text.replace(/\r\n|\r|\n/g, "\r\n").trimEnd() + "\r\n";
  const cards = VCF.parse(normalized) as unknown as VcfCard[];
  return cards.map(vCardToImportData);
}

/** Überträgt nur zugeordnete, nicht leere Zellen in die Kontaktspalten. */
export function mappedValues(row: ImportData, mappings: FieldMapping[]): Record<string, string> {
  const values: Record<string, string> = {};
  mappings
    .filter((mapping) => mapping.targetField)
    .forEach((mapping) => {
      const value = row[mapping.sourceField];
      if (value && value.trim()) values[mapping.targetField] = value.trim();
    });
  return values;
}

/** Setzt den Anzeigenamen aus Vor- und Nachname, sofern er fehlt. */
export function withContactName(values: Record<string, string>): Record<string, string> {
  if ((values.first_name || values.last_name) && !values.name) {
    values.name = `${values.first_name || ""} ${values.last_name || ""}`.trim();
  }
  return values;
}

/** Prüft die Zeilenregeln des Imports; gibt null zurück, wenn die Zeile gültig ist. */
export function validateImportValues(values: Record<string, string>): string | null {
  if (!values.name?.trim()) return "Kein Name angegeben";
  if (values.email && !isValidEmail(values.email)) {
    return `Ungültige E-Mail-Adresse (${values.email})`;
  }
  return null;
}

export interface ImportRowResult {
  values: Record<string, string>;
  distributionListNames: string[];
  error: string | null;
}

/** Eine Importzeile als Kontaktwerte samt Verteilerlisten und Prüfergebnis. */
export function buildImportRow(row: ImportData, mappings: FieldMapping[]): ImportRowResult {
  const values = withContactName(mappedValues(row, mappings));
  const distributionListNames = parseDistributionListNames(values.distribution_list_names);
  delete values.distribution_list_names;
  return { values, distributionListNames, error: validateImportValues(values) };
}
