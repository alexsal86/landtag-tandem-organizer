-- Fix letter_comments foreign key relationship issue
-- Add foreign key constraint to link letter_comments.user_id to profiles table
ALTER TABLE public.letter_comments 
ADD CONSTRAINT letter_comments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;