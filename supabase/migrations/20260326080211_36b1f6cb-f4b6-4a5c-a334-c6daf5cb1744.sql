
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS can_delete_feedback boolean NOT NULL DEFAULT false;

-- Allow owners to delete feedback
CREATE POLICY "Owners can delete feedback"
ON public.guest_feedback
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- Allow assigned staff with can_delete_feedback permission to delete
CREATE POLICY "Staff with permission can delete feedback"
ON public.guest_feedback
FOR DELETE
TO authenticated
USING (
  is_assigned_to_boat(auth.uid(), boat_id)
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND can_delete_feedback = true
  )
);
