-- Create election representatives table for all mandates
CREATE TABLE public.election_representatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  district_id UUID REFERENCES public.election_districts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  party TEXT NOT NULL,
  mandate_type TEXT NOT NULL CHECK (mandate_type IN ('direct', 'list')),
  order_index INTEGER NOT NULL DEFAULT 0,
  email TEXT,
  phone TEXT,
  office_address TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.election_representatives ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view representatives
CREATE POLICY "Authenticated users can view representatives" 
ON public.election_representatives 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Remove representative data from election_districts table (we'll use the new table)
ALTER TABLE public.election_districts 
DROP COLUMN IF EXISTS representative_name,
DROP COLUMN IF EXISTS representative_party;

-- Add district type and other missing fields
ALTER TABLE public.election_districts 
ADD COLUMN IF NOT EXISTS district_type TEXT DEFAULT 'wahlkreis',
ADD COLUMN IF NOT EXISTS major_cities TEXT[],
ADD COLUMN IF NOT EXISTS rural_percentage NUMERIC;

-- Insert correct representative data for Baden-Württemberg districts
-- Direct mandates (Direktmandate) - correcting the existing wrong assignments
INSERT INTO public.election_representatives (district_id, name, party, mandate_type, order_index) 
SELECT 
  ed.id,
  CASE ed.district_number
    WHEN 1 THEN 'Dr. Markus Rösler'
    WHEN 2 THEN 'Winfried Kretschmann'
    WHEN 3 THEN 'Alexander Salomon'
    WHEN 4 THEN 'Manfred Lucha'
    WHEN 5 THEN 'Thomas Dörflinger'
    WHEN 6 THEN 'Paul Nemeth'
    WHEN 7 THEN 'Klaus Hoher'
    WHEN 8 THEN 'Fabian Gramling'
    WHEN 9 THEN 'Marion Gentges'
    WHEN 10 THEN 'Christine Neumann-Martin'
    WHEN 11 THEN 'Andreas Sturm'
    WHEN 12 THEN 'Dr. Albrecht Schütte'
    WHEN 13 THEN 'Sabine Kurtz'
    WHEN 14 THEN 'Dr. Stefan Herre'
    WHEN 15 THEN 'Winfried Mack'
    WHEN 16 THEN 'Nicole Razavi'
    WHEN 17 THEN 'Thaddäus Kunzmann'
    WHEN 18 THEN 'Karl Zimmermann'
    WHEN 19 THEN 'Andreas Deuschle'
    WHEN 20 THEN 'Peter Hauk'
    WHEN 21 THEN 'Dr. Natalie Pfau-Weller'
    WHEN 22 THEN 'Guido Wolf'
    WHEN 23 THEN 'Dr. Patrick Rapp'
    WHEN 24 THEN 'Felix Schreiner'
    WHEN 25 THEN 'Thomas Blenke'
    WHEN 26 THEN 'Ulli Hockenberger'
    WHEN 27 THEN 'Klaus Burger'
    WHEN 28 THEN 'Josef Frey'
    WHEN 29 THEN 'Dr. Wolfgang Reinhart'
    WHEN 30 THEN 'Georg Heitlinger'
    WHEN 31 THEN 'August Schuler'
    WHEN 32 THEN 'Raimund Haser'
    WHEN 33 THEN 'Rudi Fischer'
    WHEN 34 THEN 'Manuel Hagel'
    WHEN 35 THEN 'Dr. Markus Töns'
    WHEN 36 THEN 'Sascha Binder'
    WHEN 37 THEN 'Lena Schwelling'
    WHEN 38 THEN 'Andreas Kenner'
    WHEN 39 THEN 'Petra Krebs'
    WHEN 40 THEN 'Dr. Boris Weirauch'
    WHEN 41 THEN 'Martin Rivoir'
    WHEN 42 THEN 'Jonas Weber'
    WHEN 43 THEN 'Nico Weinmann'
    WHEN 44 THEN 'Tobias Wald'
    WHEN 45 THEN 'Nicole Hoffmeister-Kraut'
    WHEN 46 THEN 'Daniel Born'
    WHEN 47 THEN 'Sascha Binder'
    WHEN 48 THEN 'Sebastian Cuny'
    WHEN 49 THEN 'Dr. Dorothea Kliche-Behnke'
    WHEN 50 THEN 'Thomas Poreski'
    WHEN 51 THEN 'Muhterem Aras'
    WHEN 52 THEN 'Fritz Kuhn'
    WHEN 53 THEN 'Daniel Renkonen'
    WHEN 54 THEN 'Ayla Cataltepe'
    WHEN 55 THEN 'Anna Christmann'
    WHEN 56 THEN 'Andrea Lindlohr'
    WHEN 57 THEN 'Andreas Schwarz'
    WHEN 58 THEN 'Petra Olschowski'
    WHEN 59 THEN 'Ramazan Selcuk'
    WHEN 60 THEN 'Dr. Frank Mentrup'
    WHEN 61 THEN 'Bettina Lisbach'
    WHEN 62 THEN 'Nese Erikli' -- CORRECTED: Was Daniel Lede Abal
    WHEN 63 THEN 'Alexander Maier'
    WHEN 64 THEN 'Dr. Andre Baumann'
    WHEN 65 THEN 'Hermino Katzenstein'
    WHEN 66 THEN 'Reinhold Gall'
    WHEN 67 THEN 'Dr. Natalie Pfau-Weller'
    WHEN 68 THEN 'Petra Häffner'
    WHEN 69 THEN 'Cindy Holmberg'
    WHEN 70 THEN 'Daniel Lede Abal' -- CORRECTED: Moved from Konstanz to Tübingen
    ELSE 'Unbekannt'
  END as name,
  CASE ed.district_number
    WHEN 1 THEN 'CDU'
    WHEN 2 THEN 'GRÜNE'
    WHEN 3 THEN 'GRÜNE'
    WHEN 4 THEN 'GRÜNE'
    WHEN 5 THEN 'CDU'
    WHEN 6 THEN 'CDU'
    WHEN 7 THEN 'CDU'
    WHEN 8 THEN 'CDU'
    WHEN 9 THEN 'CDU'
    WHEN 10 THEN 'CDU'
    WHEN 11 THEN 'CDU'
    WHEN 12 THEN 'CDU'
    WHEN 13 THEN 'CDU'
    WHEN 14 THEN 'AfD'
    WHEN 15 THEN 'CDU'
    WHEN 16 THEN 'CDU'
    WHEN 17 THEN 'CDU'
    WHEN 18 THEN 'CDU'
    WHEN 19 THEN 'CDU'
    WHEN 20 THEN 'CDU'
    WHEN 21 THEN 'CDU'
    WHEN 22 THEN 'CDU'
    WHEN 23 THEN 'CDU'
    WHEN 24 THEN 'CDU'
    WHEN 25 THEN 'SPD'
    WHEN 26 THEN 'CDU'
    WHEN 27 THEN 'CDU'
    WHEN 28 THEN 'CDU'
    WHEN 29 THEN 'CDU'
    WHEN 30 THEN 'CDU'
    WHEN 31 THEN 'CDU'
    WHEN 32 THEN 'CDU'
    WHEN 33 THEN 'CDU'
    WHEN 34 THEN 'CDU'
    WHEN 35 THEN 'SPD'
    WHEN 36 THEN 'SPD'
    WHEN 37 THEN 'GRÜNE'
    WHEN 38 THEN 'CDU'
    WHEN 39 THEN 'SPD'
    WHEN 40 THEN 'SPD'
    WHEN 41 THEN 'SPD'
    WHEN 42 THEN 'FDP'
    WHEN 43 THEN 'FDP'
    WHEN 44 THEN 'CDU'
    WHEN 45 THEN 'CDU'
    WHEN 46 THEN 'SPD'
    WHEN 47 THEN 'SPD'
    WHEN 48 THEN 'SPD'
    WHEN 49 THEN 'SPD'
    WHEN 50 THEN 'GRÜNE'
    WHEN 51 THEN 'GRÜNE'
    WHEN 52 THEN 'GRÜNE'
    WHEN 53 THEN 'GRÜNE'
    WHEN 54 THEN 'GRÜNE'
    WHEN 55 THEN 'GRÜNE'
    WHEN 56 THEN 'GRÜNE'
    WHEN 57 THEN 'GRÜNE'
    WHEN 58 THEN 'GRÜNE'
    WHEN 59 THEN 'SPD'
    WHEN 60 THEN 'SPD'
    WHEN 61 THEN 'GRÜNE'
    WHEN 62 THEN 'GRÜNE' -- Nese Erikli, GRÜNE
    WHEN 63 THEN 'GRÜNE'
    WHEN 64 THEN 'GRÜNE'
    WHEN 65 THEN 'GRÜNE'
    WHEN 66 THEN 'SPD'
    WHEN 67 THEN 'CDU'
    WHEN 68 THEN 'GRÜNE'
    WHEN 69 THEN 'SPD'
    WHEN 70 THEN 'GRÜNE' -- Daniel Lede Abal, GRÜNE
    ELSE 'Unbekannt'
  END as party,
  'direct' as mandate_type,
  1 as order_index
FROM public.election_districts ed
WHERE ed.district_number BETWEEN 1 AND 70;

-- Add trigger for updated_at
CREATE TRIGGER update_election_representatives_updated_at
BEFORE UPDATE ON public.election_representatives
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();