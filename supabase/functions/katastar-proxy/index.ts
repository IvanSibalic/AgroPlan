/**
 * Supabase Edge Function: katastar-proxy
 * Proxy za DGU katastar — rješava CORS, isprobava više endpointa.
 *
 * NAPOMENA O VLASNIŠTVU:
 * Podaci o vlasniku (vlastovnica/posjedovnica) nalaze se u Gruntovnici
 * koja je pod nadležnošću sudova (Ministarstvo pravosuđa), ne DGU-a.
 * Javno dostupni bez autentikacije su: površina, geometrija, kultura.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = await req.json() as { type: string; params: Record<string, string> };

    if (body.type === 'arkod')   return await handleArkod(body.params.arkodId);
    if (body.type === 'cestica') return await handleCestica(body.params.opcina, body.params.cestica);

    return err('Nepoznat tip zahtjeva.', 400);
  } catch (e) {
    console.error(e);
    return err(e instanceof Error ? e.message : 'Greška na serveru.', 500);
  }
});

// ═══════════════════════════════════════════════════════════════
// ARKOD
// ═══════════════════════════════════════════════════════════════

async function handleArkod(arkodId: string) {
  if (!arkodId?.trim()) return err('ARKOD ID je obavezan.', 400);
  const clean = arkodId.trim().toUpperCase();

  // Pokušaj više tipeName-ova jer se mijenjaju
  const typeNames = [
    'preglednik:ARKOD_POVRSINE',
    'preglednik:ARKOD',
    'arkod:ARKOD_CESTICE',
  ];

  for (const typeName of typeNames) {
    const result = await tryArkodWFS(clean, typeName);
    if (result) return ok(result);
  }

  return err(`ARKOD šifra "${clean}" nije pronađena. Provjeri šifru na APPRRR pregledajniku.`, 404);
}

async function tryArkodWFS(arkodId: string, typeName: string) {
  try {
    const url = new URL('https://preglednikarkod.apprrr.hr/geoserver/ows');
    url.searchParams.set('service', 'WFS');
    url.searchParams.set('version', '1.1.0');
    url.searchParams.set('request', 'GetFeature');
    url.searchParams.set('typeName', typeName);
    url.searchParams.set('outputFormat', 'application/json');
    url.searchParams.set('maxFeatures', '5');
    url.searchParams.set('CQL_FILTER', `sifra_arkoda='${arkodId}'`);

    console.log(`ARKOD try [${typeName}]:`, url.toString());
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.features?.length) return null;

    const p = data.features[0].properties ?? {};
    return {
      arkod_id: p.sifra_arkoda ?? p.SIFRA_ARKODA ?? arkodId,
      naziv_kulture: p.naziv_kulture ?? p.NAZIV_KULTURE ?? null,
      povrsina_ha: Number(p.povrsina_ha ?? p.POVRSINA_HA ?? 0),
      geometry: data.features[0].geometry ?? null,
      source: 'arkod',
    };
  } catch (e) {
    console.warn(`ARKOD [${typeName}] failed:`, e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// KATASTARSKA ČESTICA
// ═══════════════════════════════════════════════════════════════

async function handleCestica(rawOpcina: string, rawCestica: string) {
  if (!rawOpcina?.trim() || !rawCestica?.trim()) return err('Općina i broj čestice su obavezni.', 400);

  // Razdvoji kod od naziva: "332151 NIJEMCI" → kod=332151, naziv=NIJEMCI
  const parts = rawOpcina.trim().split(/\s+/);
  const koKod  = parts[0];                      // "332151"
  const koNaziv = parts.slice(1).join(' ');     // "NIJEMCI"
  const cestica = rawCestica.trim();

  console.log(`Tražim: KO_KOD=${koKod}, KO_NAZIV=${koNaziv}, CESTICA=${cestica}`);

  // Pokušaj 1: DGU OSS WFS — filter po kodu KO (integer)
  let result = await tryDguOssByKod(koKod, cestica);
  if (result) return ok(result);

  // Pokušaj 2: DGU OSS WFS — filter po punom nazivu KO
  if (koNaziv) {
    result = await tryDguOssByNaziv(`${koKod} ${koNaziv}`, cestica);
    if (result) return ok(result);
  }

  // Pokušaj 3: DGU OSS WFS — samo naziv bez koda
  if (koNaziv) {
    result = await tryDguOssByNaziv(koNaziv, cestica);
    if (result) return ok(result);
  }

  // Pokušaj 4: DGU INSPIRE WFS
  result = await tryDguInspire(koKod, cestica);
  if (result) return ok(result);

  // Pokušaj 5: DGU ArcGIS REST API
  result = await tryDguArcgis(koKod, cestica);
  if (result) return ok(result);

  return err(
    `Čestica "${cestica}" u KO "${rawOpcina}" nije pronađena.\n\n` +
    `Pokušano: OSS WFS (po kodu), OSS WFS (po nazivu), INSPIRE WFS, ArcGIS REST.\n` +
    `DGU javni API-ji mogu biti privremeno nedostupni.`,
    404
  );
}

// ─── Pokušaj 1: OSS WFS po KO kodu (integer) ───────────────────────────────
async function tryDguOssByKod(koKod: string, cestica: string) {
  // DGU može koristiti različite nazive polja
  const fieldCombinations = [
    { ko: 'KO_ID',         br: 'BR_CESTICE' },
    { ko: 'KAT_OPC_MB',   br: 'BROJ_CESTICE' },
    { ko: 'KO_MB',         br: 'CESTICA' },
    { ko: 'ko_id',         br: 'br_cestice' },
  ];

  for (const fields of fieldCombinations) {
    const filter = `${fields.ko}=${koKod} AND ${fields.br}='${cestica}'`;
    const result = await tryDguOssWfs(filter, `OSS[${fields.ko}=${koKod}]`);
    if (result) return result;
  }
  return null;
}

// ─── Pokušaj 2: OSS WFS po nazivu KO ───────────────────────────────────────
async function tryDguOssByNaziv(koNaziv: string, cestica: string) {
  const fieldCombinations = [
    { ko: 'katOpcina',     br: 'cesticaBroj' },
    { ko: 'KAT_OPCINA',   br: 'BROJ_CESTICE' },
    { ko: 'KO_IME',        br: 'BR_CESTICE' },
    { ko: 'ime_ko',        br: 'br_cestice' },
  ];

  for (const fields of fieldCombinations) {
    const filter = `${fields.ko}='${koNaziv}' AND ${fields.br}='${cestica}'`;
    const result = await tryDguOssWfs(filter, `OSS[${fields.ko}='${koNaziv}']`);
    if (result) return result;
  }
  return null;
}

// ─── Shared OSS WFS caller ─────────────────────────────────────────────────
async function tryDguOssWfs(cqlFilter: string, logLabel: string) {
  const endpoints = [
    'https://oss.uredjenazemlja.hr/OSSPublicServices/wfs',
    'https://oss.uredjenazemlja.hr/geoserver/wfs',
  ];

  const typeNames = ['ms:k_cestica', 'dgu:k_cestica', 'katastar:cestica', 'public:k_cestica'];

  for (const endpoint of endpoints) {
    for (const typeName of typeNames) {
      try {
        const url = new URL(endpoint);
        url.searchParams.set('service', 'WFS');
        url.searchParams.set('version', '2.0.0');
        url.searchParams.set('request', 'GetFeature');
        url.searchParams.set('typeNames', typeName);
        url.searchParams.set('outputFormat', 'application/json');
        url.searchParams.set('count', '5');
        url.searchParams.set('CQL_FILTER', cqlFilter);

        console.log(`${logLabel} [${typeName}]:`, cqlFilter);
        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });

        if (!res.ok) continue;

        const text = await res.text();
        // Provjeri nije li HTML greška
        if (text.startsWith('<html') || text.startsWith('<!DOCTYPE')) continue;

        const data = JSON.parse(text);
        if (!data.features?.length) continue;

        console.log(`✅ PRONAĐENO: ${logLabel} [${typeName}]`);
        return parseDguFeature(data.features[0]);

      } catch (e) {
        // Nastavi na sljedeći
      }
    }
  }
  return null;
}

// ─── Pokušaj 4: DGU INSPIRE WFS ────────────────────────────────────────────
async function tryDguInspire(koKod: string, cestica: string) {
  const endpoints = [
    'https://geoportal.dgu.hr/services/inspire/cadastral_parcels/wfs',
    'https://inspire.dgu.hr/wfs/cp',
    'https://geoportal.dgu.hr/wfs',
  ];

  for (const endpoint of endpoints) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('service', 'WFS');
      url.searchParams.set('version', '2.0.0');
      url.searchParams.set('request', 'GetFeature');
      url.searchParams.set('typeNames', 'cp:CadastralParcel');
      url.searchParams.set('outputFormat', 'application/json');
      url.searchParams.set('count', '5');
      url.searchParams.set('CQL_FILTER',
        `nationalCadastralReference LIKE '%-${koKod}%' AND label='${cestica}'`
      );

      console.log(`INSPIRE [${endpoint}]`);
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;

      const data = await res.json();
      if (!data.features?.length) continue;

      console.log('✅ INSPIRE pronašao!');
      const feat = data.features[0];
      const p = feat.properties ?? {};
      const areaM2 = Number(p.areaValue ?? p.area ?? 0);

      return {
        cestica_broj: p.label ?? cestica,
        kat_opcina: `${koKod}`,
        naziv_kulture: null,
        povrsina_ha: Number((areaM2 / 10000).toFixed(4)),
        geometry: feat.geometry ?? null,
        source: 'dgu_inspire',
        _debug: p,
      };
    } catch (_) { /* continue */ }
  }
  return null;
}

