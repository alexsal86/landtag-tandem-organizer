import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskDecisionResponse } from "./TaskDecisionResponse";
import { TaskDecisionDetails } from "./TaskDecisionDetails";
import { Check, X, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DecisionRequest {
  id: string;
  task_id: string;
  title: string;
  description: string | null;
  created_at: string;
  participant_id: string | null;
  task: {
    title: string;
  };
  hasResponded: boolean;
  isParticipant?: boolean;
  participants?: Array<{
    id: string;
    user_id: string;
    responses: Array<{
      response_type: 'yes' | 'no' | 'question';
      comment: string | null;
      created_at: string;
    }>;
  }>;
}

export const TaskDecisionList = () => {
  console.log('TaskDecisionList component rendered - SIMPLIFIED VERSION');
  
  return (
    <div style={{border: '2px solid blue', padding: '10px', margin: '5px'}}>
      <h3>TEST: TaskDecisionList funktioniert!</h3>
      <p>Wenn du das siehst, wird die Komponente gerendert.</p>
    </div>
  );
};