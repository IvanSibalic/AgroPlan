import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Leaf, Users, Plus, Search, RefreshCw } from 'lucide-react-native';
import {
  createOPG,
  getOPGByCode,
  requestJoinOPG,
  getMyJoinRequest,
  getUserProfile,
  signOut,
  type JoinRequest,
} from '@/services/api';

type Screen = 'choose' | 'create' | 'join' | 'waiting';

export default function OPGSetup() {
  const [screen, setScreen] = useState<Screen>('choose');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kreiraj OPG forma
  const [naziv, setNaziv] = useState('');
  const [oib, setOib] = useState('');

  // Pridruži se OPG-u forma
  const [kod, setKod] = useState('');
  const [previewOpg, setPreviewOpg] = useState<{ id: string; naziv: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Waiting state
  const [joinRequest, setJoinRequest] = useState<JoinRequest | null>(null);

  useEffect(() => {
    checkExistingState();
  }, []);

  async function checkExistingState() {
    setLoading(true);
    try {
      const profile = await getUserProfile();
      if (profile?.opg_id) {
        router.replace('/(tabs)');
        return;
      }
      const req = await getMyJoinRequest();
      if (req && req.status === 'na_cekanju') {
        setJoinRequest(req);
        setScreen('waiting');
      } else if (req && req.status === 'odobreno') {
        router.replace('/(tabs)');
        return;
      }
    } catch (e) {
      console.error('Error checking state:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOPG() {
    if (!naziv.trim()) {
      setError('Naziv OPG-a je obavezan.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: err } = await createOPG(naziv.trim(), oib.trim() || undefined);
    setSaving(false);
    if (err) {
      setError(err);
    } else {
      router.replace('/(tabs)');
    }
  }

  async function handlePreviewCode() {
    if (kod.trim().length < 6) return;
    setPreviewLoading(true);
    setPreviewOpg(null);
    setError(null);
    const result = await getOPGByCode(kod.trim());
    setPreviewLoading(false);
    if (!result) {
      setError('OPG s tim kodom nije pronađen. Provjeri kod s vlasnikom.');
    } else {
      setPreviewOpg(result);
    }
  }

  async function handleRequestJoin() {
    if (!previewOpg) return;
    setSaving(true);
    setError(null);
    const { error: err } = await requestJoinOPG(kod.trim());
    setSaving(false);
    if (err) {
      setError(err);
    } else {
      const req = await getMyJoinRequest();
      setJoinRequest(req);
      setScreen('waiting');
    }
  }

  async function handleCheckStatus() {
    setSaving(true);
    try {
      const profile = await getUserProfile();
      if (profile?.opg_id) {
        router.replace('/(tabs)');
        return;
      }
      const req = await getMyJoinRequest();
      setJoinRequest(req);
      if (req?.status === 'odbijeno') {
        Alert.alert(
          'Zahtjev odbijen',
          'Vlasnik OPG-a je odbio vaš zahtjev. Možete poslati novi zahtjev ili kreirati vlastiti OPG.',
          [{ text: 'U redu', onPress: () => setScreen('choose') }]
        );
      } else if (!req || req.status !== 'na_cekanju') {
        setScreen('choose');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  // ── Odabir ─────────────────────────────────────────────
  if (screen === 'choose') {
    return (
      <View className="flex-1 bg-white">
        <View className="bg-green-600 px-6 pt-14 pb-10 items-center">
          <View className="w-20 h-20 bg-white/20 rounded-full items-center justify-center mb-4">
            <Leaf size={40} color="#ffffff" />
          </View>
          <Text className="text-white text-2xl font-bold mb-2 text-center">
            Dobrodošli u AgroPlan!
          </Text>
          <Text className="text-green-100 text-base text-center">
            Odaberite kako želite koristiti aplikaciju
          </Text>
        </View>

        <ScrollView className="flex-1 px-6 py-8">
          <TouchableOpacity
            className="bg-green-50 border-2 border-green-500 rounded-2xl p-6 mb-4"
            onPress={() => { setError(null); setScreen('create'); }}
            activeOpacity={0.8}
          >
            <View className="flex-row items-center mb-3">
              <View className="w-12 h-12 bg-green-600 rounded-xl items-center justify-center mr-4">
                <Plus size={26} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 text-lg font-bold">
                  Kreiraj vlastiti OPG
                </Text>
                <Text className="text-gray-500 text-sm mt-0.5">
                  Novi OPG — ti si vlasnik
                </Text>
              </View>
            </View>
            <Text className="text-gray-600 text-sm leading-5">
              Kreiraj gospodarstvo i pozovi članove obitelji ili radnike.
              Dobit ćeš jedinstveni kod kojim drugi mogu tražiti pristup.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-blue-50 border-2 border-blue-400 rounded-2xl p-6 mb-8"
            onPress={() => { setError(null); setPreviewOpg(null); setKod(''); setScreen('join'); }}
            activeOpacity={0.8}
          >
            <View className="flex-row items-center mb-3">
              <View className="w-12 h-12 bg-blue-600 rounded-xl items-center justify-center mr-4">
                <Users size={26} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 text-lg font-bold">
                  Pridruži se OPG-u
                </Text>
                <Text className="text-gray-500 text-sm mt-0.5">
                  Unesi kod koji ti je dao vlasnik
                </Text>
              </View>
            </View>
            <Text className="text-gray-600 text-sm leading-5">
              Traži pristup postojećem OPG-u. Vlasnik mora odobriti
              tvoj zahtjev unutar aplikacije.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => signOut()} className="items-center py-3">
            <Text className="text-gray-400 text-sm">Odjavi se</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Kreiranje OPG-a ─────────────────────────────────────
  if (screen === 'create') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 bg-white">
          <View className="bg-green-600 px-6 pt-14 pb-6">
            <TouchableOpacity className="mb-4" onPress={() => setScreen('choose')}>
              <Text className="text-green-100 text-sm">← Natrag</Text>
            </TouchableOpacity>
            <Text className="text-white text-2xl font-bold">Kreiraj OPG</Text>
            <Text className="text-green-100 text-sm mt-1">
              Postani vlasnik vlastitog gospodarstva
            </Text>
          </View>

          <ScrollView className="flex-1 px-6 py-6" keyboardShouldPersistTaps="handled">
            <View className="mb-5">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Naziv OPG-a *
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50"
                placeholder="npr. OPG Horvat"
                value={naziv}
                onChangeText={setNaziv}
                autoCapitalize="words"
              />
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                OIB (neobavezno)
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50"
                placeholder="12345678901"
                value={oib}
                onChangeText={setOib}
                keyboardType="number-pad"
                maxLength={11}
              />
            </View>

            <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6">
              <Text className="text-green-700 text-sm leading-5">
                🔑 Nakon kreiranja OPG-a dobit ćeš jedinstveni kod pristupa.
                Dijeli ga s osobama koje želiš dodati u tim.
              </Text>
            </View>

            {error && (
              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <Text className="text-red-700 text-sm">{error}</Text>
              </View>
            )}

            <TouchableOpacity
              className={`rounded-xl py-4 items-center ${saving ? 'bg-gray-300' : 'bg-green-600'}`}
              onPress={handleCreateOPG}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Kreiraj OPG</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Pridruživanje OPG-u ─────────────────────────────────
  if (screen === 'join') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 bg-white">
          <View className="bg-blue-600 px-6 pt-14 pb-6">
            <TouchableOpacity className="mb-4" onPress={() => setScreen('choose')}>
              <Text className="text-blue-100 text-sm">← Natrag</Text>
            </TouchableOpacity>
            <Text className="text-white text-2xl font-bold">Pridruži se OPG-u</Text>
            <Text className="text-blue-100 text-sm mt-1">
              Unesi kod koji ti je poslao vlasnik
            </Text>
          </View>

          <ScrollView className="flex-1 px-6 py-6" keyboardShouldPersistTaps="handled">
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Kod pristupa OPG-a *
              </Text>
              <View className="flex-row gap-3">
                <TextInput
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50"
                  placeholder="npr. AB3D7FGH"
                  value={kod}
                  onChangeText={(v) => {
                    setKod(v.toUpperCase());
                    setPreviewOpg(null);
                    setError(null);
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={8}
                />
                <TouchableOpacity
                  className={`px-4 rounded-xl items-center justify-center ${
                    previewLoading || kod.trim().length < 6 ? 'bg-gray-200' : 'bg-blue-600'
                  }`}
                  onPress={handlePreviewCode}
                  disabled={previewLoading || kod.trim().length < 6}
                >
                  {previewLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Search size={22} color={kod.trim().length < 6 ? '#9ca3af' : '#fff'} />
                  )}
                </TouchableOpacity>
              </View>
              <Text className="text-gray-400 text-xs mt-2">
                Kod je 8 znakova. Klikni ikonu lupe za pregled OPG-a.
              </Text>
            </View>

            {previewOpg && (
              <View className="bg-blue-50 border border-blue-300 rounded-xl px-4 py-4 mb-4">
                <Text className="text-blue-500 text-xs font-semibold uppercase mb-1">
                  Pronađeni OPG
                </Text>
                <Text className="text-blue-900 text-xl font-bold">{previewOpg.naziv}</Text>
                <Text className="text-blue-600 text-sm mt-1">
                  Tvoj zahtjev će biti poslan vlasniku na odobrenje.
                </Text>
              </View>
            )}

            {error && (
              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <Text className="text-red-700 text-sm">{error}</Text>
              </View>
            )}

            <TouchableOpacity
              className={`rounded-xl py-4 items-center ${saving || !previewOpg ? 'bg-gray-300' : 'bg-blue-600'}`}
              onPress={handleRequestJoin}
              disabled={saving || !previewOpg}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Pošalji zahtjev</Text>
              )}
            </TouchableOpacity>

            <View className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mt-6">
              <Text className="text-amber-700 text-sm leading-5">
                ℹ️ Vlasnik OPG-a mora odobriti tvoj zahtjev unutar aplikacije
                (Tim tab). Dobit ćeš pristup tek nakon odobrenja.
              </Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Čekanje odobrenja ───────────────────────────────────
  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <View className="w-24 h-24 bg-amber-100 rounded-full items-center justify-center mb-6">
        <Text style={{ fontSize: 48 }}>⏳</Text>
      </View>

      <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
        Čekaš odobrenje
      </Text>
      <Text className="text-gray-500 text-base text-center mb-6">
        Tvoj zahtjev za pridruživanje OPG-u je poslan. Vlasnik mora odobriti
        pristup unutar aplikacije.
      </Text>

      {joinRequest && (
        <View className="bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4 mb-6 w-full">
          <Text className="text-amber-800 font-semibold mb-1">Status zahtjeva</Text>
          <Text className="text-amber-700 text-sm">
            Poslan: {new Date(joinRequest.created_at).toLocaleDateString('hr-HR')}
          </Text>
          <View className="flex-row items-center mt-2">
            <View className="w-2.5 h-2.5 bg-amber-500 rounded-full mr-2" />
            <Text className="text-amber-700 font-semibold text-sm">Na čekanju</Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        className={`bg-green-600 rounded-xl px-8 py-4 flex-row items-center mb-4 ${saving ? 'opacity-60' : ''}`}
        onPress={handleCheckStatus}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <RefreshCw size={18} color="#fff" />
            <Text className="text-white font-semibold text-base ml-2">
              Provjeri status
            </Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity className="py-3" onPress={() => signOut()}>
        <Text className="text-gray-400 text-sm">Odjavi se</Text>
      </TouchableOpacity>
    </View>
  );
}
