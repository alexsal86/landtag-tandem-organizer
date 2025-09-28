import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Authenticate the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user has admin role
    const { data: userRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    if (roleError) {
      console.error('Role check error:', roleError)
      return new Response(
        JSON.stringify({ error: 'Error checking user permissions' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const hasAdminRole = userRoles?.some(r => r.role === 'abgeordneter')
    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get Erwin's tenant ID
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('name', 'Büro Erwin')
      .single()

    if (tenantError || !tenantData) {
      console.error('Tenant error:', tenantError)
      return new Response(
        JSON.stringify({ error: 'Büro Erwin not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const tenantId = tenantData.id

    // Demo users to create
    const demoUsers = [
      {
        email: 'julia.mueller@buero-erwin.de',
        displayName: 'Julia Müller',
        role: 'bueroleitung'
      },
      {
        email: 'thomas.weber@buero-erwin.de', 
        displayName: 'Thomas Weber',
        role: 'mitarbeiter'
      },
      {
        email: 'sarah.klein@buero-erwin.de',
        displayName: 'Sarah Klein', 
        role: 'mitarbeiter'
      },
      {
        email: 'michael.schmidt@buero-erwin.de',
        displayName: 'Michael Schmidt',
        role: 'praktikant'
      }
    ]

    const createdUsers = []

    for (const demoUser of demoUsers) {
      const password = generatePassword()
      
      // Create user via Supabase Admin API
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: demoUser.email,
        password: password,
        email_confirm: true,
        user_metadata: {
          display_name: demoUser.displayName
        }
      })

      if (createError) {
        console.error(`Error creating user ${demoUser.email}:`, createError)
        continue
      }

      if (!newUser.user) {
        console.error(`No user returned for ${demoUser.email}`)
        continue
      }

      // Update profile with tenant_id
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ tenant_id: tenantId })
        .eq('user_id', newUser.user.id)

      if (profileError) {
        console.error(`Profile update error for ${demoUser.email}:`, profileError)
      }

      // Create tenant membership
      const { error: membershipError } = await supabaseAdmin
        .from('user_tenant_memberships')
        .insert({
          user_id: newUser.user.id,
          tenant_id: tenantId,
          role: demoUser.role
        })

      if (membershipError) {
        console.error(`Membership error for ${demoUser.email}:`, membershipError)
      }

      // Update user status with tenant_id
      const { error: statusError } = await supabaseAdmin
        .from('user_status')
        .update({ tenant_id: tenantId })
        .eq('user_id', newUser.user.id)

      if (statusError) {
        console.error(`Status update error for ${demoUser.email}:`, statusError)
      }

      // Assign role
      const { error: roleInsertError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: newUser.user.id,
          role: demoUser.role
        })

      if (roleInsertError) {
        console.error(`Role assignment error for ${demoUser.email}:`, roleInsertError)
      }

      createdUsers.push({
        email: demoUser.email,
        displayName: demoUser.displayName,
        role: demoUser.role,
        password: password
      })

      console.log(`Successfully created user: ${demoUser.email}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${createdUsers.length} Demo-Benutzer erfolgreich erstellt`,
        users: createdUsers
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}