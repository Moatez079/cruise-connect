
-- Performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_requests_boat_id_status ON public.requests (boat_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON public.requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_boat_id ON public.rooms (boat_id);
CREATE INDEX IF NOT EXISTS idx_invoices_boat_id_status ON public.invoices (boat_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_guest_feedback_boat_id ON public.guest_feedback (boat_id);
CREATE INDEX IF NOT EXISTS idx_feedback_answers_feedback_id ON public.feedback_answers (feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_questions_boat_id ON public.feedback_questions (boat_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_boat_id ON public.menu_items (boat_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_boat_assignments_user_id ON public.user_boat_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_user_boat_assignments_boat_id ON public.user_boat_assignments (boat_id);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_boat_id ON public.guest_sessions (boat_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_boat_id_date ON public.daily_reports (boat_id, report_date);
