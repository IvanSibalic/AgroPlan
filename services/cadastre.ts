/**
 * Katastar servis — koristi Supabase Edge Function kao proxy
 *
 * Edge Function (katastar-proxy) rješava CORS problem
 * i poziva DGU / ARKOD API-je server-to-server.
 *
 * Deploy Edge Function:
 *   npx supabase functions deploy katastar-proxy
 */

const EDGE_FN_URL =
  `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/katastar-proxy`;

const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export interface KatastarResult {
  arkod_id?: string;
  cestica_broj?: string;
  kat_opcina?: string;
  naziv_kulture?: string | null;
  povrsina_ha: number;
  geometry?: {
    type: string;
    coordinates: number[][][] | number[][][][];
  } | null;
  source: 'arkod' | 'dgu' | 'dgu_inspire';
}

// ─── Pomoćna funkcija za poziv Edge Function ───────────────

async function callProxy(
  type: 'arkod' | 'cestica',
  params: Record<string, string>
): Promise<KatastarResult> {
  const res = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({ type, params }),
  });

  const json = await res.json() as { ok: boolean; data?: KatastarResult; error?: string };

  if (!json.ok) {
    throw new Error(json.error ?? 'Nepoznata greška pri pretraži.');
  }

  return json.data!;
}

// ─── Javne funkcije ────────────────────────────────────────

/**
 * Pretraži ARKOD parcelu po šifri (npr. "HR-12345678-01")
 */
export async function searchArkodById(arkodId: string): Promise<KatastarResult> {
  return callProxy('arkod', { arkodId: arkodId.trim().toUpperCase() });
}

/**
 * Pretraži katastarsku česticu
 * @param opcina  Puni naziv s kodom, npr. "332151 NIJEMCI"
 * @param cestica Broj čestice, npr. "1786"
 */
export async function searchByCestica(
  opcina: string,
  cestica: string
): Promise<KatastarResult> {
  return callProxy('cestica', {
    opcina: opcina.trim().toUpperCase(),
    cestica: cestica.trim(),
  });
}

/**
 * Mapira naziv kulture iz katastra u standardni naziv
 */
export function mapKulturaToType(naziv?: string | null): string {
  if (!naziv) return '';
  const n = naziv.toLowerCase();
  if (n.includes('kukuruz'))                        return 'Kukuruz';
  if (n.includes('pšenica') || n.includes('psenica')) return 'Pšenica';
  if (n.includes('ječam')   || n.includes('jecam'))   return 'Ječam';
  if (n.includes('suncokret'))                      return 'Suncokret';
  if (n.includes('soja'))                           return 'Soja';
  if (n.includes('uljana')  || n.includes('repica')) return 'Repica';
  if (n.includes('voćnjak') || n.includes('vocnjak')) return 'Voćnjak';
  if (n.includes('vinograd'))                       return 'Vinograd';
  if (n.includes('livada')  || n.includes('pašnjak')) return 'Livada';
  if (n.includes('povrće')  || n.includes('povrce'))  return 'Povrće';
  if (n.includes('šuma')    || n.includes('suma'))    return 'Šuma';
  if (n.includes('oranica') || n.includes('njiva'))   return 'Oranica';
  return naziv;
}
