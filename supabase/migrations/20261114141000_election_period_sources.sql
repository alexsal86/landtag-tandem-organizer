-- Official election dates only; never infer a mandate start from election day.
-- Reviewed 2026-11-14, Bundeswahlleiterin / Landtagswahlen Baden-Württemberg.
-- Existing history records are changed only by explicit superadmin RPC, not this seed.
INSERT INTO public.election_analysis_period_proposals(period_number,election_year,election_date,election_source_url,term_source_url,verified,notes) VALUES
(1,1952,'1952-03-09','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(2,1956,'1956-03-04','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(3,1960,'1960-05-15','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden. Wiederholungswahl am 12.03.1961 ist kein Beginn einer neuen Legislaturperiode.'),
(4,1964,'1964-04-26','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(5,1968,'1968-04-28','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(6,1972,'1972-04-23','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(7,1976,'1976-04-04','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(8,1980,'1980-03-16','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(9,1984,'1984-03-25','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(10,1988,'1988-03-20','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(11,1992,'1992-04-05','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(12,1996,'1996-03-24','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(13,2001,'2001-03-25','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(14,2006,'2006-03-26','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(15,2011,'2011-03-27','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(16,2016,'2016-03-13','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(17,2021,'2021-03-14','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.'),
(18,2026,'2026-03-08','https://www.bundeswahlleiterin.de/service/landtagswahlen/land-8.html','',true,'Nur Wahltag verifiziert. Beginn/Ende müssen gesondert anhand amtlicher Periodenquellen geprüft werden.')
ON CONFLICT(period_number) DO NOTHING;
