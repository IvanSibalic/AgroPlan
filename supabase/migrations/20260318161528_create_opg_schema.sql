/*
  # OPG (Obiteljsko Poljoprivredno Gospodarstvo) Schema

  ## Tablice

  ### parcels (parcele)
  - `id` (uuid, primarni ključ)
  - `name` (text) - naziv parcele
  - `arkod_id` (text) - ARKOD identifikacijski broj
  - `crop_type` (text) - vrsta usjeva
  - `area` (numeric) - površina u hektarima
  - `geometry` (jsonb) - GeoJSON poligon s granicama parcele
  - `user_id` (uuid) - vlasnik
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### activities (aktivnosti)
  - `id` (uuid, primarni ključ)
  - `parcel_id` (uuid) - referenca na parcelu
  - `activity_type` (text) - vrsta aktivnosti (sjetva, gnojidba, zaštita, žetva)
  - `date` (date) - datum izvođenja
  - `worker_name` (text) - ime radnika
  - `machinery` (text) - korištena mehanizacija
  - `materials` (jsonb) - korišteni materijali (array of {name, quantity, unit})
  - `notes` (text) - napomene
  - `user_id` (uuid)
  - `created_at` (timestamptz)

  ### inventory (zalihe)
  - `id` (uuid, primarni ključ)
  - `category` (text) - kategorija (sjeme, gnojivo, zaštita, gorivo)
  - `name` (text) - naziv proizvoda
  - `quantity` (numeric) - količina
  - `unit` (text) - mjerna jedinica (kg, l, kom)
  - `min_quantity` (numeric) - minimalna količina za upozorenje
  - `user_id` (uuid)
  - `updated_at` (timestamptz)

  ### team_members (clanovi_tima)
  - `id` (uuid, primarni ključ)
  - `opg_id` (uuid) - glavni korisnik/OPG
  - `name` (text) - ime člana
  - `email` (text) - email
  - `role` (text) - uloga (vlasnik, član, radnik)
  - `invited_at` (timestamptz)
  - `joined_at` (timestamptz)

  ## Sigurnost
  - Omogući RLS na svim tablicama
  - Korisnici mogu vidjeti samo svoje podatke
*/

-- Enable PostGIS extension for GeoJSON support
CREATE EXTENSION IF NOT EXISTS postgis;

-- Parcels table
CREATE TABLE IF NOT EXISTS parcels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  arkod_id text NOT NULL,
  crop_type text NOT NULL,
  area numeric NOT NULL DEFAULT 0,
  geometry jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own parcels"
  ON parcels FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own parcels"
  ON parcels FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own parcels"
  ON parcels FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own parcels"
  ON parcels FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id uuid REFERENCES parcels(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  worker_name text NOT NULL,
  machinery text,
  materials jsonb DEFAULT '[]'::jsonb,
  notes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activities"
  ON activities FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activities"
  ON activities FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own activities"
  ON activities FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL,
  min_quantity numeric DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inventory"
  ON inventory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own inventory"
  ON inventory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own inventory"
  ON inventory FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own inventory"
  ON inventory FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opg_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'član',
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own team"
  ON team_members FOR SELECT
  TO authenticated
  USING (auth.uid() = opg_id);

CREATE POLICY "Users can insert own team members"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = opg_id);

CREATE POLICY "Users can update own team members"
  ON team_members FOR UPDATE
  TO authenticated
  USING (auth.uid() = opg_id)
  WITH CHECK (auth.uid() = opg_id);

CREATE POLICY "Users can delete own team members"
  ON team_members FOR DELETE
  TO authenticated
  USING (auth.uid() = opg_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_parcels_user_id ON parcels(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_parcel_id ON activities(parcel_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_team_members_opg_id ON team_members(opg_id);
