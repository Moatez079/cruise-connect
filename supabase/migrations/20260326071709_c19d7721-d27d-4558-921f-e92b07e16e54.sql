
-- Allow owners to update guest_feedback (for pdf_path)
CREATE POLICY "Owners can update feedback"
ON public.guest_feedback
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- Allow assigned staff to update feedback
CREATE POLICY "Assigned staff can update feedback"
ON public.guest_feedback
FOR UPDATE
TO authenticated
USING (is_assigned_to_boat(auth.uid(), boat_id));
