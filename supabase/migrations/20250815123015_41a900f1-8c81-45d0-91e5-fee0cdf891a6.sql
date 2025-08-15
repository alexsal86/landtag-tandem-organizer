-- Create storage bucket for planning item documents
INSERT INTO storage.buckets (id, name, public) VALUES ('planning-documents', 'planning-documents', false);

-- Create storage policies for planning item documents
CREATE POLICY "Users can view planning documents for accessible plannings" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'planning-documents' 
  AND EXISTS (
    SELECT 1 
    FROM planning_item_documents pid
    JOIN event_planning_checklist_items epci ON epci.id = pid.planning_item_id
    JOIN event_plannings ep ON ep.id = epci.event_planning_id
    WHERE pid.file_path = name 
    AND (
      ep.user_id = auth.uid() 
      OR NOT ep.is_private 
      OR EXISTS (
        SELECT 1 
        FROM event_planning_collaborators epc 
        WHERE epc.event_planning_id = ep.id 
        AND epc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can upload planning documents for editable plannings" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'planning-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete planning documents for editable plannings" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'planning-documents'
  AND EXISTS (
    SELECT 1 
    FROM planning_item_documents pid
    JOIN event_planning_checklist_items epci ON epci.id = pid.planning_item_id
    JOIN event_plannings ep ON ep.id = epci.event_planning_id
    WHERE pid.file_path = name 
    AND (
      ep.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 
        FROM event_planning_collaborators epc 
        WHERE epc.event_planning_id = ep.id 
        AND epc.user_id = auth.uid() 
        AND epc.can_edit = true
      )
    )
  )
);