import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Matrix morning greeting function initialized");

interface MorningSettings {
  user_id: string;
  enabled: boolean;
  send_time: string;
  include_greeting: boolean;
  include_weather: boolean;
  include_appointments: boolean;
}

interface WeatherData {
  temperature: number;
  condition: string;
  icon: string;
}

interface Appointment {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  category?: string;
}

serve(async (req) => {
  console.log('🌅 Morning greeting function called');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current time in Berlin timezone
    const now = new Date();
    const berlinTime = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);
    
    const currentHour = parseInt(berlinTime.split(':')[0]);
    const today = now.toISOString().split('T')[0];

    console.log(`🕐 Current Berlin time: ${berlinTime}, Hour: ${currentHour}`);

    // Get all users with enabled morning settings for this hour
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('matrix_morning_settings')
      .select('*')
      .eq('enabled', true);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw settingsError;
    }

    console.log(`📋 Found ${settings?.length || 0} users with morning greetings enabled`);

    let sentCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const setting of settings || []) {
      try {
        // Check if user's send_time matches current hour
        const sendHour = parseInt(setting.send_time.split(':')[0]);
        
        if (sendHour !== currentHour) {
          console.log(`⏭️ Skipping user ${setting.user_id} - send time ${setting.send_time} doesn't match current hour ${currentHour}`);
          skippedCount++;
          continue;
        }

        // Check if already sent today
        const { data: existingLog, error: logCheckError } = await supabaseAdmin
          .from('matrix_bot_logs')
          .select('id')
          .eq('user_id', setting.user_id)
          .eq('message_type', 'morning_greeting')
          .eq('sent_date', today)
          .maybeSingle();

        if (logCheckError && logCheckError.code !== 'PGRST116') {
          console.error(`Error checking logs for user ${setting.user_id}:`, logCheckError);
          continue;
        }

        if (existingLog) {
          console.log(`⏭️ Already sent greeting today to user ${setting.user_id}`);
          skippedCount++;
          continue;
        }

        // Generate greeting message
        const message = await generateGreeting(supabaseAdmin, setting);
        
        if (!message) {
          console.log(`⚠️ No message generated for user ${setting.user_id}`);
          skippedCount++;
          continue;
        }

        // Get user's Matrix subscription
        const { data: matrixSub, error: matrixError } = await supabaseAdmin
          .from('matrix_subscriptions')
          .select('room_id')
          .eq('user_id', setting.user_id)
          .eq('is_active', true)
          .maybeSingle();

        if (matrixError || !matrixSub) {
          console.log(`⚠️ No active Matrix subscription for user ${setting.user_id}`);
          skippedCount++;
          continue;
        }

        // Send via matrix-bot-handler
        const { data: sendResult, error: sendError } = await supabaseAdmin.functions.invoke(
          'matrix-bot-handler',
          {
            body: {
              type: 'morning_greeting',
              title: '🌅 Dein Morgengruß',
              message: message,
              user_id: setting.user_id
            }
          }
        );

        if (sendError) {
          console.error(`❌ Error sending to user ${setting.user_id}:`, sendError);
          errorCount++;
          continue;
        }

        // Log successful send
        await supabaseAdmin
          .from('matrix_bot_logs')
          .insert({
            user_id: setting.user_id,
            room_id: matrixSub.room_id,
            message: message.substring(0, 255),
            success: true,
            message_type: 'morning_greeting',
            sent_date: today,
            timestamp: new Date().toISOString()
          });

        console.log(`✅ Sent morning greeting to user ${setting.user_id}`);
        sentCount++;

      } catch (userError) {
        console.error(`❌ Error processing user ${setting.user_id}:`, userError);
        errorCount++;
      }
    }

    console.log(`📊 Morning greetings completed: ${sentCount} sent, ${skippedCount} skipped, ${errorCount} errors`);

    return new Response(JSON.stringify({
      success: true,
      sent: sentCount,
      skipped: skippedCount,
      errors: errorCount,
      message: `Morning greetings processed: ${sentCount} sent successfully`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateGreeting(supabaseAdmin: any, setting: MorningSettings): Promise<string> {
  const parts: string[] = [];

  try {
    // Generate greeting
    if (setting.include_greeting) {
      const hour = new Date().getHours();
      let timeSlot: 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' = 'morning';
      
      if (hour >= 6 && hour < 11) timeSlot = 'morning';
      else if (hour >= 11 && hour < 14) timeSlot = 'midday';
      else if (hour >= 14 && hour < 18) timeSlot = 'afternoon';
      else if (hour >= 18 && hour < 22) timeSlot = 'evening';
      else timeSlot = 'night';

      const greetings = {
        morning: '🌅 Guten Morgen!',
        midday: '☀️ Hallo!',
        afternoon: '👋 Guten Tag!',
        evening: '🌆 Guten Abend!',
        night: '🌙 Gute Nacht!'
      };

      parts.push(greetings[timeSlot]);
      parts.push('Ein neuer Tag, neue Möglichkeiten! Nutze die Energie des Tages.');
    }

    // Fetch and add weather
    if (setting.include_weather) {
      try {
        const weatherParts = [];
        
        // Karlsruhe weather
        const karlsruheWeather = await fetchWeather(49.0069, 8.4037);
        if (karlsruheWeather) {
          weatherParts.push(`• Karlsruhe: ${karlsruheWeather.temperature}°C, ${translateCondition(karlsruheWeather.condition)}`);
        }

        // Stuttgart weather
        const stuttgartWeather = await fetchWeather(48.7758, 9.1829);
        if (stuttgartWeather) {
          weatherParts.push(`• Stuttgart: ${stuttgartWeather.temperature}°C, ${translateCondition(stuttgartWeather.condition)}`);
        }

        if (weatherParts.length > 0) {
          parts.push(`☀️ Wetter heute:\n${weatherParts.join('\n')}`);
        }
      } catch (weatherError) {
        console.error('Error fetching weather:', weatherError);
      }
    }

    // Fetch and add appointments
    if (setting.include_appointments) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        const { data: appointments, error: aptError } = await supabaseAdmin
          .from('appointments')
          .select('id, title, start_time, end_time, location, category')
          .eq('user_id', setting.user_id)
          .gte('start_time', `${today}T00:00:00`)
          .lt('start_time', `${tomorrow}T00:00:00`)
          .order('start_time', { ascending: true })
          .limit(10);

        if (!aptError && appointments && appointments.length > 0) {
          const appointmentLines = appointments.map((apt: Appointment) => {
            const startTime = new Date(apt.start_time).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit'
            });
            const endTime = new Date(apt.end_time).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit'
            });
            const location = apt.location ? ` (${apt.location})` : '';
            return `• ${startTime} - ${endTime}: ${apt.title}${location}`;
          });

          parts.push(`📅 Deine Termine heute:\n${appointmentLines.join('\n')}`);
        } else {
          parts.push('📅 Keine Termine heute 🎉');
        }
      } catch (aptError) {
        console.error('Error fetching appointments:', aptError);
      }
    }

    // Add motivational closing
    if (parts.length > 0) {
      parts.push('Viel Erfolg heute! 💪');
    }

    return parts.join('\n\n');
  } catch (error) {
    console.error('Error generating greeting:', error);
    return '';
  }
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const response = await fetch(
      `https://api.brightsky.dev/current_weather?lat=${lat}&lon=${lon}`
    );
    
    if (!response.ok) {
      console.error('Weather API error:', response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    return {
      temperature: Math.round(data.weather.temperature),
      condition: data.weather.condition,
      icon: data.weather.icon
    };
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    return null;
  }
}

function translateCondition(condition: string): string {
  const translations: Record<string, string> = {
    'clear-day': 'Sonnig',
    'clear-night': 'Klar',
    'partly-cloudy-day': 'Teilweise bewölkt',
    'partly-cloudy-night': 'Teilweise bewölkt',
    'cloudy': 'Bewölkt',
    'dry': 'Trocken',
    'fog': 'Nebel',
    'wind': 'Windig',
    'rain': 'Regen',
    'sleet': 'Schneeregen',
    'snow': 'Schnee',
    'hail': 'Hagel',
    'thunderstorm': 'Gewitter',
  };
  
  return translations[condition.toLowerCase()] || 'Unbekannt';
}
