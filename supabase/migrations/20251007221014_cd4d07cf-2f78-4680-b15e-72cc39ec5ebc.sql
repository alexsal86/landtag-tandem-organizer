-- Deaktiviere die Registrierung in der Login-Customization
UPDATE public.login_customization 
SET registration_enabled = false;