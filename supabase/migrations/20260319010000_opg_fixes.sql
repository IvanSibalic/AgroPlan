/*
  # Popravci OPG sustava

  1. Dodaj 'radnik' ulogu u profiles constraint
  2. Popravi create_opg — koristi UPSERT za profiles (robusnije)
  3. Dodaj update_team_member RPC (vlasnik može mijenjati ime/ulogu članova)
  4. Dodaj vlasnik policy za UPDATE na profiles
*/

-- ============================================================
-- 1. DODAJ 'radnik' ULOGU
-- ============================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_uloga_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_uloga_check
  CHECK (uloga IN ('vlasnik', 'clan', 'radnik'));

-- ============================================================
-- 2. POPRAVI create_opg — UPSERT profila
-- ============================================================

CREATE OR REPLACE FUNCTION create_opg(p_naziv text, p_oib text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opg_id uuid;
  v_kod    text;
  v_chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i        int;
BEGIN
  -- Provjeri da korisnik već nema OPG
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND opg_id IS NOT NULL) THEN
    SELECT opg_id INTO v_opg_id FROM profiles WHERE id = auth.uid();
    RETURN v_opg_id;
  END IF;

  -- Generiraj jedinstven 8-znakovni kod pristupa
  LOOP
    v_kod := '';
    FOR i IN 1..8 LOOP
      v_kod := v_kod || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM opg_profili WHERE kod_pristupa = v_kod);
  END LOOP;

  -- Kreiraj OPG
  INSERT INTO opg_profili (naziv, oib, vlasnik_id, kod_pristupa)
  VALUES (p_naziv, NULLIF(p_oib, ''), auth.uid(), v_kod)
  RETURNING id INTO v_opg_id;

  -- UPSERT profila — kreira ako ne postoji, inače ažurira
  INSERT INTO profiles (id, opg_id, puno_ime, uloga)
  VALUES (
    auth.uid(),
    v_opg_id,
    COALESCE((SELECT puno_ime FROM profiles WHERE id = auth.uid()), 'Vlasnik'),
    'vlasnik'
  )
  ON CONFLICT (id) DO UPDATE
    SET opg_id = v_opg_id, uloga = 'vlasnik';

  RETURN v_opg_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_opg(text, text) TO authenticated;

-- ============================================================
-- 3. RPC: update_team_member (ime i uloga)
--    Vlasnik može mijenjati ime i ulogu članova svog OPG-a
-- ============================================================

CREATE OR REPLACE FUNCTION update_team_member(
  p_id       uuid,
  p_puno_ime text    DEFAULT NULL,
  p_uloga    text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_opg  uuid;
  v_caller_role text;
  v_target_opg  uuid;
BEGIN
  -- Dohvati OPG i ulogu pozivatelja
  SELECT opg_id, uloga INTO v_caller_opg, v_caller_role
  FROM profiles WHERE id = auth.uid();

  -- Dohvati OPG cilja
  SELECT opg_id INTO v_target_opg FROM profiles WHERE id = p_id;

  -- Provjera: cilj je u istom OPG-u i pozivatelj je vlasnik
  -- (ili korisnik mijenja vlastiti profil)
  IF p_id != auth.uid() THEN
    IF v_caller_role != 'vlasnik' OR v_caller_opg IS DISTINCT FROM v_target_opg THEN
      RAISE EXCEPTION 'Samo vlasnik OPG-a može mijenjati profile članova';
    END IF;
  END IF;

  -- Zaštita: vlasnik ne može skinuti sebe s uloge vlasnika
  IF p_id = auth.uid() AND p_uloga IS NOT NULL AND p_uloga != 'vlasnik' THEN
    RAISE EXCEPTION 'Vlasnik ne može promijeniti vlastitu ulogu';
  END IF;

  -- Ažuriraj
  UPDATE profiles
  SET
    puno_ime = COALESCE(p_puno_ime, puno_ime),
    uloga    = COALESCE(p_uloga, uloga)
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_team_member(uuid, text, text) TO authenticated;

-- ============================================================
-- 4. POLITIKA: Vlasnik može ažurirati profile članova
-- ============================================================

DO $$ BEGIN
  CREATE POLICY "Vlasnik ažurira profile članova"
    ON profiles FOR UPDATE TO authenticated
    USING (
      opg_id IN (SELECT id FROM opg_profili WHERE vlasnik_id = auth.uid())
    )
    WITH CHECK (
      opg_id IN (SELECT id FROM opg_profili WHERE vlasnik_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
