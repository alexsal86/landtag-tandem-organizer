export interface ImportData {
  [key: string]: string;
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
}

export const FIELD_MAPPINGS: Record<string, string> = {
  Nachname: "last_name",
  Vorname: "first_name",
  Titel: "title",
  Firma: "organization",
  Abteilung: "department",
  Position: "position",
  "Geschäftlich: Straße": "business_street",
  "Geschäftlich: Hausnummer": "business_house_number",
  "Geschäftlich: Postleitzahl": "business_postal_code",
  "Geschäftlich: Ort": "business_city",
  "Geschäftlich: Land": "business_country",
  "Privat: Straße": "address",
  "Telefon geschäftlich": "business_phone",
  "Telefon (privat)": "phone",
  Mobiltelefon: "mobile_phone",
  "E-Mail 1": "email",
  "E-Mail 2": "email_2",
  "E-Mail 3": "email_3",
  "First Name": "first_name",
  "Last Name": "last_name",
  Company: "organization",
  Email: "email",
  Phone: "phone",
  Mobile: "mobile_phone",
  Address: "address",
  City: "location",
  Verteiler: "distribution_list_names",
  Verteilerliste: "distribution_list_names",
  Verteilerlisten: "distribution_list_names",
  "Distribution List": "distribution_list_names",
  "Distribution Lists": "distribution_list_names",
};

export const TARGET_FIELDS = [
  "first_name", "last_name", "title", "organization", "department", "position",
  "business_street", "business_house_number", "business_postal_code", "business_city", "business_country",
  "private_street", "private_house_number", "private_postal_code", "private_city", "private_country",
  "business_phone", "business_phone_2", "private_phone", "private_phone_2", "mobile_phone",
  "email", "email_2", "email_3", "phone", "address", "location", "notes",
  "distribution_list_names",
];
