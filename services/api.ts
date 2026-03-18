import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

// ============================================================
// CACHE
// ============================================================

const CACHE_KEYS = {
  PARCELS: 'cache_parcele',
  ACTIVITIES: 'cache_dnevnik_rada',
  INVENTORY: 'cache_skladiste',
  TEAM_MEMBERS: 'cache_profiles',
};

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.error(`Cache read error [${key}]:`, e);
  }
  return null;
}

async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Cache write error [${key}]:`, e);
  }
}

export async function clearCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(CACHE_KEYS));
  } catch (e) {
    console.error('Cache clear error:', e);
  }
}

// ============================================================
// TYPES
// ============================================================

export interface Parcel {
  id: string;
  opg_id: string;
  name: string;       // DB: naziv
  arkod_id: string;
  crop_type: string;  // DB: kultura
  area: number;       // DB: povrsina
  geometry?: {
    type: string;
    coordinates: number[][][];
  };
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  opg_id: string;
  parcel_id?: string;    // DB: parcela_id
  worker_id?: string;    // DB: korisnik_id
  activity_type: string; // DB: aktivnost
  material_id?: string;  // DB: materijal_id
  material_qty?: number; // DB: kolicina_materijala
  date: string;          // DB: datum
  machinery?: string;    // DB: mehanizacija
  materials: Array<{ name: string; quantity: number; unit: string }>; // DB: materijali (jsonb)
  notes?: string;        // DB: napomene
  created_at: string;
}

export interface InventoryItem {
  id: string;
  opg_id: string;
  category: 'sjeme' | 'gnojivo' | 'zaštita' | 'gorivo'; // DB: tip
  name: string;          // DB: naziv
  quantity: number;      // DB: kolicina
  unit: string;          // DB: mjerna_jedinica
  min_quantity: number;  // DB: min_kolicina
  updated_at: string;
}

export interface TeamMember {
  id: string;
  opg_id: string;
  name: string;   // DB: puno_ime
  role: string;   // DB: uloga ('vlasnik' | 'clan' | 'radnik')
  created_at: string;
}

export interface OGPProfile {
  id: string;
  naziv: string;
  oib?: string;
  vlasnik_id: string;
  kod_pristupa?: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  opg_id: string | null;
  puno_ime: string;
  uloga: string;
  created_at: string;
}

export interface JoinRequest {
  id: string;
  opg_id: string;
  korisnik_id: string;
  puno_ime: string;
  status: 'na_cekanju' | 'odobreno' | 'odbijeno';
  created_at: string;
}

// ============================================================
// AUTH
// ============================================================

export async function signIn(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signUp(
  email: string,
  password: string,
  puno_ime: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { puno_ime },
    },
  });
  // Profile kreiranje automatski obrađuje DB trigger handle_new_user_signup()
  // OPG se kreira posebno nakon registracije (opg-setup ekran)
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await clearCache();
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getOPGProfile(): Promise<OGPProfile | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('opg_profili')
      .select('*')
      .eq('vlasnik_id', user.id)
      .single();

    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Error fetching OPG profile:', e);
    return null;
  }
}

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data as UserProfile;
  } catch (e) {
    console.error('Error fetching user profile:', e);
    return null;
  }
}

function extractErrorMessage(e: unknown, fallback = 'Nepoznata greška'): string {
  if (e && typeof e === 'object' && 'message' in e) {
    return (e as { message: string }).message;
  }
  if (e instanceof Error) return e.message;
  return fallback;
}

export async function createOPG(
  naziv: string,
  oib?: string
): Promise<{ opg_id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_opg', {
    p_naziv: naziv,
    p_oib: oib ?? '',
  });
  if (error) return { opg_id: null, error: error.message };
  return { opg_id: data as string, error: null };
}

export async function getOPGByCode(
  kod: string
): Promise<{ id: string; naziv: string } | null> {
  try {
    const { data, error } = await supabase.rpc('get_opg_by_code', { p_kod: kod });
    if (error) throw error;
    if (!data || (Array.isArray(data) && data.length === 0)) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return row as { id: string; naziv: string };
  } catch (e) {
    console.error('Error fetching OPG by code:', e);
    return null;
  }
}

export async function requestJoinOPG(
  kod: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('request_join_opg', { p_kod: kod });
  if (error) return { error: error.message };
  return { error: null };
}

export async function getMyJoinRequest(): Promise<JoinRequest | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('zahtjevi_pristupa')
      .select('*')
      .eq('korisnik_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as JoinRequest | null;
  } catch (e) {
    console.error('Error fetching join request:', e);
    return null;
  }
}

export async function getJoinRequests(): Promise<JoinRequest[]> {
  try {
    const profile = await getOPGProfile();
    if (!profile) return [];

    const { data, error } = await supabase
      .from('zahtjevi_pristupa')
      .select('*')
      .eq('opg_id', profile.id)
      .eq('status', 'na_cekanju')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as JoinRequest[];
  } catch (e) {
    console.error('Error fetching join requests:', e);
    return [];
  }
}

export async function approveJoinRequest(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('approve_join_request', {
      p_zahtjev_id: id,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Error approving join request:', e);
    return false;
  }
}

export async function rejectJoinRequest(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('reject_join_request', {
      p_zahtjev_id: id,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Error rejecting join request:', e);
    return false;
  }
}

// ============================================================
// PARCELE → Parcel
// ============================================================

/** Mapira DB row (v_parcele) u TypeScript Parcel */
function mapParcel(row: Record<string, unknown>): Parcel {
  return {
    id: row.id as string,
    opg_id: row.opg_id as string,
    name: row.naziv as string,
    arkod_id: (row.arkod_id as string) ?? '',
    crop_type: (row.kultura as string) ?? '',
    area: (row.povrsina as number) ?? 0,
    geometry: row.geometrija as Parcel['geometry'],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getParcels(): Promise<Parcel[]> {
  try {
    // v_parcele view vraća geometriju kao GeoJSON jsonb
    const { data, error } = await supabase
      .from('v_parcele')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const parcels = (data ?? []).map(mapParcel);
    await setCache(CACHE_KEYS.PARCELS, parcels);
    return parcels;
  } catch (e) {
    console.error('Error fetching parcels:', e);
    const cached = await getCached<Parcel[]>(CACHE_KEYS.PARCELS);
    return cached ?? [];
  }
}

export async function createParcel(
  parcel: Pick<Parcel, 'name' | 'arkod_id' | 'crop_type' | 'area' | 'geometry'>
): Promise<Parcel | null> {
  try {
    const geoJsonStr = parcel.geometry
      ? JSON.stringify(parcel.geometry)
      : undefined;

    const { data, error } = await supabase.rpc('insert_parcela', {
      p_naziv: parcel.name,
      p_arkod_id: parcel.arkod_id ?? null,
      p_kultura: parcel.crop_type ?? null,
      p_povrsina: parcel.area ?? 0,
      p_geojson: geoJsonStr ?? null,
    });

    if (error) throw error;

    // Dohvati kreiran zapis
    const { data: created, error: fetchErr } = await supabase
      .from('v_parcele')
      .select('*')
      .eq('id', data as string)
      .single();

    if (fetchErr) throw fetchErr;
    return mapParcel(created as Record<string, unknown>);
  } catch (e) {
    console.error('Error creating parcel:', e);
    return null;
  }
}

export async function updateParcel(
  id: string,
  updates: Partial<Pick<Parcel, 'name' | 'crop_type' | 'area' | 'arkod_id'>>
): Promise<Parcel | null> {
  try {
    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) dbUpdates.naziv = updates.name;
    if (updates.crop_type !== undefined) dbUpdates.kultura = updates.crop_type;
    if (updates.area !== undefined) dbUpdates.povrsina = updates.area;
    if (updates.arkod_id !== undefined) dbUpdates.arkod_id = updates.arkod_id;

    const { error } = await supabase
      .from('parcele')
      .update(dbUpdates)
      .eq('id', id);

    if (error) throw error;

    const { data, error: fetchErr } = await supabase
      .from('v_parcele')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr) throw fetchErr;
    return mapParcel(data as Record<string, unknown>);
  } catch (e) {
    console.error('Error updating parcel:', e);
    return null;
  }
}

export async function deleteParcel(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('parcele').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Error deleting parcel:', e);
    return false;
  }
}

export async function getTotalArea(): Promise<number> {
  try {
    const parcels = await getParcels();
    return parcels.reduce((sum, p) => sum + p.area, 0);
  } catch (e) {
    return 0;
  }
}

// ============================================================
// DNEVNIK RADA → Activity
// ============================================================

function mapActivity(row: Record<string, unknown>): Activity {
  return {
    id: row.id as string,
    opg_id: row.opg_id as string,
    parcel_id: (row.parcela_id as string) ?? undefined,
    worker_id: (row.korisnik_id as string) ?? undefined,
    activity_type: row.aktivnost as string,
    material_id: (row.materijal_id as string) ?? undefined,
    material_qty: (row.kolicina_materijala as number) ?? undefined,
    date: row.datum as string,
    machinery: (row.mehanizacija as string) ?? undefined,
    materials: (row.materijali as Activity['materials']) ?? [],
    notes: (row.napomene as string) ?? undefined,
    created_at: row.created_at as string,
  };
}

export async function getActivities(limit?: number): Promise<Activity[]> {
  try {
    let query = supabase
      .from('dnevnik_rada')
      .select('*')
      .order('datum', { ascending: false });

    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    const activities = (data ?? []).map(mapActivity);
    await setCache(CACHE_KEYS.ACTIVITIES, activities);
    return activities;
  } catch (e) {
    console.error('Error fetching activities:', e);
    const cached = await getCached<Activity[]>(CACHE_KEYS.ACTIVITIES);
    return cached ?? [];
  }
}

export async function createActivity(
  activity: Pick<
    Activity,
    | 'activity_type'
    | 'date'
    | 'parcel_id'
    | 'worker_id'
    | 'machinery'
    | 'notes'
    | 'materials'
    | 'material_id'
    | 'material_qty'
  >
): Promise<Activity | null> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Korisnik nije prijavljen');

    const { data: profile } = await supabase
      .from('profiles')
      .select('opg_id')
      .eq('id', user.id)
      .single();

    if (!profile?.opg_id) throw new Error('Korisnik nije povezan s OPG-om');

    const row = {
      opg_id: profile.opg_id,
      parcela_id: activity.parcel_id ?? null,
      korisnik_id: user.id,
      aktivnost: activity.activity_type,
      kolicina_materijala: activity.material_qty ?? null,
      materijal_id: activity.material_id ?? null,
      datum: activity.date,
      mehanizacija: activity.machinery ?? null,
      napomene: activity.notes ?? null,
      materijali: activity.materials ?? [],
    };

    const { data, error } = await supabase
      .from('dnevnik_rada')
      .insert([row])
      .select()
      .single();

    if (error) throw error;
    // Trigger trigger_deduct_skladiste se automatski pokrenuo
    return mapActivity(data as Record<string, unknown>);
  } catch (e) {
    console.error('Error creating activity:', e);
    return null;
  }
}

export async function deleteActivity(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('dnevnik_rada').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Error deleting activity:', e);
    return false;
  }
}

// ============================================================
// SKLADIŠTE → InventoryItem
// ============================================================

function mapInventoryItem(row: Record<string, unknown>): InventoryItem {
  return {
    id: row.id as string,
    opg_id: row.opg_id as string,
    category: row.tip as InventoryItem['category'],
    name: row.naziv as string,
    quantity: (row.kolicina as number) ?? 0,
    unit: (row.mjerna_jedinica as string) ?? 'kom',
    min_quantity: (row.min_kolicina as number) ?? 0,
    updated_at: row.updated_at as string,
  };
}

export async function getInventory(): Promise<InventoryItem[]> {
  try {
    const { data, error } = await supabase
      .from('skladiste')
      .select('*')
      .order('tip', { ascending: true });

    if (error) throw error;
    const items = (data ?? []).map(mapInventoryItem);
    await setCache(CACHE_KEYS.INVENTORY, items);
    return items;
  } catch (e) {
    console.error('Error fetching inventory:', e);
    const cached = await getCached<InventoryItem[]>(CACHE_KEYS.INVENTORY);
    return cached ?? [];
  }
}

export async function getInventoryByCategory(
  category: string
): Promise<InventoryItem[]> {
  const inventory = await getInventory();
  return inventory.filter((item) => item.category === category);
}

export async function getLowStockItems(): Promise<InventoryItem[]> {
  const inventory = await getInventory();
  return inventory.filter((item) => item.quantity <= item.min_quantity);
}

export async function updateInventoryQuantity(
  id: string,
  quantity: number
): Promise<InventoryItem | null> {
  try {
    const { data, error } = await supabase
      .from('skladiste')
      .update({ kolicina: quantity, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapInventoryItem(data as Record<string, unknown>);
  } catch (e) {
    console.error('Error updating inventory:', e);
    return null;
  }
}

export async function createInventoryItem(
  item: Pick<InventoryItem, 'category' | 'name' | 'quantity' | 'unit' | 'min_quantity'>
): Promise<InventoryItem | null> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Korisnik nije prijavljen');

    const { data: profile } = await supabase
      .from('profiles')
      .select('opg_id')
      .eq('id', user.id)
      .single();

    if (!profile?.opg_id) throw new Error('Korisnik nije povezan s OPG-om');

    const { data, error } = await supabase
      .from('skladiste')
      .insert([{
        opg_id: profile.opg_id,
        tip: item.category,
        naziv: item.name,
        kolicina: item.quantity,
        mjerna_jedinica: item.unit,
        min_kolicina: item.min_quantity ?? 0,
      }])
      .select()
      .single();

    if (error) throw error;
    return mapInventoryItem(data as Record<string, unknown>);
  } catch (e) {
    console.error('Error creating inventory item:', e);
    return null;
  }
}

export async function deleteInventoryItem(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('skladiste').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Error deleting inventory item:', e);
    return false;
  }
}

// ============================================================
// PROFILES → TeamMember
// ============================================================

function mapTeamMember(row: Record<string, unknown>): TeamMember {
  return {
    id: row.id as string,
    opg_id: row.opg_id as string,
    name: row.puno_ime as string,
    role: row.uloga as string,
    created_at: row.created_at as string,
  };
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const members = (data ?? []).map(mapTeamMember);
    await setCache(CACHE_KEYS.TEAM_MEMBERS, members);
    return members;
  } catch (e) {
    console.error('Error fetching team members:', e);
    const cached = await getCached<TeamMember[]>(CACHE_KEYS.TEAM_MEMBERS);
    return cached ?? [];
  }
}

export async function updateTeamMember(
  id: string,
  updates: { name?: string; role?: string }
): Promise<boolean> {
  const { error } = await supabase.rpc('update_team_member', {
    p_id: id,
    p_puno_ime: updates.name ?? null,
    p_uloga: updates.role ?? null,
  });
  if (error) {
    console.error('Error updating team member:', error.message);
    return false;
  }
  return true;
}

// Stub za kompatibilnost — invite flow zamijenjen OPG join kodom
export async function inviteTeamMember(
  _member: { name: string; email: string; role: string }
): Promise<TeamMember | null> {
  return null;
}

export async function deleteTeamMember(id: string): Promise<boolean> {
  // Napomena: brisanje profila uklanja korisnikov pristup OPG-u.
  // Ne briše auth.users zapis — to se radi kroz Supabase Admin API.
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ opg_id: null } as Record<string, unknown>)
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Error removing team member:', e);
    return false;
  }
}
