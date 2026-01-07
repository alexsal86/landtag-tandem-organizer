import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnnualTask {
  id: string;
  tenant_id: string;
  title: string;
  execute_function: string;
  due_month: number;
  due_day: number | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    const currentYear = today.getFullYear();

    console.log(`Checking for auto-execute tasks on ${currentYear}-${currentMonth}-${currentDay}`);

    // Get all auto_execute tasks that are due today
    const { data: tasks, error: tasksError } = await supabase
      .from('annual_tasks')
      .select('id, tenant_id, title, execute_function, due_month, due_day')
      .eq('auto_execute', true)
      .not('execute_function', 'is', null)
      .eq('due_month', currentMonth);

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      throw tasksError;
    }

    if (!tasks || tasks.length === 0) {
      console.log('No auto-execute tasks found for this month');
      return new Response(
        JSON.stringify({ message: 'No tasks to execute', executed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { taskId: string; title: string; success: boolean; result?: any; error?: string }[] = [];

    for (const task of tasks as AnnualTask[]) {
      // Check if task is due today (if specific day is set) or first day of month
      const isDueToday = task.due_day 
        ? task.due_day === currentDay 
        : currentDay === 1;

      if (!isDueToday) {
        console.log(`Task ${task.title} not due today (due_day: ${task.due_day}, today: ${currentDay})`);
        continue;
      }

      // Check if already completed this year
      const { data: completion } = await supabase
        .from('annual_task_completions')
        .select('id')
        .eq('annual_task_id', task.id)
        .eq('year', currentYear)
        .single();

      if (completion) {
        console.log(`Task ${task.title} already completed for ${currentYear}`);
        continue;
      }

      console.log(`Executing task: ${task.title} with function: ${task.execute_function}`);

      try {
        // Execute the function
        const { data: execResult, error: execError } = await supabase.rpc(
          task.execute_function,
          { p_tenant_id: task.tenant_id }
        );

        if (execError) {
          console.error(`Error executing ${task.execute_function}:`, execError);
          results.push({
            taskId: task.id,
            title: task.title,
            success: false,
            error: execError.message,
          });
          continue;
        }

        console.log(`Function ${task.execute_function} result:`, execResult);

        // Mark as completed
        const { error: completionError } = await supabase
          .from('annual_task_completions')
          .insert({
            annual_task_id: task.id,
            year: currentYear,
            completed_at: new Date().toISOString(),
            completed_by: null, // System execution
            notes: `Automatisch ausgeführt: ${JSON.stringify(execResult)}`,
          });

        if (completionError) {
          console.error('Error creating completion record:', completionError);
        }

        results.push({
          taskId: task.id,
          title: task.title,
          success: true,
          result: execResult,
        });

      } catch (execError: any) {
        console.error(`Exception executing task ${task.title}:`, execError);
        results.push({
          taskId: task.id,
          title: task.title,
          success: false,
          error: execError.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Execution complete. ${successCount}/${results.length} tasks succeeded.`);

    return new Response(
      JSON.stringify({
        message: `Executed ${successCount} of ${results.length} tasks`,
        executed: successCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in execute-annual-tasks:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
