-- Create new tenant for Erwin's office
INSERT INTO public.tenants (name, description) 
VALUES ('Büro Erwin', 'Demonstrationsbüro für Kollaborationstests');

-- Get the new tenant ID (we'll use it in the next part)
DO $$
DECLARE
    new_tenant_id uuid;
    erwin_user_id uuid := '3453a1bc-054e-4e20-950a-c34ccafdffdc';
BEGIN
    -- Get the new tenant ID
    SELECT id INTO new_tenant_id FROM public.tenants WHERE name = 'Büro Erwin';
    
    -- Move Erwin to the new tenant
    UPDATE public.user_tenant_memberships 
    SET tenant_id = new_tenant_id, role = 'abgeordneter'
    WHERE user_id = erwin_user_id;
    
    -- Update Erwin's profile tenant_id
    UPDATE public.profiles 
    SET tenant_id = new_tenant_id
    WHERE user_id = erwin_user_id;
    
    -- Create demo employees for Erwin's office
    -- Employee 1: Julia (Büroleiterin)
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
    VALUES (
        gen_random_uuid(),
        'julia.mueller@buero-erwin.de',
        crypt('Demo123!', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"display_name": "Julia Müller"}'::jsonb
    );
    
    -- Get Julia's ID and create profile + membership
    DECLARE julia_id uuid;
    BEGIN
        SELECT id INTO julia_id FROM auth.users WHERE email = 'julia.mueller@buero-erwin.de';
        
        INSERT INTO public.profiles (user_id, display_name, tenant_id)
        VALUES (julia_id, 'Julia Müller', new_tenant_id);
        
        INSERT INTO public.user_tenant_memberships (user_id, tenant_id, role)
        VALUES (julia_id, new_tenant_id, 'bueroleitung');
        
        INSERT INTO public.user_status (user_id, tenant_id)
        VALUES (julia_id, new_tenant_id);
    END;
    
    -- Employee 2: Thomas (Mitarbeiter)
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
    VALUES (
        gen_random_uuid(),
        'thomas.weber@buero-erwin.de',
        crypt('Demo123!', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"display_name": "Thomas Weber"}'::jsonb
    );
    
    DECLARE thomas_id uuid;
    BEGIN
        SELECT id INTO thomas_id FROM auth.users WHERE email = 'thomas.weber@buero-erwin.de';
        
        INSERT INTO public.profiles (user_id, display_name, tenant_id)
        VALUES (thomas_id, 'Thomas Weber', new_tenant_id);
        
        INSERT INTO public.user_tenant_memberships (user_id, tenant_id, role)
        VALUES (thomas_id, new_tenant_id, 'mitarbeiter');
        
        INSERT INTO public.user_status (user_id, tenant_id)
        VALUES (thomas_id, new_tenant_id);
    END;
    
    -- Employee 3: Sarah (Mitarbeiterin)
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
    VALUES (
        gen_random_uuid(),
        'sarah.klein@buero-erwin.de',
        crypt('Demo123!', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"display_name": "Sarah Klein"}'::jsonb
    );
    
    DECLARE sarah_id uuid;
    BEGIN
        SELECT id INTO sarah_id FROM auth.users WHERE email = 'sarah.klein@buero-erwin.de';
        
        INSERT INTO public.profiles (user_id, display_name, tenant_id)
        VALUES (sarah_id, 'Sarah Klein', new_tenant_id);
        
        INSERT INTO public.user_tenant_memberships (user_id, tenant_id, role)
        VALUES (sarah_id, new_tenant_id, 'mitarbeiter');
        
        INSERT INTO public.user_status (user_id, tenant_id)
        VALUES (sarah_id, new_tenant_id);
    END;
    
    -- Employee 4: Michael (Praktikant)
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
    VALUES (
        gen_random_uuid(),
        'michael.schmidt@buero-erwin.de',
        crypt('Demo123!', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"display_name": "Michael Schmidt"}'::jsonb
    );
    
    DECLARE michael_id uuid;
    BEGIN
        SELECT id INTO michael_id FROM auth.users WHERE email = 'michael.schmidt@buero-erwin.de';
        
        INSERT INTO public.profiles (user_id, display_name, tenant_id)
        VALUES (michael_id, 'Michael Schmidt', new_tenant_id);
        
        INSERT INTO public.user_tenant_memberships (user_id, tenant_id, role)
        VALUES (michael_id, new_tenant_id, 'praktikant');
        
        INSERT INTO public.user_status (user_id, tenant_id)
        VALUES (michael_id, new_tenant_id);
    END;
    
    -- Create default team dashboard for the new tenant
    INSERT INTO public.team_dashboards (owner_id, tenant_id, name, description, layout_data)
    VALUES (
        erwin_user_id, 
        new_tenant_id, 
        'Standard Dashboard', 
        'Standard Dashboard für Büro Erwin',
        '[{"i":"tasks","x":0,"y":0,"w":6,"h":4,"component":"TasksWidget"},{"i":"calendar","x":6,"y":0,"w":6,"h":4,"component":"CalendarWidget"},{"i":"messages","x":0,"y":4,"w":12,"h":3,"component":"MessagesWidget"}]'::jsonb
    );
END $$;