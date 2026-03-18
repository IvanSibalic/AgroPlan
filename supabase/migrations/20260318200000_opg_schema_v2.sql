/*
  # AgroPlan — Kompletna OPG Shema v2

  Redoslijed izvršavanja:
  1. Extensions
  2. Cleanup (stare tablice/funkcije)
  3. Kreiranje SVIH tablica (bez politika)
  4. Enable RLS + sve politike
  5. Helper funkcija get_user_opg_id()
  6. View v_parcele + RPC insert_parcela
  7. Triggeri
  8. Indeksi
*/

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. CLEANUP
-- ============================================================

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trigger_deduct_skladiste ON dnevnik_rada;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DROP FUNCTION IF EXISTS deduct_skladiste_on_dnevnik_insert() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user_signup() CASCADE;
DROP FUNCTION IF EXISTS get_user_opg_id() CASCADE;
DROP FUNCTION IF EXISTS insert_parcela(text, text, text, numeric, text) CASCADE;
DROP VIEW  IF EXISTS v_parcele;

DROP TABLE IF EXISTS dnevnik_rada  CASCADE;
DROP TABLE IF EXISTS skladiste     CASCADE;
DROP TABLE IF EXISTS parcele       CASCADE;
DROP TABLE IF EXISTS profiles      CASCADE;
DROP TABLE IF EXISTS opg_profili   CASCADE;

-- Stare English tablice
DROP TABLE IF EXISTS activities    CASCADE;
DROP TABLE IF EXISTS inventory     CASCADE;
DROP TABLE IF EXISTS team_members  CASCADE;
DROP TABLE IF EXISTS parcels       CASCADE;

-- ============================================================
-- 3. KREIRANJE TABLICA (sve tablice prije ikakvih politika)
-- ============================================================

