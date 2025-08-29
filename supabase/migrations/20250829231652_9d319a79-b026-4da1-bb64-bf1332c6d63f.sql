-- Create letter management system (final version)

-- Letters table with comprehensive tracking
CREATE TABLE public.letters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  content_html TEXT NOT NULL DEFAULT '',
  recipient_name TEXT,
  recipient_address TEXT,
  contact_id UUID, -- Optional reference to contacts table
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'sent')),
  sent_date DATE,
  sent_method TEXT CHECK (sent_method IN ('post', 'email', 'both')),
  expected_response_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Letter collaborators for permissions
CREATE TABLE public.letter_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  permission_type TEXT NOT NULL DEFAULT 'read' CHECK (permission_type IN ('read', 'write', 'review')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Letter comments for review system
CREATE TABLE public.letter_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  text_position INTEGER, -- Starting position of highlighted text
  text_length INTEGER, -- Length of highlighted text
  comment_type TEXT DEFAULT 'comment' CHECK (comment_type IN ('comment', 'suggestion', 'approval')),
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Letter templates for letterhead and configuration
CREATE TABLE public.letter_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  letterhead_html TEXT NOT NULL DEFAULT '',
  letterhead_css TEXT NOT NULL DEFAULT '',
  response_time_days INTEGER NOT NULL DEFAULT 21,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for letters
CREATE POLICY "Users can create letters in their tenant" ON public.letters
  FOR INSERT WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can view letters in their tenant" ON public.letters
  FOR SELECT USING (
    tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND
    (created_by = auth.uid() OR 
     EXISTS (SELECT 1 FROM public.letter_collaborators lc 
             WHERE lc.letter_id = letters.id AND lc.user_id = auth.uid()))
  );

CREATE POLICY "Users can update their own letters or with write permission" ON public.letters
  FOR UPDATE USING (
    tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND
    (created_by = auth.uid() OR 
     EXISTS (SELECT 1 FROM public.letter_collaborators lc 
             WHERE lc.letter_id = letters.id AND lc.user_id = auth.uid() 
             AND lc.permission_type IN ('write', 'review')))
  );

CREATE POLICY "Users can delete their own letters" ON public.letters
  FOR DELETE USING (created_by = auth.uid());

-- RLS Policies for letter_collaborators
CREATE POLICY "Letter creators can manage collaborators" ON public.letter_collaborators
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.letters l 
            WHERE l.id = letter_collaborators.letter_id AND l.created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.letters l 
            WHERE l.id = letter_collaborators.letter_id AND l.created_by = auth.uid())
  );

CREATE POLICY "Users can view collaborators for accessible letters" ON public.letter_collaborators
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.letters l 
            WHERE l.id = letter_collaborators.letter_id AND l.created_by = auth.uid())
  );

-- RLS Policies for letter_comments
CREATE POLICY "Users can create comments on accessible letters" ON public.letter_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.letters l 
            WHERE l.id = letter_comments.letter_id AND 
            (l.created_by = auth.uid() OR 
             EXISTS (SELECT 1 FROM public.letter_collaborators lc 
                     WHERE lc.letter_id = l.id AND lc.user_id = auth.uid())))
  );

CREATE POLICY "Users can view comments on accessible letters" ON public.letter_comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.letters l 
            WHERE l.id = letter_comments.letter_id AND 
            (l.created_by = auth.uid() OR 
             EXISTS (SELECT 1 FROM public.letter_collaborators lc 
                     WHERE lc.letter_id = l.id AND lc.user_id = auth.uid())))
  );

CREATE POLICY "Users can update their own comments" ON public.letter_comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments" ON public.letter_comments
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for letter_templates
CREATE POLICY "Tenant admins can manage letter templates" ON public.letter_templates
  FOR ALL USING (is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Users can view templates in their tenant" ON public.letter_templates
  FOR SELECT USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND is_active = true);

-- Add trigger for updated_at
CREATE TRIGGER update_letters_updated_at
  BEFORE UPDATE ON public.letters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_letter_comments_updated_at
  BEFORE UPDATE ON public.letter_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_letter_templates_updated_at
  BEFORE UPDATE ON public.letter_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_letters_tenant_id ON public.letters(tenant_id);
CREATE INDEX idx_letters_created_by ON public.letters(created_by);
CREATE INDEX idx_letters_status ON public.letters(status);
CREATE INDEX idx_letter_collaborators_letter_id ON public.letter_collaborators(letter_id);
CREATE INDEX idx_letter_collaborators_user_id ON public.letter_collaborators(user_id);
CREATE INDEX idx_letter_comments_letter_id ON public.letter_comments(letter_id);
CREATE INDEX idx_letter_templates_tenant_id ON public.letter_templates(tenant_id);