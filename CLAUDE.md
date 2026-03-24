# CLAUDE.md — AgroPlan kodne smjernice i naučene greške

Ovaj fajl sadrži pravila, konvencije i greške koje sam napravio na ovom projektu.
Svaki put kad radim promjene — pratim ova pravila.

---

## Projekt: AgroPlan

React Native + Expo Router 6 aplikacija za upravljanje OPG-om (Obiteljsko Poljoprivredno Gospodarstvo).
Stack: React Native, Expo Router, Supabase (PostgreSQL + Auth + RLS), NativeWind/Tailwind, TypeScript.

---

## 1. Greske koje sam napravio — ucim iz njih

### 1.1 Krivi naziv interfacea (typo)

**Greska:** Napisao sam `OGPProfile` umjesto `OPGProfile`.
OPG = Obiteljsko Poljoprivredno Gospodarstvo. Redosljed slova je O-P-G, ne O-G-P.
**Pravilo:** Uvijek provjeri kratice iz domene (OPG, ARKOD) — pisati ih doslovno, ne iz glave.

### 1.2 Mapiranje DB kolona — nedostajuce polje

**Greska:** `Activity` interface i `mapActivity()` funkcija ne sadrze `worker_name`,
ali `index.tsx` (dashboard) koristi `activity.worker_name`. Rezultat: `undefined` u UI-u.
**Pravilo:** Svaki put kad dodam novo polje u UI, odmah provjerim:

- Da li postoji u TypeScript interfaceu?
- Da li ga `mapX()` funkcija mapira iz DB reda?
- Da li ga DB view/tablica vraca?
  Sva tri moraju biti uskladena.

### 1.3 Stara migracija vs. stvarna shema

**Greska:** Fajl `20260318161528_create_opg_schema.sql` sadrzi stare engleske nazive tablica
(`parcels`, `activities`, `inventory`, `team_members`), ali aplikacija koristi
hrvatske nazive (`parcele`, `dnevnik_rada`, `skladiste`, `profiles`).
Migracija je postala neuskladena s kodom.
**Pravilo:** Migracija i `services/api.ts` moraju koristiti iste nazive tablica i kolona.
Kad promijenim shemu, odmah azuriram i migraciju i api.ts.

### 1.4 Cache se ne invalidira nakon mutacija

**Greska:** `createParcel`, `deleteParcel`, `createActivity` itd. ne ciste cache nakon uspjesne operacije.
Korisnik vidi stare podatke dok ne refresha rucno.
**Pravilo:** Nakon svake mutacije (create/update/delete) pozovi `clearCache()` ili ukloni
specificni kljuc iz cache-a da sljedeci read bude svjez.

### 1.5 Routing loop na auth state change

**Greska:** `onAuthStateChange` je okidao `handleSignedIn()` za svaki event, ukljucujuci
`TOKEN_REFRESHED`, sto je stvaralo beskonacni loop navigacije.
**Popravak:** Koristim `navigated.current` ref i slusam SAMO `SIGNED_IN` i `SIGNED_OUT` evente.
**Pravilo:** U `onAuthStateChange` uvijek filtriraj event tipove. Nikad ne navigiraj na
`TOKEN_REFRESHED` ili `USER_UPDATED`.

### 1.6 Missing `opg_id` provjera u mutacijama

**Greska:** Funkcije poput `createActivity` i `createInventoryItem` dohvacaju `opg_id`
iz profila unutar same funkcije. Ako korisnik nema opg_id, baci gresku ali bez jasne poruke u UI-u.
**Pravilo:** Svaki API poziv koji zahtijeva `opg_id` mora imati jasan error handling koji
korisniku objasni zasto akcija nije uspjela (ne samo `console.error`).

---

## 2. Konvencije koda

### 2.1 Imenovanje — DB vs. TypeScript

Baza podataka koristi **hrvatske** nazive kolona. TypeScript interfacei koriste **engleske** nazive.
Mapiranje je uvijek u `mapX()` funkcijama unutar `services/api.ts`.

| DB (hrvatska kolona) | TypeScript polje    |
| -------------------- | ------------------- |
| `naziv`              | `name`              |
| `kultura`            | `crop_type`         |
| `povrsina`           | `area`              |
| `aktivnost`          | `activity_type`     |
| `datum`              | `date`              |
| `mehanizacija`       | `machinery`         |
| `napomene`           | `notes`             |
| `kolicina`           | `quantity`          |
| `mjerna_jedinica`    | `unit`              |
| `tip`                | `category`          |
| `puno_ime`           | `name` (TeamMember) |
| `uloga`              | `role`              |
| `parcela_id`         | `parcel_id`         |
| `korisnik_id`        | `worker_id`         |

### 2.2 Sve Supabase upiti idu kroz `services/api.ts`

Komponente nikad ne importaju `supabase` direktno. Uvijek koriste funkcije iz `api.ts`.

### 2.3 Error handling u API funkcijama