CREATE TABLE opg_profili (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  naziv       text NOT NULL,
  oib         text,
  vlasnik_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  opg_id     uuid REFERENCES opg_profili(id) ON DELETE SET NULL,
  puno_ime   text NOT NULL,
  uloga      text NOT NULL DEFAULT 'clan'
               CHECK (uloga IN ('vlasnik', 'clan')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE parcele (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  opg_id      uuid NOT NULL REFERENCES opg_profili(id) ON DELETE CASCADE,
  naziv       text NOT NULL,
  arkod_id    text,
  kultura     text,
  povrsina    numeric NOT NULL DEFAULT 0,
  geometrija  geometry(Polygon, 4326),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE skladiste (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  opg_id          uuid NOT NULL REFERENCES opg_profili(id) ON DELETE CASCADE,
  tip             text NOT NULL
                    CHECK (tip IN ('sjeme', 'gnojivo', 'zaštita', 'gorivo')),
  naziv           text NOT NULL,
  kolicina        numeric NOT NULL DEFAULT 0,
  mjerna_jedinica text NOT NULL DEFAULT 'kom',
  min_kolicina    numeric DEFAULT 0,
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE dnevnik_rada (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  opg_id              uuid NOT NULL REFERENCES opg_profili(id) ON DELETE CASCADE,
  parcela_id          uuid REFERENCES parcele(id) ON DELETE SET NULL,
  korisnik_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aktivnost           text NOT NULL,
  kolicina_materijala numeric,
  materijal_id        uuid REFERENCES skladiste(id) ON DELETE SET NULL,
  datum               date NOT NULL DEFAULT CURRENT_DATE,
  mehanizacija        text,
  napomene            text,
  materijali          jsonb DEFAULT '[]'::jsonb,
  created_at          timestamptz DEFAULT now()
);

-- ============================================================
-- 4. RLS POLITIKE
--    (sve tablice postoje — nema grešaka s referencama)
-- ============================================================

ALTER TABLE opg_profili  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcele      ENABLE ROW LEVEL SECURITY;
ALTER TABLE skladiste    ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnevnik_rada ENABLE ROW LEVEL SECURITY;

-- opg_profili
CREATE POLICY "Korisnici vide vlastiti OPG"
  ON opg_profili FOR SELECT TO authenticated
  USING (
    id = (SELECT opg_id FROM profiles WHERE id = auth.uid())
    OR vlasnik_id = auth.uid()
  );

CREATE POLICY "Vlasnik ažurira OPG"
  ON opg_profili FOR UPDATE TO authenticated
  USING (vlasnik_id = auth.uid())
  WITH CHECK (vlasnik_id = auth.uid());

-- profiles
CREATE POLICY "Profili unutar OPG-a su vidljivi"
  ON profiles FOR SELECT TO authenticated
  USING (
    opg_id = (SELECT opg_id FROM profiles p WHERE p.id = auth.uid())
    OR id = auth.uid()
  );

CREATE POLICY "Korisnik mijenja vlastiti profil"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Korisnik kreira vlastiti profil"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- parcele
CREATE POLICY "Članovi OPG-a vide parcele"
  ON parcele FOR SELECT TO authenticated
  USING (opg_id = (SELECT opg_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Članovi OPG-a dodaju parcele"
  ON parcele FOR INSERT TO authenticated
  WITH CHECK (opg_id = (SELECT opg_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Članovi OPG-a mijenjaju parcele"
  ON parcele FOR UPDATE TO authenticated
  USING (opg_id = (SELECT opg_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (opg_id = (SELECT opg_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Članovi OPG-a brišu parcele"
  ON parcele FOR DELETE TO authenticated
  USING (opg_id = (SELECT opg_id FROM profiles WHERE id = auth.uid()));

-- skladiste
CREATE POLICY "Članovi OPG-a vide skladište"
  ON skladiste FOR SELECT TO authenticated
  USING (opg_id = (SELECT opg_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Članovi OPG-a dodaju u skladište"
  ON skladiste FOR INSERT TO authenticated
  WITH CHECK (opg_id = (SELECT opg_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Članovi OPG-a mijenjaju skladište"
  ON skladiste FOR UPDATE TO authenticated
  USING (opg_id = (SELECT opg_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (opg_id = (SELECT opg_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Članovi OPG-a brišu iz skladišta"
  ON skladiste FOR DELETE TO authenticated
  USING (opg_id = (SELECT opg_id FROM profiles WHERE id = auth.uid()));

-- dnevnik_rada
CREATE POLICY "Članovi OPG-a vide dnevnik"
  ON dnevnik_rada FOR SELECT TO authenticated
  USING (opg_id = (SELECT opg_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Članovi OPG-a dodaju u dnevnik"
  ON dnevnik_rada FOR INSERT TO authenticated
  WITH CHECK (opg_id = (SELECT opg_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Članovi OPG-a mijenjaju dnevnik"
  ON dnevnik_rada FOR UPDATE TO authenticated
  USING (opg_id = (SELECT opg_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (opg_id = (SELECT opg_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Članovi OPG-a brišu iz dnevnika"
  ON dnevnik_rada FOR DELETE TO authenticated
  USING (opg_id = (SELECT opg_id FROM profiles WHERE id = auth.uid()));

-- ============================================================
-- 5. HELPER FUNKCIJA
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_opg_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT opg_id FROM profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- 6. VIEW + RPC ZA PARCELE S GEOJSON
-- ============================================================

CREATE OR REPLACE VIEW v_parcele
  WITH (security_invoker = on)
AS
SELECT
  id,
  opg_id,
  naziv,
  arkod_id,
  kultura,
  povrsina,
  CASE
    WHEN geometrija IS NOT NULL THEN ST_AsGeoJSON(geometrija)::jsonb
    ELSE NULL
  END AS geometrija,
  created_at,
  updated_at
FROM parcele;

GRANT SELECT ON v_parcele TO authenticated;

CREATE OR REPLACE FUNCTION insert_parcela(
  p_naziv     text,
  p_arkod_id  text    DEFAULT NULL,
  p_kultura   text    DEFAULT NULL,
  p_povrsina  numeric DEFAULT 0,
  p_geojson   text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_opg_id uuid;
  v_id     uuid;
BEGIN
  v_opg_id := get_user_opg_id();
  IF v_opg_id IS NULL THEN
    RAISE EXCEPTION 'Korisnik nije povezan s OPG-om';
  END IF;

  INSERT INTO parcele (opg_id, naziv, arkod_id, kultura, povrsina, geometrija)
  VALUES (
    v_opg_id,
    p_naziv,
    p_arkod_id,
    p_kultura,
    p_povrsina,
    CASE WHEN p_geojson IS NOT NULL AND p_geojson != ''
         THEN ST_GeomFromGeoJSON(p_geojson)
         ELSE NULL
    END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================
-- 7. TRIGGERI
-- ============================================================

-- 7a. Umanjivanje zaliha pri unosu u dnevnik rada
CREATE OR REPLACE FUNCTION deduct_skladiste_on_dnevnik_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.materijal_id IS NOT NULL
     AND NEW.kolicina_materijala IS NOT NULL
     AND NEW.kolicina_materijala > 0 THEN

    UPDATE skladiste
    SET
      kolicina   = GREATEST(kolicina - NEW.kolicina_materijala, 0),
      updated_at = now()
    WHERE id = NEW.materijal_id
      AND opg_id = NEW.opg_id;

    IF NOT FOUND THEN
      RAISE WARNING 'Materijal % nije pronađen u skladištu OPG-a %',
        NEW.materijal_id, NEW.opg_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_deduct_skladiste
  AFTER INSERT ON dnevnik_rada
  FOR EACH ROW
  EXECUTE FUNCTION deduct_skladiste_on_dnevnik_insert();

-- 7b. Automatsko kreiranje OPG profila pri registraciji
--     signUp šalje metadata: { naziv_opg, oib, puno_ime }
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opg_id uuid;
BEGIN
  INSERT INTO opg_profili (naziv, oib, vlasnik_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'naziv_opg', 'Moj OPG'),
    NULLIF(NEW.raw_user_meta_data->>'oib', ''),
    NEW.id
  )
  RETURNING id INTO v_opg_id;

  INSERT INTO profiles (id, opg_id, puno_ime, uloga)
  VALUES (
    NEW.id,
    v_opg_id,
    COALESCE(NEW.raw_user_meta_data->>'puno_ime', NEW.email),
    'vlasnik'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_signup();

-- ============================================================
-- 8. INDEKSI
-- ============================================================

CREATE INDEX idx_profiles_opg_id      ON profiles(opg_id);
CREATE INDEX idx_parcele_opg_id       ON parcele(opg_id);
CREATE INDEX idx_parcele_geometrija   ON parcele USING GIST(geometrija);
CREATE INDEX idx_skladiste_opg_id     ON skladiste(opg_id);
CREATE INDEX idx_skladiste_tip        ON skladiste(tip);
CREATE INDEX idx_dnevnik_opg_id       ON dnevnik_rada(opg_id);
CREATE INDEX idx_dnevnik_parcela_id   ON dnevnik_rada(parcela_id);
CREATE INDEX idx_dnevnik_datum        ON dnevnik_rada(datum);
CREATE INDEX idx_dnevnik_materijal_id ON dnevnik_rada(materijal_id);
