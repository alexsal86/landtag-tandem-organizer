-- Add sender information and information blocks to letter templates
ALTER TABLE public.letter_templates 
ADD COLUMN default_sender_id uuid,
ADD COLUMN default_info_blocks uuid[];

-- Add foreign key constraint for sender information
ALTER TABLE public.letter_templates 
ADD CONSTRAINT fk_letter_templates_sender 
FOREIGN KEY (default_sender_id) 
REFERENCES public.sender_information(id);