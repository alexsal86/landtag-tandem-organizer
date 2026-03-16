-- Remove all calendar appointments scheduled for 25.03.2026 (Europe/Berlin local date)
DELETE FROM public.appointments
WHERE (start_time AT TIME ZONE 'Europe/Berlin')::date = DATE '2026-03-25';
