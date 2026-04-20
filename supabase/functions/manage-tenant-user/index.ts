import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

import { withSafeHandler } from "../_shared/security.ts";
import {
  seedStandardData,
  cloneTenantData,
  getTenantHealth,
  buildStandardAppSettings,
} from "../_shared/tenant-seed.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 14; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function hasPlatformAdminAccess(supabaseAdmin: any, user: any): Promise<boolean> {
  const claimRoles = user?.app_metadata?.platform_roles;
  if (Array.isArray(claimRoles) && claimRoles.includes('platform_admin')) {
    return true;
  }

  const { data, error } = await supabaseAdmin
    .from('platform_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'platform_admin')
    .maybeSingle();

  if (error) {
    console.error('Failed to check platform admin role:', error);
    return false;
  }

  return Boolean(data);
}

async function logAdminAction(
  supabaseAdmin: any,
  actorUserId: string,
  actorEmail: string | undefined,
  action: string,
  details: Record<string, unknown> = {},
  tenantId: string | null = null,
) {
  const payload = {
    action,
    source: 'manage-tenant-user',
    actor_email: actorEmail ?? null,
    details,
    timestamp: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from('audit_log_entries')
    .insert({
      user_id: actorUserId,
      tenant_id: tenantId,
      payload,
    });

  if (error) {
    console.error('Failed to write admin audit log:', error);
  }
}

serve(withSafeHandler("manage-tenant-user", async (req) => {
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

    const isPlatformAdmin = await hasPlatformAdminAccess(supabaseAdmin, user);
    console.log(`User ${user.email} is platform admin: ${isPlatformAdmin}`);

    // Resolve caller's tenant membership and role
    const { data: callerMembershipData } = await supabaseAdmin
      .from('user_tenant_memberships')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    const callerMembership = callerMembershipData as { tenant_id: string; role: string } | null;
    const isAbgeordneter = callerMembership?.role === 'abgeordneter';

    const assertTenantPermission = async (tenantId: string, requiredRole: 'abgeordneter') => {
      if (isPlatformAdmin) return;

      const { data: permission } = await supabaseAdmin
        .from('user_tenant_memberships')
        .select('user_id, tenant_id, is_active, role')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('role', requiredRole)
        .maybeSingle();

      if (!permission) {
        throw new HttpError(403, 'Insufficient permissions');
      }
    };

    const body = await req.json();
    const { action } = body;
    console.log(`Action requested: ${action}`);

    switch (action) {
      case 'listAllUsers': {
        // Superadmin only
        if (!isPlatformAdmin) {
          throw new Error('Only superadmin can list all users');
        }

        await logAdminAction(supabaseAdmin, user.id, user.email, 'platform_admin.list_all_users');

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
        if (!isPlatformAdmin) {
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
        await logAdminAction(
          supabaseAdmin,
          user.id,
          user.email,
          'platform_admin.create_user',
          { target_user_id: newUser.user.id, target_email: email, role: role || 'mitarbeiter' },
          tenantId,
        );

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
        if (!isPlatformAdmin) {
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

        await logAdminAction(
          supabaseAdmin,
          user.id,
          user.email,
          'platform_admin.assign_tenant',
          { target_user_id: userId, role: role || 'mitarbeiter' },
          tenantId,
        );

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

        const canRemove = isPlatformAdmin ||
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

        await logAdminAction(
          supabaseAdmin,
          user.id,
          user.email,
          'platform_admin.remove_tenant_membership',
          { target_user_id: userId },
          tenantId,
        );

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
        if (!isPlatformAdmin && isAbgeordneter) {
          const { data: targetMembership } = await supabaseAdmin
            .from('user_tenant_memberships')
            .select('tenant_id')
            .eq('user_id', userId)
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .maybeSingle();

          if (!targetMembership) {
            throw new HttpError(403, 'Insufficient permissions - user not in target tenant');
          }
        } else if (!isPlatformAdmin) {
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

        await logAdminAction(
          supabaseAdmin,
          user.id,
          user.email,
          'platform_admin.delete_user',
          { target_user_id: userId },
          tenantId ?? callerMembership?.tenant_id ?? null,
        );

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

        const canUpdate = isPlatformAdmin ||
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

        await logAdminAction(
          supabaseAdmin,
          user.id,
          user.email,
          'platform_admin.update_role',
          { target_user_id: userId, role },
          tenantId,
        );

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'initializeTenant': {
        // Superadmin only - initialize default settings for a new tenant
        if (!isPlatformAdmin) {
          throw new Error('Only superadmin can initialize tenants');
        }

        const { tenantId, appName, appSubtitle } = body;
        if (!tenantId) {
          throw new Error('tenantId is required');
        }

        console.log(`Initializing tenant: ${tenantId}`);

        // Default app settings for new tenant (use provided values or defaults)
        const defaultSettings = [
          { tenant_id: tenantId, setting_key: 'app_name', setting_value: appName || 'LandtagsOS' },
          { tenant_id: tenantId, setting_key: 'app_subtitle', setting_value: appSubtitle || 'Koordinationssystem' },
          { tenant_id: tenantId, setting_key: 'app_logo_url', setting_value: '' },
          { tenant_id: tenantId, setting_key: 'default_dashboard_cover_url', setting_value: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1920' },
          { tenant_id: tenantId, setting_key: 'default_dashboard_cover_position', setting_value: 'center' },
        ];

        const { error: settingsError } = await supabaseAdmin
          .from('app_settings')
          .insert(defaultSettings);

        if (settingsError) {
          console.error('Error creating default settings:', settingsError);
        }

        console.log(`Tenant ${tenantId} initialized successfully`);
        await logAdminAction(
          supabaseAdmin,
          user.id,
          user.email,
          'platform_admin.initialize_tenant',
          { tenant_id: tenantId, app_name: appName, app_subtitle: appSubtitle },
          tenantId,
        );

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'provisionTenant': {
        if (!isPlatformAdmin) {
          throw new HttpError(403, 'Only superadmin can provision tenants');
        }

        const {
          name,
          description,
          settings,
          appName,
          appSubtitle,
          seedMode,
          cloneFromTenantId,
          adminUser,
        } = body as {
          name?: string;
          description?: string | null;
          settings?: Record<string, unknown>;
          appName?: string;
          appSubtitle?: string;
          seedMode?: 'standard' | 'clone' | 'empty';
          cloneFromTenantId?: string;
          adminUser?: { email: string; displayName: string };
        };

        if (!name || !name.trim()) {
          throw new HttpError(400, 'Tenant name is required');
        }
        if (seedMode === 'clone' && !cloneFromTenantId) {
          throw new HttpError(400, 'cloneFromTenantId is required when seedMode = clone');
        }

        // 1) Insert tenant
        const { data: newTenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .insert({
            name: name.trim(),
            description: description?.toString().trim() || null,
            is_active: true,
            settings: settings ?? {},
          })
          .select('id')
          .single();

        if (tenantError || !newTenant) {
          console.error('Provision tenant error:', tenantError);
          throw new Error(tenantError?.message ?? 'Failed to create tenant');
        }

        const tenantId = newTenant.id;

        // 2) Seed default data
        let report;
        if (seedMode === 'clone' && cloneFromTenantId) {
          // Insert the standard app_settings first so the cloned ones can override.
          await supabaseAdmin
            .from('app_settings')
            .insert(buildStandardAppSettings(tenantId, { appName, appSubtitle }));
          report = await cloneTenantData(supabaseAdmin, cloneFromTenantId, tenantId);
        } else if (seedMode === 'empty') {
          await supabaseAdmin
            .from('app_settings')
            .insert(buildStandardAppSettings(tenantId, { appName, appSubtitle }));
          report = {
            app_settings: 5,
            case_file_types: 0,
            notification_types: 0,
            letter_occasions: 0,
            meeting_templates: 0,
            planning_templates: 0,
            errors: [],
          };
        } else {
          report = await seedStandardData(supabaseAdmin, tenantId, {
            appName,
            appSubtitle,
          });
        }

        // 3) Optional admin user
        let adminPassword: string | undefined;
        let adminEmail: string | undefined;
        if (adminUser?.email && adminUser?.displayName) {
          adminPassword = generatePassword();
          adminEmail = adminUser.email;

          const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: adminUser.email,
            password: adminPassword,
            user_metadata: { display_name: adminUser.displayName },
            email_confirm: true,
          });

          if (createError || !createdUser?.user) {
            console.error('Admin user creation failed:', createError);
            (report as any).errors?.push(`admin user: ${createError?.message ?? 'unknown'}`);
          } else {
            const newUserId = createdUser.user.id;
            await supabaseAdmin.from('profiles').insert({
              user_id: newUserId,
              display_name: adminUser.displayName,
              tenant_id: tenantId,
            });
            await supabaseAdmin.from('user_tenant_memberships').insert({
              user_id: newUserId,
              tenant_id: tenantId,
              role: 'abgeordneter',
              is_active: true,
            });
            await supabaseAdmin.from('user_roles').insert({
              user_id: newUserId,
              role: 'abgeordneter',
            });
            await supabaseAdmin.from('user_status').insert({
              user_id: newUserId,
              status_type: 'online',
              notifications_enabled: true,
              tenant_id: tenantId,
            });
          }
        }

        await logAdminAction(
          supabaseAdmin,
          user.id,
          user.email,
          'platform_admin.provision_tenant',
          { tenant_id: tenantId, seed_mode: seedMode, has_admin: Boolean(adminUser) },
          tenantId,
        );

        return new Response(JSON.stringify({
          success: true,
          tenantId,
          report,
          adminPassword,
          adminEmail,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'cloneTenantData': {
        if (!isPlatformAdmin) {
          throw new HttpError(403, 'Only superadmin can clone tenant data');
        }
        const { sourceTenantId, targetTenantId } = body;
        if (!sourceTenantId || !targetTenantId) {
          throw new HttpError(400, 'sourceTenantId and targetTenantId are required');
        }
        if (sourceTenantId === targetTenantId) {
          throw new HttpError(400, 'source and target must differ');
        }

        const report = await cloneTenantData(supabaseAdmin, sourceTenantId, targetTenantId);

        await logAdminAction(
          supabaseAdmin,
          user.id,
          user.email,
          'platform_admin.clone_tenant_data',
          { source: sourceTenantId, target: targetTenantId },
          targetTenantId,
        );

        return new Response(JSON.stringify({ success: true, report }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'getTenantHealth': {
        if (!isPlatformAdmin) {
          throw new HttpError(403, 'Only superadmin can read tenant health');
        }
        const { tenantId } = body;
        if (!tenantId) {
          throw new HttpError(400, 'tenantId is required');
        }
        const health = await getTenantHealth(supabaseAdmin, tenantId);
        return new Response(JSON.stringify({ success: true, health }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in manage-tenant-user:', error);
    const status = error instanceof HttpError ? error.status : 400;
    // Only expose message for known HttpError (controlled), otherwise generic
    const safeMessage = error instanceof HttpError
      ? error.message
      : 'Internal server error';
    return new Response(JSON.stringify({
      success: false,
      error: safeMessage,
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}));
