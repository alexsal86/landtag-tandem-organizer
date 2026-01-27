-- Add missing values to leave_status enum
ALTER TYPE public.leave_status ADD VALUE IF NOT EXISTS 'cancel_requested';
ALTER TYPE public.leave_status ADD VALUE IF NOT EXISTS 'cancelled';