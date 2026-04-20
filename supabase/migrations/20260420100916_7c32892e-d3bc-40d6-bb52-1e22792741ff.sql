-- Seed demo users directly into auth.users with bcrypt-hashed passwords
-- Idempotent: only insert if not present
DO $$
DECLARE
  admin_id uuid;
  agent1_id uuid;
  agent2_id uuid;
BEGIN
  -- ADMIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@smartseason.app';
  IF admin_id IS NULL THEN
    admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      'admin@smartseason.app', crypt('Admin123!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Amani Coordinator"}'::jsonb,
      false, '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), admin_id,
      jsonb_build_object('sub', admin_id::text, 'email', 'admin@smartseason.app', 'email_verified', true),
      'email', admin_id::text, now(), now(), now());
  END IF;

  -- AGENT 1
  SELECT id INTO agent1_id FROM auth.users WHERE email = 'agent1@smartseason.app';
  IF agent1_id IS NULL THEN
    agent1_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', agent1_id, 'authenticated', 'authenticated',
      'agent1@smartseason.app', crypt('Agent123!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Wanjiku Field"}'::jsonb,
      false, '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), agent1_id,
      jsonb_build_object('sub', agent1_id::text, 'email', 'agent1@smartseason.app', 'email_verified', true),
      'email', agent1_id::text, now(), now(), now());
  END IF;

  -- AGENT 2
  SELECT id INTO agent2_id FROM auth.users WHERE email = 'agent2@smartseason.app';
  IF agent2_id IS NULL THEN
    agent2_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', agent2_id, 'authenticated', 'authenticated',
      'agent2@smartseason.app', crypt('Agent123!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Otieno Mwangi"}'::jsonb,
      false, '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), agent2_id,
      jsonb_build_object('sub', agent2_id::text, 'email', 'agent2@smartseason.app', 'email_verified', true),
      'email', agent2_id::text, now(), now(), now());
  END IF;

  -- Profiles (handle_new_user trigger should have done this, but ensure)
  INSERT INTO public.profiles (id, full_name, email) VALUES
    (admin_id, 'Amani Coordinator', 'admin@smartseason.app'),
    (agent1_id, 'Wanjiku Field', 'agent1@smartseason.app'),
    (agent2_id, 'Otieno Mwangi', 'agent2@smartseason.app')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

  -- Roles
  INSERT INTO public.user_roles (user_id, role) VALUES
    (admin_id, 'admin'),
    (agent1_id, 'field_agent'),
    (agent2_id, 'field_agent')
  ON CONFLICT DO NOTHING;

  -- Sample fields (only if none exist)
  IF NOT EXISTS (SELECT 1 FROM public.fields LIMIT 1) THEN
    INSERT INTO public.fields (name, crop_type, location, size_hectares, planting_date, stage, assigned_to, created_by) VALUES
      ('Kitale North Plot A', 'Maize',    'Kitale, Trans-Nzoia', 12.5, CURRENT_DATE - 130, 'Ready',     agent1_id, admin_id),
      ('Eldoret Greens',     'Beans',    'Eldoret, Uasin Gishu', 4.2, CURRENT_DATE - 60,  'Growing',   agent1_id, admin_id),
      ('Nyeri Hillside Estate','Coffee', 'Nyeri',                8.0, CURRENT_DATE - 250, 'Harvested', agent1_id, admin_id),
      ('Naivasha Lakeview',  'Tomatoes', 'Naivasha',             2.1, CURRENT_DATE - 35,  'Growing',   agent2_id, admin_id),
      ('Meru Highlands',     'Tea',      'Meru',                15.0, CURRENT_DATE - 110, 'Growing',   agent2_id, admin_id),
      ('Kisumu Riverside',   'Rice',     'Kisumu',               6.5, CURRENT_DATE - 20,  'Planted',   agent2_id, admin_id);
  END IF;
END $$;