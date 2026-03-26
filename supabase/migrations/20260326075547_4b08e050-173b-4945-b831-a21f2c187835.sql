
ALTER TABLE public.guest_feedback 
ADD COLUMN IF NOT EXISTS guest_name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS company_name text DEFAULT NULL;

ALTER TABLE public.feedback_questions
ADD COLUMN IF NOT EXISTS section text DEFAULT 'general';
