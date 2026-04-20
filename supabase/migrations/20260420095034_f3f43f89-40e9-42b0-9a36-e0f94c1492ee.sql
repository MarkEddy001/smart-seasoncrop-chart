
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'field_agent');
CREATE TYPE public.field_stage AS ENUM ('Planted', 'Growing', 'Ready', 'Harvested');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Fields
CREATE TABLE public.fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  crop_type TEXT NOT NULL,
  location TEXT,
  size_hectares NUMERIC(10,2),
  planting_date DATE NOT NULL,
  stage public.field_stage NOT NULL DEFAULT 'Planted',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;

-- Field updates (audit trail of stage changes & notes)
CREATE TABLE public.field_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_stage public.field_stage,
  new_stage public.field_stage,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.field_updates ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles policies (read own; admins read all)
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fields policies
CREATE POLICY "Admins view all fields" ON public.fields
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents view assigned fields" ON public.fields
  FOR SELECT TO authenticated USING (assigned_to = auth.uid());
CREATE POLICY "Admins insert fields" ON public.fields
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update any field" ON public.fields
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents update assigned field stage" ON public.fields
  FOR UPDATE TO authenticated USING (assigned_to = auth.uid()) WITH CHECK (assigned_to = auth.uid());
CREATE POLICY "Admins delete fields" ON public.fields
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Field updates policies
CREATE POLICY "Admins view all updates" ON public.field_updates
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents view updates on assigned fields" ON public.field_updates
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.fields f WHERE f.id = field_id AND f.assigned_to = auth.uid())
  );
CREATE POLICY "Authors insert updates on permitted fields" ON public.field_updates
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = author_id AND (
      public.has_role(auth.uid(), 'admin') OR
      EXISTS (SELECT 1 FROM public.fields f WHERE f.id = field_id AND f.assigned_to = auth.uid())
    )
  );

-- Touch fields.last_updated_at on update
CREATE OR REPLACE FUNCTION public.touch_field_last_updated()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.last_updated_at = now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_fields_touch BEFORE UPDATE ON public.fields
  FOR EACH ROW EXECUTE FUNCTION public.touch_field_last_updated();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Computed status function (server-side source of truth)
CREATE OR REPLACE FUNCTION public.field_status(_stage public.field_stage, _planting_date DATE, _last_updated TIMESTAMPTZ)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE
    WHEN _stage = 'Harvested' THEN 'Completed'
    WHEN (_stage IN ('Growing','Ready'))
         AND ((CURRENT_DATE - _planting_date) > 100 OR (now() - _last_updated) > INTERVAL '10 days')
      THEN 'At Risk'
    ELSE 'Active'
  END;
$$;
