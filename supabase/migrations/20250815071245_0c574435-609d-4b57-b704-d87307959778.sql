-- Create distribution lists table
CREATE TABLE public.distribution_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  topic TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for distribution list members
CREATE TABLE public.distribution_list_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distribution_list_id UUID NOT NULL REFERENCES public.distribution_lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(distribution_list_id, contact_id)
);

-- Enable Row Level Security
ALTER TABLE public.distribution_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_list_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for distribution_lists
CREATE POLICY "Users can create their own distribution lists" 
ON public.distribution_lists 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own distribution lists" 
ON public.distribution_lists 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own distribution lists" 
ON public.distribution_lists 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own distribution lists" 
ON public.distribution_lists 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for distribution_list_members
CREATE POLICY "Users can manage members of their distribution lists" 
ON public.distribution_list_members 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.distribution_lists dl 
  WHERE dl.id = distribution_list_members.distribution_list_id 
  AND dl.user_id = auth.uid()
));

-- Create triggers for updated_at
CREATE TRIGGER update_distribution_lists_updated_at
BEFORE UPDATE ON public.distribution_lists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();