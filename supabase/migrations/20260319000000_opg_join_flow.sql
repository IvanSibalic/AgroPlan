/*
  # OPG Join Flow Migration

  1. Add kod_pristupa to opg_profili
  2. Create zahtjevi_pristupa table (join requests)
  3. RLS policies for new table
  4. Update handle_new_user_signup — no longer auto-creates OPG
  5. New RPC functions: create_opg, get_opg_by_code, request_join_opg,
     approve_join_request, reject_join_request
*/

-- ============================================================
-- 1. ADD kod_pristupa TO opg_profili
-- ============================================================

ALTER TABLE opg_profili
  ADD COLUMN IF NOT EXISTS kod_pristupa text UNIQUE;

-- ============================================================
-- 2. ZAHTJEVI_PRISTUPA TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS zahtjevi_pristupa (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  opg_id      uuid NOT NULL REFERENCES opg_profili(id) ON DELETE CASCADE,
  korisnik_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puno_ime    text NOT NULL,
  status      text NOT NULL DEFAULT 'na_cekanju'
                CHECK (status IN ('na_cekanju', 'odobreno', 'odbijeno')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(opg_id, korisnik_id)
);

ALTER TABLE zahtjevi_pristupa ENABLE ROW LEVEL SECURITY;

-- Vlasnik vidi zahtjeve za svoj OPG; korisnik vidi vlastiti zahtjev
CREATE POLICY "Vlasnik i korisnik vide zahtjev"
  ON zahtjevi_pristupa FOR SELECT TO authenticated
  USING (
    korisnik_id = auth.uid()
    OR opg_id IN (SELECT id FROM opg_profili WHERE vlasnik_id = auth.uid())
  );

-- Korisnik može kreirati vlastiti zahtjev
CREATE POLICY "Korisnik kreira zahtjev"
  ON zahtjevi_pristupa FOR INSERT TO authenticated
  WITH CHECK (korisnik_id = auth.uid());

-- Vlasnik OPG-a može ažurirati status zahtjeva
CREATE POLICY "Vlasnik ažurira zahtjev"
  ON zahtjevi_pristupa FOR UPDATE TO authenticated
  USING (opg_id IN (SELECT id FROM opg_profili WHERE vlasnik_id = auth.uid()))
  WITH CHECK (opg_id IN (SELECT id FROM opg_profili WHERE vlasnik_id = auth.uid()));

-- ============================================================
-- 3. ADD INSERT POLICY FOR opg_profili
-- ============================================================

-- Korisnik može kreirati OPG ako je vlasnik (za RPC SECURITY DEFINER ovo
-- nije potrebno, ali dobra je praksa imati i direktnu politiku)
DO $$ BEGIN
  CREATE POLICY "Korisnik kreira vlastiti OPG"
    ON opg_profili FOR INSERT TO authenticated
    WITH CHECK (vlasnik_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 4. UPDATE handle_new_user_signup — VIŠE NE KREIRA OPG
--    Korisnik mora odabrati OPG nakon registracije
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, puno_ime, uloga)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'puno_ime', NEW.email),
    'clan'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. RPC: create_opg — kreira OPG i ažurira profil vlasnika
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

  -- Ažuriraj profil korisnika
  UPDATE profiles
  SET opg_id = v_opg_id, uloga = 'vlasnik'
  WHERE id = auth.uid();

  RETURN v_opg_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_opg(text, text) TO authenticated;

-- ============================================================
-- 6. RPC: get_opg_by_code — pregled OPG-a po kodu
-- ============================================================

CREATE OR REPLACE FUNCTION get_opg_by_code(p_kod text)
RETURNS TABLE(id uuid, naziv text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, naziv
  FROM opg_profili
  WHERE kod_pristupa = upper(trim(p_kod));
$$;

GRANT EXECUTE ON FUNCTION get_opg_by_code(text) TO authenticated;

-- ============================================================
-- 7. RPC: request_join_opg — zahtjev za pridruživanje
-- ============================================================

CREATE OR REPLACE FUNCTION request_join_opg(p_kod text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opg_id     uuid;
  v_zahtjev_id uuid;
  v_puno_ime   text;
BEGIN
  -- Pronađi OPG po kodu
  SELECT id INTO v_opg_id
  FROM opg_profili
  WHERE kod_pristupa = upper(trim(p_kod));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nevažeći kod pristupa';
  END IF;

  -- Ime podnositelja zahtjeva
  SELECT puno_ime INTO v_puno_ime
  FROM profiles WHERE id = auth.uid();

  -- Unesi ili osvježi zahtjev
  INSERT INTO zahtjevi_pristupa (opg_id, korisnik_id, puno_ime, status)
  VALUES (v_opg_id, auth.uid(), COALESCE(v_puno_ime, 'Nepoznati korisnik'), 'na_cekanju')
  ON CONFLICT (opg_id, korisnik_id) DO UPDATE
    SET status = 'na_cekanju', created_at = now()
  RETURNING id INTO v_zahtjev_id;

  RETURN v_zahtjev_id;
END;
$$;

GRANT EXECUTE ON FUNCTION request_join_opg(text) TO authenticated;

-- ============================================================
-- 8. RPC: approve_join_request
-- ============================================================

CREATE OR REPLACE FUNCTION approve_join_request(p_zahtjev_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zahtjev     zahtjevi_pristupa;
  v_opg_vlasnik uuid;
BEGIN
  SELECT * INTO v_zahtjev FROM zahtjevi_pristupa WHERE id = p_zahtjev_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Zahtjev nije pronađen'; END IF;

  SELECT vlasnik_id INTO v_opg_vlasnik FROM opg_profili WHERE id = v_zahtjev.opg_id;
  IF v_opg_vlasnik IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Samo vlasnik OPG-a može odobriti zahtjev';
  END IF;

  -- Ažuriraj profil korisnika
  UPDATE profiles
  SET opg_id = v_zahtjev.opg_id, uloga = 'clan'
  WHERE id = v_zahtjev.korisnik_id;

  -- Označi zahtjev kao odobren
  UPDATE zahtjevi_pristupa SET status = 'odobreno' WHERE id = p_zahtjev_id;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_join_request(uuid) TO authenticated;

-- ============================================================
-- 9. RPC: reject_join_request
-- ============================================================

CREATE OR REPLACE FUNCTION reject_join_request(p_zahtjev_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zahtjev     zahtjevi_pristupa;
  v_opg_vlasnik uuid;
BEGIN
  SELECT * INTO v_zahtjev FROM zahtjevi_pristupa WHERE id = p_zahtjev_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Zahtjev nije pronađen'; END IF;

  SELECT vlasnik_id INTO v_opg_vlasnik FROM opg_profili WHERE id = v_zahtjev.opg_id;
  IF v_opg_vlasnik IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Samo vlasnik OPG-a može odbiti zahtjev';
  END IF;

  UPDATE zahtjevi_pristupa SET status = 'odbijeno' WHERE id = p_zahtjev_id;
END;
$$;

GRANT EXECUTE ON FUNCTION reject_join_request(uuid) TO authenticated;

-- ============================================================
-- 10. INDEKSI
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_zahtjevi_opg_id      ON zahtjevi_pristupa(opg_id);
CREATE INDEX IF NOT EXISTS idx_zahtjevi_korisnik_id ON zahtjevi_pristupa(korisnik_id);
CREATE INDEX IF NOT EXISTS idx_zahtjevi_status      ON zahtjevi_pristupa(status);
CREATE INDEX IF NOT EXISTS idx_opg_kod_pristupa     ON opg_profili(kod_pristupa);
