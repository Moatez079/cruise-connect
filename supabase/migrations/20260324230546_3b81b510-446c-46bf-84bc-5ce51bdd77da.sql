
-- Create guest_feedback table
CREATE TABLE public.guest_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
  room_number INTEGER NOT NULL,
  guest_language TEXT NOT NULL DEFAULT 'en',
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  service_rating INTEGER CHECK (service_rating >= 1 AND service_rating <= 5),
  cleanliness_rating INTEGER CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
  food_rating INTEGER CHECK (food_rating >= 1 AND food_rating <= 5),
  original_comment TEXT,
  translated_comment TEXT,
  pdf_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guest_feedback ENABLE ROW LEVEL SECURITY;

-- Guests (anon) can submit feedback
CREATE POLICY "Anyone can submit feedback" ON public.guest_feedback
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Staff can view feedback for their boats
CREATE POLICY "Assigned staff can view feedback" ON public.guest_feedback
  FOR SELECT TO authenticated
  USING (is_assigned_to_boat(auth.uid(), boat_id));

-- Owners can view all feedback
CREATE POLICY "Owners can view all feedback" ON public.guest_feedback
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));

-- Create storage bucket for feedback PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('feedback-pdfs', 'feedback-pdfs', true);

-- Storage policies
CREATE POLICY "Anyone can upload feedback PDFs" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'feedback-pdfs');

CREATE POLICY "Anyone can read feedback PDFs" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'feedback-pdfs');