// ─── Pokušaj 5: DGU ArcGIS REST API ────────────────────────────────────────
async function tryDguArcgis(koKod: string, cestica: string) {
  // Moguće lokacije ArcGIS sloja s katastarskim česticama
  const layers = [
    'https://geoportal.dgu.hr/arcgis/rest/services/DGU_servisi/Kat_plan_HR/MapServer/0/query',
    'https://geoportal.dgu.hr/arcgis/rest/services/Katastar/MapServer/0/query',
    'https://geoportal.dgu.hr/arcgis/rest/services/KC/MapServer/0/query',
  ];

  const whereClauses = [
    `KO_ID=${koKod} AND BR_CESTICE='${cestica}'`,
    `KO_MB=${koKod} AND CESTICA='${cestica}'`,
    `KAT_OPC_MB=${koKod} AND BROJ_CESTICE='${cestica}'`,
  ];

  for (const layerUrl of layers) {
    for (const where of whereClauses) {
      try {
        const url = new URL(layerUrl);
        url.searchParams.set('where', where);
        url.searchParams.set('outFields', '*');
        url.searchParams.set('returnGeometry', 'true');
        url.searchParams.set('outSR', '4326');
        url.searchParams.set('f', 'json');

        console.log(`ArcGIS: ${where}`);
        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;

        const data = await res.json();
        if (!data.features?.length) continue;

        console.log('✅ ArcGIS pronašao!');
        const feat = data.features[0];
        const attrs = feat.attributes ?? {};
        const povrsinaM2 = Number(attrs.POVRSINA ?? attrs.SHAPE_AREA ?? 0);

        return {
          cestica_broj: String(attrs.BR_CESTICE ?? attrs.CESTICA ?? cestica),
          kat_opcina: String(attrs.KO_IME ?? attrs.KAT_OPCINA ?? koKod),
          naziv_kulture: attrs.VRSTA_KOR ?? attrs.KULTURA ?? null,
          povrsina_ha: Number((povrsinaM2 / 10000).toFixed(4)),
          geometry: arcgisToGeoJson(feat.geometry),
          source: 'dgu',
          _debug: attrs,
        };
      } catch (_) { /* continue */ }
    }
  }
  return null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseDguFeature(feat: Record<string, unknown>) {
  const p = (feat.properties as Record<string, unknown>) ?? {};
  const povrsinaRaw = Number(
    p.povrsina ?? p.POVRSINA ?? p.povrsinaM2 ?? p.POVRSINA_M2 ?? 0
  );
  // DGU može vraćati m² ili ha — ako je > 10000 vjerojatno m²
  const povrsinaHa = povrsinaRaw > 100 ? povrsinaRaw / 10000 : povrsinaRaw;

  console.log('DGU props:', JSON.stringify(p));

  return {
    cestica_broj: String(
      p.cesticaBroj ?? p.BR_CESTICE ?? p.BROJ_CESTICE ?? p.CESTICA ?? ''
    ),
    kat_opcina: String(
      p.katOpcina ?? p.KAT_OPCINA ?? p.KO_IME ?? p.ime_ko ?? ''
    ),
    naziv_kulture: String(
      p.vrstaKoristenja ?? p.VRSTA_KOR ?? p.kultura ?? p.KULTURA ?? ''
    ) || null,
    povrsina_ha: Number(povrsinaHa.toFixed(4)),
    geometry: (feat.geometry as unknown) ?? null,
    source: 'dgu' as const,
    _debug: p,
  };
}

/** Konverzija ArcGIS ring geometrije u GeoJSON Polygon */
function arcgisToGeoJson(geometry: unknown) {
  if (!geometry || typeof geometry !== 'object') return null;
  const g = geometry as { rings?: number[][][] };
  if (!g.rings?.length) return null;
  return { type: 'Polygon', coordinates: g.rings };
}

function ok(data: unknown) {
  return new Response(JSON.stringify({ ok: true, data }), { headers: CORS });
}

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), { status, headers: CORS });
}
