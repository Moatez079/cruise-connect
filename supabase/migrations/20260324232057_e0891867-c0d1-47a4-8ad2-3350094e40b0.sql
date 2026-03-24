
-- Create menu_items table for drink/beverage items per boat
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id uuid NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_ar text,
  price numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'drinks',
  available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Anyone can view menu items (guests need to see them)
CREATE POLICY "Anyone can view menu items"
ON public.menu_items FOR SELECT
TO anon, authenticated
USING (true);

-- Owners can manage all menu items
CREATE POLICY "Owners can manage menu items"
ON public.menu_items FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- Assigned staff can manage menu items for their boats
CREATE POLICY "Assigned staff can manage menu items"
ON public.menu_items FOR ALL
TO authenticated
USING (is_assigned_to_boat(auth.uid(), boat_id));

-- Create storage bucket for menu images
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images', 'menu-images', true);

-- Storage policy for menu images
CREATE POLICY "Anyone can view menu images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'menu-images');

CREATE POLICY "Authenticated users can upload menu images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'menu-images');

CREATE POLICY "Authenticated users can delete menu images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'menu-images');
