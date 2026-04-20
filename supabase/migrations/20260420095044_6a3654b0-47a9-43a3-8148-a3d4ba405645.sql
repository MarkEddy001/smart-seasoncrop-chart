
CREATE OR REPLACE FUNCTION public.field_status(_stage public.field_stage, _planting_date DATE, _last_updated TIMESTAMPTZ)
RETURNS TEXT LANGUAGE SQL IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _stage = 'Harvested' THEN 'Completed'
    WHEN (_stage IN ('Growing','Ready'))
         AND ((CURRENT_DATE - _planting_date) > 100 OR (now() - _last_updated) > INTERVAL '10 days')
      THEN 'At Risk'
    ELSE 'Active'
  END;
$$;
