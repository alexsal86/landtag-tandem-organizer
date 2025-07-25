-- Function to insert sample contacts for a user
CREATE OR REPLACE FUNCTION public.insert_sample_contacts(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Insert sample contacts
  INSERT INTO public.contacts (
    user_id, name, role, organization, email, phone, location, 
    category, priority, last_contact, notes
  ) VALUES 
  (
    target_user_id,
    'Dr. Maria Schmidt',
    'Bürgerin',
    'Bürgerinitiative Verkehr',
    'm.schmidt@email.de',
    '+49 123 456789',
    'Hauptstadt',
    'citizen',
    'high',
    'vor 2 Tagen',
    'Aktive Bürgerin, die sich für Verkehrspolitik einsetzt'
  ),
  (
    target_user_id,
    'Thomas Weber',
    'MdL',
    'Fraktion ABC',
    't.weber@landtag.de',
    '+49 123 456790',
    NULL,
    'colleague',
    'medium',
    'vor 1 Woche',
    'Mitglied des Landtags, Fraktion ABC'
  ),
  (
    target_user_id,
    'Sarah Müller',
    'Geschäftsführerin',
    'Wirtschaftsverband XY',
    's.mueller@wirtschaft.de',
    '+49 123 456791',
    'München',
    'business',
    'medium',
    'vor 3 Tagen',
    'Wichtiger Kontakt im Wirtschaftssektor'
  ),
  (
    target_user_id,
    'Jan Hoffmann',
    'Redakteur',
    'Lokalzeitung',
    'j.hoffmann@zeitung.de',
    '+49 123 456792',
    NULL,
    'media',
    'low',
    'vor 1 Monat',
    'Journalist und Redakteur bei der Lokalzeitung'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;