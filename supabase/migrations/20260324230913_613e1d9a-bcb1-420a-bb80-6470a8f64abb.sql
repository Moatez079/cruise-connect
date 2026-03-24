
-- Create boat_settings table for owner customization
CREATE TABLE public.boat_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE UNIQUE,
  farewell_message TEXT NOT NULL DEFAULT 'Thank you for sailing with us! We hope you had a wonderful experience and look forward to welcoming you aboard again.',
  default_currency TEXT NOT NULL DEFAULT 'USD',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1a365d',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.boat_settings ENABLE ROW LEVEL SECURITY;

-- Owners can do everything
CREATE POLICY "Owners can manage all settings" ON public.boat_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));

-- Assigned staff can view settings
CREATE POLICY "Assigned staff can view settings" ON public.boat_settings
  FOR SELECT TO authenticated
  USING (is_assigned_to_boat(auth.uid(), boat_id));

-- Anon can view settings (for guest app branding)
CREATE POLICY "Anyone can view settings" ON public.boat_settings
  FOR SELECT TO anon
  USING (true);

-- Create storage bucket for boat logos
INSERT INTO storage.buckets (id, name, public) VALUES ('boat-logos', 'boat-logos', true);

CREATE POLICY "Authenticated users can upload logos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'boat-logos');

CREATE POLICY "Anyone can view logos" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'boat-logos');

CREATE POLICY "Authenticated users can update logos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'boat-logos');

CREATE POLICY "Authenticated users can delete logos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'boat-logos');

-- Add updated_at trigger
CREATE TRIGGER update_boat_settings_updated_at
  BEFORE UPDATE ON public.boat_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
