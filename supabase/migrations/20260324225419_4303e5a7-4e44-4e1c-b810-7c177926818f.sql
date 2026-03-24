
-- Create request category enum
CREATE TYPE public.request_category AS ENUM (
  'towels', 'help_opening_room', 'cleaning', 'bathroom_service',
  'do_not_disturb', 'drinks', 'custom'
);

-- Create request status enum
CREATE TYPE public.request_status AS ENUM ('pending', 'in_progress', 'done');

-- Guest sessions table (tracks guest language per room visit)
CREATE TABLE public.guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
  room_number INTEGER NOT NULL,
  guest_language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for guests (no auth required)
CREATE POLICY "Anyone can create guest sessions" ON public.guest_sessions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can view guest sessions" ON public.guest_sessions
  FOR SELECT TO anon, authenticated USING (true);

-- Requests table
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
  room_number INTEGER NOT NULL,
  category request_category NOT NULL,
  original_message TEXT,
  translated_message TEXT,
  guest_language TEXT NOT NULL DEFAULT 'en',
  status request_status NOT NULL DEFAULT 'pending',
  guest_session_id UUID REFERENCES public.guest_sessions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Guests can create requests (anon)
CREATE POLICY "Anyone can create requests" ON public.requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Staff can view requests for their boats
CREATE POLICY "Owners can view all requests" ON public.requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Assigned users can view requests" ON public.requests
  FOR SELECT TO authenticated USING (public.is_assigned_to_boat(auth.uid(), boat_id));

-- Staff can update request status
CREATE POLICY "Owners can update requests" ON public.requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Assigned staff can update requests" ON public.requests
  FOR UPDATE TO authenticated USING (
    public.is_assigned_to_boat(auth.uid(), boat_id)
  );

-- Translation logs table
CREATE TABLE public.translation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL DEFAULT 'en',
  provider TEXT NOT NULL DEFAULT 'deepseek',
  confidence_score REAL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.translation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view translation logs" ON public.translation_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can insert translation logs" ON public.translation_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Update timestamp trigger for requests
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
