-- Spalten zu annual_tasks hinzufügen
ALTER TABLE annual_tasks ADD COLUMN IF NOT EXISTS auto_execute BOOLEAN DEFAULT false;
ALTER TABLE annual_tasks ADD COLUMN IF NOT EXISTS execute_function TEXT;

-- Bestehende System-Aufgaben mit Funktionen verknüpfen
UPDATE annual_tasks SET execute_function = 'execute_reset_vacation_days' 
WHERE title = 'Urlaubstage zurücksetzen' AND execute_function IS NULL;

UPDATE annual_tasks SET execute_function = 'execute_archive_sick_days' 
WHERE title = 'Krankentage-Statistik archivieren' AND execute_function IS NULL;

UPDATE annual_tasks SET execute_function = 'execute_expire_carry_over' 
WHERE title = 'Resturlaub verfällt' AND execute_function IS NULL;