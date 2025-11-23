-- Korrektur der Stundenberechnung für 39,5h/Woche
-- 39,5h / 5 Tage = 7,9h pro Tag
-- 7,9h * 20 Arbeitstage = 158h (nicht 160h)

UPDATE employee_settings 
SET hours_per_month = 158 
WHERE hours_per_month = 160 
  AND days_per_month = 20;