```ts
// Dobro — vraca typed result
export async function doSomething(): Promise<SomeType | null> {
  try {
    const { data, error } = await supabase.from('...').select('*');
    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Error doing something:', e);
    return null;
  }
}
```

Nikad ne bacaj gresku van komponente bez da je uhvatis. Uvijek vrati `null` ili `[]` kao fallback.

### 2.4 Mutacije koje vrnjaju uspjeh/gresku

```ts
// Za operacije koje mogu failati i korisnik treba znati razlog
export async function doMutation(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('...');
  if (error) return { error: error.message };
  return { error: null };
}
```

### 2.5 NativeWind klase — bez mijesanja StyleSheet i className

Koristimo NativeWind/Tailwind klase. Ne mijesaj `StyleSheet.create()` s `className`.
Iznimka: `style={{ flex: 1 }}` za `KeyboardAvoidingView` jer NativeWind to ne podrpzava dobro.

---

## 3. Supabase / Baza podataka

### 3.1 RLS uvijek ukljucen

Svaka nova tablica mora imati:

```sql
ALTER TABLE nova_tablica ENABLE ROW LEVEL SECURITY;
-- + odgovarajuce politike za SELECT, INSERT, UPDATE, DELETE
```

### 3.2 SECURITY DEFINER funkcije za cross-table operacije

Kad korisnik treba pristupiti podacima koji prelaze RLS granice (npr. vlasnik vidi
zahtjeve clanova), koristi `SECURITY DEFINER` RPC funkciju, ne direktan upit.

### 3.3 Koristi `maybeSingle()` kad red mozda ne postoji

```ts
// Kad ocekujes 0 ili 1 red — koristi maybeSingle(), ne single()
.maybeSingle()  // vraca null ako nema reda, ne baca gresku
.single()       // baca gresku ako nema tocno 1 red
```

### 3.4 Uvijek koristi views za kompleksne dohvate

View `v_parcele` vraca geometriju kao GeoJSON. Citaj iz view-a, pisaj u baznu tablicu.

```ts
// Citanje — view
supabase.from('v_parcele').select('*')
// Pisanje — baza tablica
supabase.from('parcele').update(...)
```

### 3.5 DB trigger automatski kreira profil

`handle_new_user_signup` trigger automatski kreira `profiles` zapis pri registraciji.
Ne kreirati profil rucno u kodu. OPG se kreira posebno na `opg-setup` ekranu.

---

## 4. Expo Router konvencije

### 4.1 Navigacija

```ts
router.replace('/(tabs)'); // Zamjeni trenutni ekran (nema back)
router.push('/some-screen'); // Push na stack (ima back)
```

Za post-login redirect uvijek koristi `replace`, ne `push`.

### 4.2 Layout struktura

```
app/
  _layout.tsx          -- Root layout, auth guard
  (tabs)/_layout.tsx   -- Tab navigator
  (auth)/_layout.tsx   -- Auth stack
  opg-setup.tsx        -- Van tabova, za novi korisnik bez OPG-a
```

### 4.3 Auth guard logika u \_layout.tsx

Slijed:

1. `getSession()` — provjeri postoji li sesija
2. Ako nema → `/login`
3. Ako ima → `getUserProfile()` → provjeri `opg_id`
4. Ako nema `opg_id` → `/opg-setup`
5. Ako ima `opg_id` → `/(tabs)`

---

## 5. Opce smjernice za pisanje cistog koda

### 5.1 Ne dodavaj ono sto nije trazeno

- Ne dodavaj feature flags, backwards-compat shims, ili extra validacije
- Ne refaktoriraj kod koji nije dio trenutnog zadatka
- Ne dodavaj komentare tamo gdje je logika ocita

### 5.2 Minimalna apstrakcija

- Tri slicna reda koda su bolji od preuranjene apstrakcije
- Helper funkcija samo ako se koristi na 3+ mjesta

### 5.3 TypeScript — koristiti tipove, ne `any`

```ts
// Lose
const data: any = ...

// Dobro
const data: Record<string, unknown> = ...
// ili konkretan interface
```

### 5.4 Uvijek provjeri null/undefined prije pristupa

```ts
// Lose
const name = profile.opg_id.toString();

// Dobro
const name = profile?.opg_id?.toString() ?? '';
```

### 5.5 Async/await — uvijek hvati greske

Svaka `async` funkcija koja poziva Supabase mora imati `try/catch`.
Nikad ne ostavljaj unhandled promise rejection.

---

## 6. Checklistа prije commita

- [ ] Da li novi interfejsi sadrze SVA polja koja UI koristi?
- [ ] Da li `mapX()` funkcija mapira sva polja iz DB-a?
- [ ] Da li nova tablica ima RLS policies?
- [ ] Da li migracija koristi iste nazive kao `api.ts`?
- [ ] Da li mutacije cistе cache ili pozivaju refetch?
- [ ] Da li error stanje prikazuje jasnu poruku korisniku (ne samo `console.error`)?
- [ ] Da li sam izbjegao direktan import `supabase` unutar komponente?
