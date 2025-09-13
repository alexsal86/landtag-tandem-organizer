-- Add parent_comment_id to letter_comments for reply functionality
ALTER TABLE public.letter_comments 
ADD COLUMN parent_comment_id uuid REFERENCES public.letter_comments(id) ON DELETE CASCADE;