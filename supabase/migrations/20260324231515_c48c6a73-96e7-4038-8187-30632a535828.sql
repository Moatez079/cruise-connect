
-- Create daily_reports table
CREATE TABLE public.daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_requests INTEGER NOT NULL DEFAULT 0,
  pending_requests INTEGER NOT NULL DEFAULT 0,
  completed_requests INTEGER NOT NULL DEFAULT 0,
  avg_feedback_score NUMERIC(3,2),
  total_feedbacks INTEGER NOT NULL DEFAULT 0,
  request_breakdown JSONB DEFAULT '{}',
  ai_summary TEXT,
  ai_suggestions JSONB DEFAULT '[]',
  generated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(boat_id, report_date)
);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage all reports" ON public.daily_reports
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Assigned staff can view reports" ON public.daily_reports
  FOR SELECT TO authenticated
  USING (is_assigned_to_boat(auth.uid(), boat_id));

CREATE POLICY "Assigned staff can insert reports" ON public.daily_reports
  FOR INSERT TO authenticated
  WITH CHECK (is_assigned_to_boat(auth.uid(), boat_id));
