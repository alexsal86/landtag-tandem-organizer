import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPERADMIN_EMAIL = 'mail@alexander-salomon.de';

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 14; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Authentication failed');
    }

    const isSuperadmin = user.email === SUPERADMIN_EMAIL;
    console.log(`User ${user.email} is superadmin: ${isSuperadmin}`);

    // Get caller's tenant and role for permission checks
    const { data: callerMembership } = await supabaseAdmin
      .from('user_tenant_memberships')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const isAbgeordneter = callerMembership?.role === 'abgeordneter';

    const body = await req.json();
    const { action } = body;
    console.log(`Action requested: ${action}`);

    switch (action) {
      case 'listAllUsers': {
        // Superadmin only
        if (!isSuperadmin) {
          throw new Error('Only superadmin can list all users');
        }

        // Get all users from auth
        const { data: authUsers, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
        if (usersError) throw usersError;

        // Get all profiles
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('user_id, display_name, avatar_url');

        // Get all memberships with tenant info
        const { data: memberships } = await supabaseAdmin
          .from('user_tenant_memberships')
          .select(`
            user_id,
            tenant_id,
            role,
            is_active,
            tenants:tenant_id (id, name)
          `)
          .eq('is_active', true);

        // Build user list with tenant info
        const users = authUsers.users.map(authUser => {
          const profile = profiles?.find(p => p.user_id === authUser.id);
          const userMemberships = memberships?.filter(m => m.user_id === authUser.id) || [];
          
          return {
            id: authUser.id,
            email: authUser.email,
            display_name: profile?.display_name || authUser.user_metadata?.display_name || 'Unbekannt',
            avatar_url: profile?.avatar_url,
            created_at: authUser.created_at,
            tenants: userMemberships.map(m => ({
              id: m.tenant_id,
              name: (m.tenants as any)?.name || 'Unbekannt',
              role: m.role
            }))
          };
        });

        console.log(`Found ${users.length} users`);
        return new Response(JSON.stringify({ success: true, users }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'createUser': {
        // Superadmin only
        if (!isSuperadmin) {
          throw new Error('Only superadmin can create users');
        }

        const { email, displayName, role, tenantId } = body;
        if (!email || !displayName || !tenantId) {
          throw new Error('Email, displayName, and tenantId are required');
        }

        const password = generatePassword();
        console.log(`Creating user: ${email} for tenant: ${tenantId}`);

        // Create user in auth
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          user_metadata: { display_name: displayName },
          email_confirm: true
        });

        if (createError) {
          console.error('Create user error:', createError);
          throw new Error(`Failed to create user: ${createError.message}`);
        }

        // Create profile with tenant_id (required by NOT NULL constraint)
        const { error: profileError } = await supabaseAdmin.from('profiles').insert({
          user_id: newUser.user.id,
          display_name: displayName,
          tenant_id: tenantId
        });
        if (profileError) console.error('Profile creation error:', profileError);

        // Create tenant membership
        const { error: membershipError } = await supabaseAdmin.from('user_tenant_memberships').insert({
          user_id: newUser.user.id,
          tenant_id: tenantId,
          role: role || 'mitarbeiter',
          is_active: true
        });
        if (membershipError) console.error('Membership creation error:', membershipError);

        // Assign role in user_roles table
        if (role && role !== 'none') {
          const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
            user_id: newUser.user.id,
            role: role
          });
          if (roleError) console.error('Role assignment error:', roleError);
        }

        // Create user status
        const { error: statusError } = await supabaseAdmin.from('user_status').insert({
          user_id: newUser.user.id,
          status_type: 'online',
          notifications_enabled: true,
          tenant_id: tenantId
        });
        if (statusError) console.error('Status creation error:', statusError);

        console.log(`User ${email} created successfully`);
        return new Response(JSON.stringify({
          success: true,
          user: { 
            id: newUser.user.id, 
            email, 
            display_name: displayName, 
            password 
          }
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      case 'assignTenant': {
        // Superadmin only
        if (!isSuperadmin) {
          throw new Error('Only superadmin can assign tenants');
        }

        const { userId, tenantId, role } = body;
        if (!userId || !tenantId) {
          throw new Error('userId and tenantId are required');
        }

        console.log(`Assigning user ${userId} to tenant ${tenantId} with role ${role}`);

        // Check if membership exists
        const { data: existing } = await supabaseAdmin
          .from('user_tenant_memberships')
          .select('id')
          .eq('user_id', userId)
          .eq('tenant_id', tenantId)
          .single();

        if (existing) {
          // Update existing membership
          const { error } = await supabaseAdmin
            .from('user_tenant_memberships')
            .update({ role: role || 'mitarbeiter', is_active: true })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          // Create new membership
          const { error } = await supabaseAdmin.from('user_tenant_memberships').insert({
            user_id: userId,
            tenant_id: tenantId,
            role: role || 'mitarbeiter',
            is_active: true
          });
          if (error) throw error;
        }

        // Update user_roles table
        if (role && role !== 'none') {
          await supabaseAdmin.from('user_roles').upsert({
            user_id: userId,
            role: role
          }, { onConflict: 'user_id' });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'removeTenantMembership': {
        // Superadmin or Abgeordneter for own tenant
        const { userId, tenantId } = body;
        if (!userId || !tenantId) {
          throw new Error('userId and tenantId are required');
        }

        const canRemove = isSuperadmin || 
          (isAbgeordneter && callerMembership?.tenant_id === tenantId);

        if (!canRemove) {
          throw new Error('Insufficient permissions');
        }

        console.log(`Removing user ${userId} from tenant ${tenantId}`);

        const { error } = await supabaseAdmin
          .from('user_tenant_memberships')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('tenant_id', tenantId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'deleteUser': {
        // Superadmin or Abgeordneter for users in their tenant
        const { userId, tenantId } = body;
        if (!userId) {
          throw new Error('userId is required');
        }

        // For Abgeordneter: verify user is in their tenant
        if (!isSuperadmin && isAbgeordneter) {
          const { data: targetMembership } = await supabaseAdmin
            .from('user_tenant_memberships')
            .select('tenant_id')
            .eq('user_id', userId)
            .eq('tenant_id', callerMembership?.tenant_id)
            .eq('is_active', true)
            .single();

          if (!targetMembership) {
            throw new Error('Insufficient permissions - user not in your tenant');
          }
        } else if (!isSuperadmin) {
          throw new Error('Insufficient permissions');
        }

        // Prevent self-deletion
        if (userId === user.id) {
          throw new Error('Cannot delete yourself');
        }

        console.log(`Deleting user ${userId}`);

        // Delete user from auth (cascades to profiles, roles, etc.)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) {
          console.error('Delete user error:', error);
          throw new Error(`Failed to delete user: ${error.message}`);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'updateRole': {
        // Superadmin or Abgeordneter for own tenant
        const { userId, tenantId, role } = body;
        if (!userId || !tenantId || !role) {
          throw new Error('userId, tenantId, and role are required');
        }

        const canUpdate = isSuperadmin || 
          (isAbgeordneter && callerMembership?.tenant_id === tenantId);

        if (!canUpdate) {
          throw new Error('Insufficient permissions');
        }

        console.log(`Updating role for user ${userId} to ${role}`);

        // Update membership role
        const { error: membershipError } = await supabaseAdmin
          .from('user_tenant_memberships')
          .update({ role })
          .eq('user_id', userId)
          .eq('tenant_id', tenantId);

        if (membershipError) throw membershipError;

        // Update user_roles
        const { error: roleError } = await supabaseAdmin.from('user_roles').upsert({
          user_id: userId,
          role: role
        }, { onConflict: 'user_id' });

        if (roleError) throw roleError;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'initializeTenant': {
        // Superadmin only - initialize default settings for a new tenant
        if (!isSuperadmin) {
          throw new Error('Only superadmin can initialize tenants');
        }

        const { tenantId } = body;
        if (!tenantId) {
          throw new Error('tenantId is required');
        }

        console.log(`Initializing tenant: ${tenantId}`);

        // Default app settings for new tenant
        const defaultSettings = [
          { tenant_id: tenantId, setting_key: 'app_name', setting_value: 'LandtagsOS' },
          { tenant_id: tenantId, setting_key: 'app_subtitle', setting_value: 'Koordinationssystem' },
          { tenant_id: tenantId, setting_key: 'app_logo_url', setting_value: '' },
          { tenant_id: tenantId, setting_key: 'default_dashboard_cover_url', setting_value: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1920' },
          { tenant_id: tenantId, setting_key: 'default_dashboard_cover_position', setting_value: 'center' },
        ];

        const { error: settingsError } = await supabaseAdmin
          .from('app_settings')
          .insert(defaultSettings);

        if (settingsError) {
          console.error('Error creating default settings:', settingsError);
          // Don't throw - settings might already exist or not be critical
        }

        console.log(`Tenant ${tenantId} initialized successfully`);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in manage-tenant-user:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : String(error) 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
