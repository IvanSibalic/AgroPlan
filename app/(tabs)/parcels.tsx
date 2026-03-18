import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  MapPin,
  Map as MapIcon,
  List,
  Plus,
  Download,
  Search,
  CheckCircle,
  X,
  AlertCircle,
  ChevronRight,
} from 'lucide-react-native';
import { getParcels, createParcel, type Parcel } from '@/services/api';
import {
  searchArkodById,
  searchByCestica,
  mapKulturaToType,
  type KatastarResult,
} from '@/services/cadastre';

// ─── Kultura chip-ovi ──────────────────────────────────────
const KULTURE = [
  '🌽 Kukuruz',
  '🌾 Pšenica',
  '🌻 Suncokret',
  '🫘 Soja',
  '🌱 Repica',
  '🍎 Voćnjak',
  '🍇 Vinograd',
  '🥬 Povrće',
  '🌿 Livada',
  '🌲 Šuma',
  '➕ Ostalo',
];

// ─── Tip modala ────────────────────────────────────────────
type ModalType = 'none' | 'choose' | 'arkod' | 'cestica' | 'preview' | 'manual';

export default function Parcels() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Modal state
  const [modal, setModal] = useState<ModalType>('none');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [katastarResult, setKatastarResult] = useState<KatastarResult | null>(
    null,
  );

  // ARKOD pretraga
  const [arkodInput, setArkodInput] = useState('');

  // Čestica pretraga
  const [opcinaInput, setOpcinaInput] = useState('');
  const [cesticaInput, setCesticaInput] = useState('');

  // Preview / ručni unos
  const [formNaziv, setFormNaziv] = useState('');
  const [formKultura, setFormKultura] = useState('');
  const [formPovrsina, setFormPovrsina] = useState('');
  const [formArkodId, setFormArkodId] = useState('');

  // ── Učitavanje parcela ──────────────────────────────────
  const loadData = async () => {
    try {
      const data = await getParcels();
      setParcels(data);
    } catch (e) {
      console.error('Error loading parcels:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);
  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };
  const totalArea = parcels.reduce((sum, p) => sum + p.area, 0);

  // ── Zatvori i resetiraj ────────────────────────────────
  function closeAll() {
    setModal('none');
    setArkodInput('');
    setOpcinaInput('');
    setCesticaInput('');
    setSearchError(null);
    setKatastarResult(null);
    setFormNaziv('');
    setFormKultura('');
    setFormPovrsina('');
    setFormArkodId('');
  }

  // ── Pretraga ARKOD ─────────────────────────────────────
  async function handleArkodSearch() {
    if (!arkodInput.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const result = await searchArkodById(arkodInput.trim());
      setKatastarResult(result);
      // Prepopulate preview form
      setFormNaziv(`Parcela ${result.arkod_id ?? arkodInput}`);
      setFormKultura(mapKulturaToType(result.naziv_kulture));
      setFormPovrsina(result.povrsina_ha.toFixed(4));
      setFormArkodId(result.arkod_id ?? arkodInput);
      setModal('preview');
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : 'Greška pri pretraži.');
    } finally {
      setSearching(false);
    }
  }

  // ── Pretraga katastarske čestice ───────────────────────
  async function handleCesticaSearch() {
    if (!opcinaInput.trim() || !cesticaInput.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const result = await searchByCestica(
        opcinaInput.trim(),
        cesticaInput.trim(),
      );
      setKatastarResult(result);
      setFormNaziv(`Čestica ${result.cestica_broj ?? cesticaInput}`);
      setFormKultura(mapKulturaToType(result.naziv_kulture));
      setFormPovrsina(result.povrsina_ha.toFixed(4));
      setFormArkodId('');
      setModal('preview');
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : 'Greška pri pretraži.');
    } finally {
      setSearching(false);
    }
  }

  // ── Spremi parcelu (iz katastra ili ručno) ─────────────
  async function handleSave() {
    if (!formNaziv.trim() || !formPovrsina.trim()) {
      Alert.alert('Greška', 'Naziv i površina su obavezni.');
      return;
    }
    setSaving(true);
    try {
      const saved = await createParcel({
        name: formNaziv.trim(),
        arkod_id: formArkodId.trim(),
        crop_type: formKultura.trim(),
        area: parseFloat(formPovrsina) || 0,
        geometry: (katastarResult?.geometry as Parcel['geometry']) ?? undefined,
      });
      if (!saved) throw new Error('Nije moguće spremiti parcelu.');
      await loadData();
      closeAll();
      Alert.alert('Uspjeh', `Parcela "${formNaziv}" je dodana.`);
    } catch (e: unknown) {
      Alert.alert(
        'Greška',
        e instanceof Error ? e.message : 'Nepoznata greška.',
      );
    } finally {
      setSaving(false);
    }
  }

  // ── Otvori ručni unos ──────────────────────────────────
  function openManual() {
    setKatastarResult(null);
    setFormNaziv('');
    setFormKultura('');
    setFormPovrsina('');
    setFormArkodId('');
    setModal('manual');
  }

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  return (
    <View className="flex-1 bg-gray-50">
      {/* ── Header ── */}
      <View className="bg-green-600 px-6 pt-14 pb-6">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-white text-3xl font-bold">Parcele</Text>
          <TouchableOpacity
            className="bg-white/20 rounded-xl px-4 py-2"
            onPress={() => setModal('choose')}
          >
            <View className="flex-row items-center">
              <Plus size={18} color="#ffffff" />
              <Text className="text-white font-semibold ml-1">Dodaj</Text>
            </View>
          </TouchableOpacity>
        </View>
        <Text className="text-green-100 text-base mb-4">
          {parcels.length} parcela · {totalArea.toFixed(2)} ha
        </Text>

        {/* View Mode Toggle */}
        <View className="flex-row bg-green-700/50 rounded-xl p-1">
          {(['list', 'map'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setViewMode(mode)}
              className={`flex-1 flex-row items-center justify-center py-3 rounded-lg ${viewMode === mode ? 'bg-white' : ''}`}
            >
              {mode === 'list' ? (
                <List
                  size={20}
                  color={viewMode === 'list' ? '#16a34a' : '#fff'}
                />
              ) : (
                <MapIcon
                  size={20}
                  color={viewMode === 'map' ? '#16a34a' : '#fff'}
                />
              )}
              <Text
                className={`ml-2 font-semibold ${viewMode === mode ? 'text-green-600' : 'text-white'}`}
              >
                {mode === 'list' ? 'Popis' : 'Karta'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Lista parcela ── */}
      {viewMode === 'list' ? (
        <ScrollView
          className="flex-1 px-6"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View className="py-4">
            {loading ? (
              <ActivityIndicator
                color="#16a34a"
                size="large"
                className="mt-8"
              />
            ) : parcels.length === 0 ? (
              <View className="bg-white rounded-2xl p-8 items-center">
                <MapPin size={48} color="#d1d5db" />
                <Text className="text-gray-500 text-center mt-4 text-base font-medium">
                  Nemate evidentiranih parcela
                </Text>
                <Text className="text-gray-400 text-center mt-2 text-sm">
                  Uvezite iz ARKOD-a ili unesite ručno
                </Text>
                <TouchableOpacity
                  className="mt-6 bg-green-600 rounded-xl px-6 py-3 flex-row items-center"
                  onPress={() => setModal('choose')}
                >
                  <Plus size={18} color="#fff" />
                  <Text className="text-white font-semibold ml-2">
                    Dodaj prvu parcelu
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              parcels.map((parcel) => (
                <View
                  key={parcel.id}
                  className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100"
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1 mr-3">
                      <Text className="text-gray-900 text-lg font-bold mb-1">
                        {parcel.name}
                      </Text>
                      {parcel.arkod_id ? (
                        <Text className="text-gray-400 text-xs">
                          ARKOD: {parcel.arkod_id}
                        </Text>
                      ) : null}
                    </View>
                    <View className="bg-green-100 px-4 py-2 rounded-xl">
                      <Text className="text-green-700 font-bold text-base">
                        {parcel.area} ha
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center pt-3 border-t border-gray-100 gap-3">
                    {parcel.crop_type ? (
                      <View className="bg-amber-100 px-3 py-1.5 rounded-lg">
                        <Text className="text-amber-700 font-semibold text-sm">
                          {parcel.crop_type}
                        </Text>
                      </View>
                    ) : null}
                    {parcel.geometry ? (
                      <View className="flex-row items-center">
                        <MapPin size={14} color="#16a34a" />
                        <Text className="text-green-600 text-xs ml-1 font-medium">
                          GPS granice
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 bg-gray-200 items-center justify-center m-6 rounded-2xl border-2 border-dashed border-gray-400">
          <MapIcon size={64} color="#9ca3af" />
          <Text className="text-gray-600 text-xl font-semibold mt-4">
            Prikaz karte
          </Text>
          <Text className="text-gray-500 text-sm mt-2 px-8 text-center">
            Ovdje će biti prikazane granice vaših parcela
          </Text>
        </View>
      )}

      {/* ══════════════════════════════════════════
          MODAL 1: Odabir metode dodavanja
      ══════════════════════════════════════════ */}
      <Modal visible={modal === 'choose'} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-900">
                Dodaj parcelu
              </Text>
              <TouchableOpacity onPress={closeAll}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* ARKOD opcija */}
            <TouchableOpacity
              className="flex-row items-center bg-green-50 border border-green-200 rounded-2xl p-5 mb-3"
              onPress={() => {
                setSearchError(null);
                setModal('arkod');
              }}
            >
              <View className="w-12 h-12 bg-green-600 rounded-xl items-center justify-center mr-4">
                <Download size={24} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-base">
                  Uvoz iz ARKOD-a
                </Text>
                <Text className="text-gray-500 text-sm mt-0.5">
                  Unesi ARKOD šifru — automatski povuče podatke
                </Text>
              </View>
              <ChevronRight size={20} color="#16a34a" />
            </TouchableOpacity>

            {/* Katastarska čestica opcija */}
            <TouchableOpacity
              className="flex-row items-center bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-3"
              onPress={() => {
                setSearchError(null);
                setModal('cestica');
              }}
            >
              <View className="w-12 h-12 bg-blue-600 rounded-xl items-center justify-center mr-4">
                <Search size={24} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-base">
                  Katastarska čestica
                </Text>
                <Text className="text-gray-500 text-sm mt-0.5">
                  Pretraži DGU po broju čestice i općini
                </Text>
              </View>
              <ChevronRight size={20} color="#2563eb" />
            </TouchableOpacity>

            {/* Ručni unos */}
            <TouchableOpacity
              className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl p-5"
              onPress={openManual}
            >
              <View className="w-12 h-12 bg-gray-400 rounded-xl items-center justify-center mr-4">
                <Plus size={24} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-base">
                  Ručni unos
                </Text>
                <Text className="text-gray-500 text-sm mt-0.5">
                  Unesi podatke sâm bez API-ja
                </Text>
              </View>
              <ChevronRight size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════
          MODAL 2: ARKOD pretraga
      ══════════════════════════════════════════ */}
      <Modal visible={modal === 'arkod'} transparent animationType="slide">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xl font-bold text-gray-900">
                  Uvoz iz ARKOD-a
                </Text>
                <TouchableOpacity onPress={closeAll}>
                  <X size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <Text className="text-gray-500 text-sm mb-6">
                ARKOD šifru nađeš u APPRRR Pregledniku parcela ili na Zahtjevu
                za potporu.
              </Text>

              <Text className="text-sm font-medium text-gray-700 mb-1">
                ARKOD šifra parcele
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50 mb-3"
                placeholder="npr. HR-12345678-01"
                value={arkodInput}
                onChangeText={setArkodInput}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              {searchError ? (
                <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3 flex-row items-start">
                  <AlertCircle
                    size={16}
                    color="#dc2626"
                    style={{ marginTop: 2 }}
                  />
                  <Text className="text-red-700 text-sm ml-2 flex-1">
                    {searchError}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                className={`rounded-xl py-4 items-center ${searching || !arkodInput.trim() ? 'bg-gray-300' : 'bg-green-600'}`}
                onPress={handleArkodSearch}
                disabled={searching || !arkodInput.trim()}
              >
                {searching ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-base">
                    Pretraži ARKOD
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                className="mt-3 items-center"
                onPress={() => setModal('choose')}
              >
                <Text className="text-gray-400 text-sm">
                  ← Natrag na odabir
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════
          MODAL 3: Katastarska čestica
      ══════════════════════════════════════════ */}
      <Modal visible={modal === 'cestica'} transparent animationType="slide">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-gray-900">
                  Katastarska čestica
                </Text>
                <TouchableOpacity onPress={closeAll}>
                  <X size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              {/* Što se učitava */}
              <View className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
                <Text className="text-blue-800 font-semibold text-sm mb-1">
                  Što se učitava iz DGU katastra:
                </Text>
                <Text className="text-blue-700 text-xs">
                  ✓ Površina parcele{'\n'}✓ GPS granice (geometrija){'\n'}✓
                  Vrsta korištenja (kultura){'\n'}✗ Vlasnik — dostupan samo uz
                  eGrađani prijavu
                </Text>
              </View>

              <Text className="text-sm font-medium text-gray-700 mb-1">
                Katastarska općina
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50 mb-1"
                placeholder="npr. 332151 NIJEMCI"
                value={opcinaInput}
                onChangeText={setOpcinaInput}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Text className="text-gray-400 text-xs mb-3">
                Format: KOD NAZIV (npr. "332151 NIJEMCI") — nađeš na
                oss.uredjenazemlja.hr
              </Text>

              <Text className="text-sm font-medium text-gray-700 mb-1">
                Broj čestice
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50 mb-3"
                placeholder="npr. 1786"
                value={cesticaInput}
                onChangeText={setCesticaInput}
                autoCorrect={false}
                keyboardType="default"
              />

              {searchError ? (
                <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3">
                  <View className="flex-row items-start">
                    <AlertCircle
                      size={16}
                      color="#dc2626"
                      style={{ marginTop: 2 }}
                    />
                    <Text className="text-red-700 text-sm ml-2 flex-1">
                      {searchError}
                    </Text>
                  </View>
                  <Text className="text-red-500 text-xs mt-2">
                    Ako pretraga ne radi, unesi podatke ručno — DGU API ponekad
                    nije dostupan.
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                className={`rounded-xl py-4 items-center ${searching || !opcinaInput.trim() || !cesticaInput.trim() ? 'bg-gray-300' : 'bg-blue-600'}`}
                onPress={handleCesticaSearch}
                disabled={
                  searching || !opcinaInput.trim() || !cesticaInput.trim()
                }
              >
                {searching ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator color="#fff" />
                    <Text className="text-white ml-2">Pretražujem DGU...</Text>
                  </View>
                ) : (
                  <Text className="text-white font-semibold text-base">
                    Pretraži DGU katastar
                  </Text>
                )}
              </TouchableOpacity>

              <View className="flex-row justify-between mt-3">
                <TouchableOpacity onPress={() => setModal('choose')}>
                  <Text className="text-gray-400 text-sm">← Natrag</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={openManual}>
                  <Text className="text-blue-500 text-sm">Unesi ručno →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════
          MODAL 4: Preview rezultata iz katastra
      ══════════════════════════════════════════ */}
      <Modal visible={modal === 'preview'} transparent animationType="slide">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="flex-1 justify-end bg-black/50">
            <ScrollView
              className="bg-white rounded-t-3xl"
              keyboardShouldPersistTaps="handled"
            >
              <View className="px-6 pt-6 pb-10">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-xl font-bold text-gray-900">
                    Pregled parcele
                  </Text>
                  <TouchableOpacity onPress={closeAll}>
                    <X size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                {/* Katastar badge */}
                <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
                  <View className="flex-row items-center mb-2">
                    <CheckCircle size={16} color="#16a34a" />
                    <Text className="text-green-700 text-sm font-semibold ml-2">
                      {katastarResult?.source === 'arkod'
                        ? 'Dohvaćeno iz ARKOD-a'
                        : 'Dohvaćeno iz DGU katastra'}
                    </Text>
                  </View>
                  {/* Faktički podaci iz katastra */}
                  <View className="flex-row flex-wrap gap-2">
                    {katastarResult?.povrsina_ha ? (
                      <View className="bg-white rounded-lg px-3 py-1.5 border border-green-200">
                        <Text className="text-xs text-gray-500">Površina</Text>
                        <Text className="text-green-700 font-bold">
                          {katastarResult.povrsina_ha} ha
                        </Text>
                      </View>
                    ) : null}
                    {katastarResult?.naziv_kulture ? (
                      <View className="bg-white rounded-lg px-3 py-1.5 border border-green-200">
                        <Text className="text-xs text-gray-500">
                          Kultura (DGU)
                        </Text>
                        <Text className="text-green-700 font-bold">
                          {katastarResult.naziv_kulture}
                        </Text>
                      </View>
                    ) : null}
                    {katastarResult?.geometry ? (
                      <View className="bg-white rounded-lg px-3 py-1.5 border border-green-200">
                        <Text className="text-xs text-gray-500">
                          Geometrija
                        </Text>
                        <Text className="text-green-700 font-bold">
                          ✓ GPS granice
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-amber-600 text-xs mt-2">
                    ⚠ Vlasnik nije dostupan javno — zahtijeva eGrađani prijavu
                  </Text>
                </View>

                {/* Forma za potvrdu/izmjenu */}
                <PreviewForm
                  formNaziv={formNaziv}
                  setFormNaziv={setFormNaziv}
                  formKultura={formKultura}
                  setFormKultura={setFormKultura}
                  formPovrsina={formPovrsina}
                  setFormPovrsina={setFormPovrsina}
                  formArkodId={formArkodId}
                  setFormArkodId={setFormArkodId}
                  hasGeometry={!!katastarResult?.geometry}
                />

                <TouchableOpacity
                  className={`rounded-xl py-4 items-center mt-4 ${saving ? 'bg-gray-300' : 'bg-green-600'}`}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-semibold text-base">
                      Spremi parcelu
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════
          MODAL 5: Ručni unos
      ══════════════════════════════════════════ */}
      <Modal visible={modal === 'manual'} transparent animationType="slide">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="flex-1 justify-end bg-black/50">
            <ScrollView
              className="bg-white rounded-t-3xl"
              keyboardShouldPersistTaps="handled"
            >
              <View className="px-6 pt-6 pb-10">
                <View className="flex-row items-center justify-between mb-6">
                  <Text className="text-xl font-bold text-gray-900">
                    Ručni unos parcele
                  </Text>
                  <TouchableOpacity onPress={closeAll}>
                    <X size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                <PreviewForm
                  formNaziv={formNaziv}
                  setFormNaziv={setFormNaziv}
                  formKultura={formKultura}
                  setFormKultura={setFormKultura}
                  formPovrsina={formPovrsina}
                  setFormPovrsina={setFormPovrsina}
                  formArkodId={formArkodId}
                  setFormArkodId={setFormArkodId}
                  hasGeometry={false}
                />

                <TouchableOpacity
                  className={`rounded-xl py-4 items-center mt-4 ${saving ? 'bg-gray-300' : 'bg-green-600'}`}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-semibold text-base">
                      Spremi parcelu
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Dijeljeni form za preview i ručni unos ────────────────
function PreviewForm({
  formNaziv,
  setFormNaziv,
  formKultura,
  setFormKultura,
  formPovrsina,
  setFormPovrsina,
  formArkodId,
  setFormArkodId,
  hasGeometry,
}: {
  formNaziv: string;
  setFormNaziv: (v: string) => void;
  formKultura: string;
  setFormKultura: (v: string) => void;
  formPovrsina: string;
  setFormPovrsina: (v: string) => void;
  formArkodId: string;
  setFormArkodId: (v: string) => void;
  hasGeometry: boolean;
}) {
  const KULTURE = [
    '🌽 Kukuruz',
    '🌾 Pšenica',
    '🌻 Suncokret',
    '🫘 Soja',
    '🌱 Repica',
    '🍎 Voćnjak',
    '🍇 Vinograd',
    '🥬 Povrće',
    '🌿 Livada',
    '🌲 Šuma',
  ];

  return (
    <>
      <Text className="text-sm font-medium text-gray-700 mb-1">
        Naziv parcele *
      </Text>
      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50 mb-4"
        placeholder="npr. Gornja njiva"
        value={formNaziv}
        onChangeText={setFormNaziv}
      />

      <Text className="text-sm font-medium text-gray-700 mb-2">Kultura</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-2"
      >
        <View className="flex-row gap-2 pb-2">
          {KULTURE.map((k) => {
            const selected =
              formKultura === k || formKultura.includes(k.slice(2).trim());
            return (
              <TouchableOpacity
                key={k}
                onPress={() =>
                  setFormKultura(selected ? '' : k.slice(2).trim())
                }
                className={`px-4 py-2 rounded-xl border ${
                  selected
                    ? 'bg-green-600 border-green-600'
                    : 'bg-white border-gray-300'
                }`}
              >
                <Text
                  className={`font-medium ${selected ? 'text-white' : 'text-gray-700'}`}
                >
                  {k}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50 mb-4"
        placeholder="Ili upiši kulturu..."
        value={formKultura}
        onChangeText={setFormKultura}
      />

      <Text className="text-sm font-medium text-gray-700 mb-1">
        Površina (ha) *
      </Text>
      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50 mb-4"
        placeholder="npr. 2.5000"
        value={formPovrsina}
        onChangeText={setFormPovrsina}
        keyboardType="decimal-pad"
      />

      <Text className="text-sm font-medium text-gray-700 mb-1">
        ARKOD šifra (neobavezno)
      </Text>
      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50 mb-4"
        placeholder="npr. HR-12345678-01"
        value={formArkodId}
        onChangeText={setFormArkodId}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      {hasGeometry && (
        <View className="flex-row items-center bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <MapPin size={16} color="#16a34a" />
          <Text className="text-green-700 text-sm font-medium ml-2">
            GPS granice parcele preuzete iz katastra
          </Text>
        </View>
      )}
    </>
  );
}
