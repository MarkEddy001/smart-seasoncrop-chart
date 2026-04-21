
-- 1. Add lat/lng to fields and recent_rainfall_mm cache
ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS recent_rainfall_mm numeric;

-- 2. Update field_status to factor rainfall (drought < 5mm OR flood > 100mm in 7d)
CREATE OR REPLACE FUNCTION public.field_status(
  _stage field_stage,
  _planting_date date,
  _last_updated timestamptz,
  _recent_rainfall_mm numeric DEFAULT NULL
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _stage = 'Harvested' THEN 'Completed'
    WHEN _stage IN ('Growing','Ready') AND (
      (CURRENT_DATE - _planting_date) > 100
      OR (now() - _last_updated) > INTERVAL '10 days'
      OR (_recent_rainfall_mm IS NOT NULL AND _recent_rainfall_mm < 5)
      OR (_recent_rainfall_mm IS NOT NULL AND _recent_rainfall_mm > 100)
    ) THEN 'At Risk'
    ELSE 'Active'
  END;
$$;

-- 3. Signup requests table
CREATE TABLE IF NOT EXISTS public.signup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  requested_role app_role NOT NULL DEFAULT 'field_agent',
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  user_id uuid, -- set after auth user is created on approval
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a signup request"
  ON public.signup_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins view signup requests"
  ON public.signup_requests FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update signup requests"
  ON public.signup_requests FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete signup requests"
  ON public.signup_requests FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 4. Allow admins to insert/delete user_roles already covered via Admins manage roles policy.
-- Allow admins to UPDATE fields.assigned_to and view profiles already covered.

-- 5. Add photo_urls to field_updates
ALTER TABLE public.field_updates
  ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';

-- 6. Storage bucket for field photos (public read; users upload to their own folder)
INSERT INTO storage.buckets (id, name, public)
VALUES ('field-photos', 'field-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Field photos publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'field-photos');

CREATE POLICY "Authenticated upload field photos to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'field-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own field photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'field-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 7. Admins need to insert profiles & user_roles for approved signups.
-- Existing "Admins manage roles" policy covers user_roles. Profiles INSERT only allows self.
CREATE POLICY "Admins insert any profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));
