import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Initialize client for current user authentication check
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get JWT from request headers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user is authenticated and get their session
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    // Check if the current user is a super admin (abgeordneter role)
    const { data: userRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError) {
      throw new Error('Failed to check user permissions');
    }

    const isAdmin = userRoles?.some(r => r.role === 'abgeordneter');
    if (!isAdmin) {
      throw new Error('Insufficient permissions. Only super admins can create users.');
    }

    // Parse request body
    const { email, displayName, role, password } = await req.json();

    // Validate input
    if (!email || !displayName) {
      throw new Error('Email and display name are required');
    }

    // Generate password if not provided
    const userPassword = password || generatePassword();

    console.log('Creating user with email:', email);

    // Create the user using Supabase Admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: userPassword,
      user_metadata: {
        display_name: displayName
      },
      email_confirm: true // Auto-confirm email for admin-created users
    });

    if (createError) {
      console.error('Error creating user:', createError);
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    console.log('User created successfully:', newUser.user?.id);

    // Create profile for the new user
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: newUser.user.id,
        display_name: displayName
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Don't throw here as the user is already created
    }

    // Create user status entry to avoid foreign key constraint issues
    const { error: statusError } = await supabaseAdmin
      .from('user_status')
      .insert({
        user_id: newUser.user.id,
        status_type: 'online',
        notifications_enabled: true,
        auto_away_enabled: true
      })
      .select()
      .single();

    if (statusError) {
      console.error('Error creating user status:', statusError);
      // Don't throw here as the user is already created
    }

    // Create standard dashboard layout for new user
    const standardDashboardLayout = [
      {
        id: "stats",
        type: "stats", 
        title: "Schnellstatistiken",
        position: {x: 0, y: 0},
        size: {width: 3, height: 1},
        widgetSize: "3x1",
        configuration: {theme: "default", refreshInterval: 300}
      },
      {
        id: "pomodoro",
        type: "pomodoro",
        title: "Pomodoro Timer", 
        position: {x: 3, y: 0},
        size: {width: 2, height: 1},
        widgetSize: "2x1",
        configuration: {theme: "default", notifications: true}
      },
      {
        id: "messages",
        type: "messages",
        title: "Nachrichten",
        position: {x: 5, y: 0},
        size: {width: 3, height: 1}, 
        widgetSize: "3x1",
        configuration: {theme: "default", notifications: true}
      },
      {
        id: "tasks",
        type: "tasks",
        title: "Ausstehende Aufgaben",
        position: {x: 0, y: 1},
        size: {width: 3, height: 2},
        widgetSize: "3x2", 
        configuration: {theme: "default", showHeader: true}
      },
      {
        id: "quicknotes",
        type: "quicknotes",
        title: "Quick Notes",
        position: {x: 3, y: 1},
        size: {width: 2, height: 2},
        widgetSize: "2x2",
        configuration: {theme: "default", autoSave: true, compact: false}
      },
      {
        id: "habits", 
        type: "habits",
        title: "Habit Tracker",
        position: {x: 5, y: 1},
        size: {width: 3, height: 2},
        widgetSize: "3x2",
        configuration: {theme: "default", showStreak: true}
      },
      {
        id: "schedule",
        type: "schedule", 
        title: "Heutiger Terminplan",
        position: {x: 0, y: 3},
        size: {width: 3, height: 2},
        widgetSize: "3x2",
        configuration: {theme: "default", compact: false}
      },
      {
        id: "calllog",
        type: "calllog",
        title: "Call Log",
        position: {x: 3, y: 3}, 
        size: {width: 3, height: 2},
        widgetSize: "3x2",
        configuration: {theme: "default", showFollowUps: true}
      },
      {
        id: "actions",
        type: "actions",
        title: "Schnellaktionen",
        position: {x: 0, y: 5},
        size: {width: 8, height: 1},
        widgetSize: "8x1",
        configuration: {theme: "default", showIcons: true}
      }
    ];

    // Create standard dashboard layout for the new user
    const { error: dashboardError } = await supabaseAdmin
      .from('team_dashboards')
      .insert({
        owner_id: newUser.user.id,
        name: 'Standard Layout',
        description: 'Standard Dashboard Layout',
        layout_data: standardDashboardLayout,
        is_public: false
      });

    if (dashboardError) {
      console.error('Error creating dashboard layout:', dashboardError);
      // Don't throw here as the user is already created
    }

    // Assign role if provided
    if (role && role !== 'none') {
      const { error: roleAssignError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: newUser.user.id,
          role: role
        });

      if (roleAssignError) {
        console.error('Error assigning role:', roleAssignError);
        // Don't throw here as the user is already created
      }
    }

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        display_name: displayName,
        password: userPassword // Return password so admin can share it
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-admin-user function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : String(error) 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}