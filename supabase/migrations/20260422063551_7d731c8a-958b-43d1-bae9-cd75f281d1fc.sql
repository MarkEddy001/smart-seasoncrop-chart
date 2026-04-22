-- 1. Add column to track pending harvest requests from agents
ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS pending_harvest_at timestamptz;

-- 2. Tighten the agent-update policy so agents cannot directly set stage to 'Harvested'
DROP POLICY IF EXISTS "Agents update assigned field stage" ON public.fields;

CREATE POLICY "Agents update assigned field stage"
  ON public.fields
  FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (
    assigned_to = auth.uid()
    AND stage <> 'Harvested'::field_stage
  );
