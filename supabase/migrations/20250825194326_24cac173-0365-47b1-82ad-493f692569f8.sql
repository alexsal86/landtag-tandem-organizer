-- Create new tenant for Erwin's office
INSERT INTO public.tenants (name, description) 
VALUES ('Büro Erwin', 'Demonstrationsbüro für Kollaborationstests');

-- Get tenant IDs
DO $$
DECLARE
    new_tenant_id uuid;
    old_tenant_id uuid;
    erwin_user_id uuid := '3453a1bc-054e-4e20-950a-c34ccafdffdc';
BEGIN
    -- Get the new tenant ID
    SELECT id INTO new_tenant_id FROM public.tenants WHERE name = 'Büro Erwin';
    SELECT id INTO old_tenant_id FROM public.tenants WHERE name = 'Standard Büro';
    
    -- Move Erwin to the new tenant
    UPDATE public.user_tenant_memberships 
    SET tenant_id = new_tenant_id
    WHERE user_id = erwin_user_id;
    
    -- Update Erwin's profile tenant_id
    UPDATE public.profiles 
    SET tenant_id = new_tenant_id
    WHERE user_id = erwin_user_id;
    
    -- Update Erwin's user_status tenant_id
    UPDATE public.user_status
    SET tenant_id = new_tenant_id
    WHERE user_id = erwin_user_id;
    
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