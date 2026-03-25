
-- Table to store custom feedback questions per boat (extracted from uploaded form images)
CREATE TABLE public.feedback_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id uuid NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
  label text NOT NULL,
  label_en text NOT NULL,
  question_type text NOT NULL DEFAULT 'rating' CHECK (question_type IN ('rating', 'text')),
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table to store custom feedback answers
CREATE TABLE public.feedback_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.guest_feedback(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.feedback_questions(id) ON DELETE CASCADE,
  rating_value integer,
  text_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_answers ENABLE ROW LEVEL SECURITY;

-- feedback_questions policies
CREATE POLICY "Anyone can view feedback questions" ON public.feedback_questions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners can manage feedback questions" ON public.feedback_questions FOR ALL TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Assigned staff can manage feedback questions" ON public.feedback_questions FOR ALL TO authenticated USING (is_assigned_to_boat(auth.uid(), boat_id));

-- feedback_answers policies
CREATE POLICY "Anyone can insert feedback answers" ON public.feedback_answers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Owners can view all answers" ON public.feedback_answers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.guest_feedback gf WHERE gf.id = feedback_answers.feedback_id AND has_role(auth.uid(), 'owner'::app_role))
);
CREATE POLICY "Assigned staff can view answers" ON public.feedback_answers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.guest_feedback gf WHERE gf.id = feedback_answers.feedback_id AND is_assigned_to_boat(auth.uid(), gf.boat_id))
);
