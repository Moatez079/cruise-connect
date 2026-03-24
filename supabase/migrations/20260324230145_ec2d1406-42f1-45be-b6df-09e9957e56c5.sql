
-- Invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('draft', 'visible', 'paid', 'closed');

-- Invoice categories for line items
CREATE TYPE public.invoice_category AS ENUM ('restaurant', 'bar', 'massage', 'internet', 'room_service', 'custom');

-- Invoices table (one per room per stay)
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
  room_number INTEGER NOT NULL,
  guest_language TEXT NOT NULL DEFAULT 'en',
  currency TEXT NOT NULL DEFAULT 'USD',
  status invoice_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  farewell_message TEXT DEFAULT 'Thank you for sailing with us! We hope you had a wonderful experience and look forward to welcoming you aboard again.',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Invoice line items
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  category invoice_category NOT NULL DEFAULT 'custom',
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS for invoices: staff can manage, guests can view when visible
CREATE POLICY "Owners can manage all invoices" ON public.invoices
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Assigned staff can manage invoices" ON public.invoices
  FOR ALL TO authenticated USING (public.is_assigned_to_boat(auth.uid(), boat_id));

CREATE POLICY "Guests can view visible invoices" ON public.invoices
  FOR SELECT TO anon USING (status IN ('visible', 'paid', 'closed'));

-- RLS for invoice items
CREATE POLICY "Owners can manage all items" ON public.invoice_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.has_role(auth.uid(), 'owner'))
  );

CREATE POLICY "Assigned staff can manage items" ON public.invoice_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.is_assigned_to_boat(auth.uid(), i.boat_id))
  );

CREATE POLICY "Guests can view visible invoice items" ON public.invoice_items
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.status IN ('visible', 'paid', 'closed'))
  );

-- Triggers
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoice_items_updated_at BEFORE UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
