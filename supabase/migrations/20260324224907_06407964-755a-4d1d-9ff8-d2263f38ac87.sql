
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('owner', 'boat_admin', 'receptionist');

-- Create room status enum
CREATE TYPE public.room_status AS ENUM ('available', 'occupied', 'maintenance', 'do_not_disturb');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  language_preference TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create boats table
CREATE TABLE public.boats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_rooms INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.boats ENABLE ROW LEVEL SECURITY;

-- Create rooms table
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
  room_number INTEGER NOT NULL,
  status room_status NOT NULL DEFAULT 'available',
  qr_code_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (boat_id, room_number)
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Create user_boat_assignments table
CREATE TABLE public.user_boat_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, boat_id)
);

ALTER TABLE public.user_boat_assignments ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Security definer function to check boat assignment
CREATE OR REPLACE FUNCTION public.is_assigned_to_boat(_user_id UUID, _boat_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_boat_assignments
    WHERE user_id = _user_id AND boat_id = _boat_id
  )
  OR EXISTS (
    SELECT 1 FROM public.boats
    WHERE id = _boat_id AND owner_id = _user_id
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "Owners can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Owners can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- RLS Policies for boats
CREATE POLICY "Owners can do everything with boats" ON public.boats
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Assigned users can view their boats" ON public.boats
  FOR SELECT TO authenticated USING (public.is_assigned_to_boat(auth.uid(), id));

-- RLS Policies for rooms
CREATE POLICY "Owners can manage all rooms" ON public.rooms
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'owner')
  );

CREATE POLICY "Assigned users can view rooms of their boats" ON public.rooms
  FOR SELECT TO authenticated USING (
    public.is_assigned_to_boat(auth.uid(), boat_id)
  );

CREATE POLICY "Boat admins can manage rooms of their boats" ON public.rooms
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'boat_admin')
    AND public.is_assigned_to_boat(auth.uid(), boat_id)
  );

-- RLS Policies for user_boat_assignments
CREATE POLICY "Owners can manage assignments" ON public.user_boat_assignments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Users can view own assignments" ON public.user_boat_assignments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Trigger function: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_count INTEGER;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');

  -- Check if this is the first user (becomes owner)
  SELECT COUNT(*) INTO _user_count FROM auth.users;
  IF _user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_boats_updated_at BEFORE UPDATE ON public.boats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
