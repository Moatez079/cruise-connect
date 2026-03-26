
-- Add qr_token column for secure tokenized QR URLs
ALTER TABLE public.rooms ADD COLUMN qr_token text UNIQUE;

-- Create index for fast token lookups
CREATE INDEX idx_rooms_qr_token ON public.rooms (qr_token) WHERE qr_token IS NOT NULL;

-- Allow anonymous users to look up rooms by token (for guest app)
CREATE POLICY "Anyone can view rooms by token"
ON public.rooms
FOR SELECT
TO anon
USING (qr_token IS NOT NULL);
