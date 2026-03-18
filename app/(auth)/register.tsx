import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { signUp } from '@/services/api';

export default function RegisterScreen() {
  const [form, setForm] = useState({
    punoIme: '',
    email: '',
    password: '',
    passwordConfirm: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleRegister() {
    const { punoIme, email, password, passwordConfirm } = form;

    if (!punoIme.trim() || !email.trim() || !password) {
      setError('Sva polja su obavezna.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Lozinke se ne podudaraju.');
      return;
    }
    if (password.length < 6) {
      setError('Lozinka mora imati najmanje 6 znakova.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError } = await signUp(
      email.trim(),
      password,
      punoIme.trim()
    );

    setLoading(false);

    if (authError) {
      if (
        authError.toLowerCase().includes('already registered') ||
        authError.toLowerCase().includes('already been registered')
      ) {
        setError('Email je već registriran. Prijavite se ili koristite drugi email.');
      } else {
        setError(authError);
      }
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <View className="flex-1 bg-white px-6 justify-center items-center">
        <View className="w-24 h-24 bg-green-100 rounded-full items-center justify-center mb-6">
          <Text style={{ fontSize: 48 }}>📧</Text>
        </View>

        <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Provjerite email!
        </Text>
        <Text className="text-green-700 font-semibold text-center mb-4">
          {form.email}
        </Text>

        <View className="bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4 mb-6 w-full">
          <Text className="text-amber-800 font-semibold mb-2">
            ⚠️ Potvrda emaila je obavezna
          </Text>
          <Text className="text-amber-700 text-sm leading-5">
            1. Otvorite inbox na gornjoj email adresi{'\n'}
            2. Pronađite email od{' '}
            <Text className="font-semibold">noreply@supabase.io</Text>
            {'\n'}
            3. Kliknite na link za potvrdu{'\n'}
            4. Vratite se ovdje i prijavite se
          </Text>
        </View>

        <View className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 mb-6 w-full">
          <Text className="text-blue-800 font-semibold mb-1">
            📋 Nakon prijave
          </Text>
          <Text className="text-blue-700 text-sm leading-5">
            Možete kreirati vlastiti OPG ili se pridružiti postojećem OPG-u
            pomoću koda koji vam da vlasnik.
          </Text>
        </View>

        <Text className="text-gray-400 text-xs text-center mb-6">
          Nema emaila? Provjerite spam/junk mapu.{'\n'}
          Supabase šalje sa: noreply@mail.app.supabase.io
        </Text>

        <TouchableOpacity
          className="bg-green-600 rounded-xl px-10 py-4 w-full items-center"
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text className="text-white font-semibold text-base">
            Već sam potvrdio — Prijavi me
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 bg-white px-6 pt-14 pb-8">
          <TouchableOpacity
            className="flex-row items-center mb-6"
            onPress={() => router.back()}
          >
            <ChevronLeft size={20} color="#16a34a" />
            <Text className="text-green-600 ml-1">Natrag</Text>
          </TouchableOpacity>

          <Text className="text-2xl font-bold text-gray-900 mb-2">
            Registracija
          </Text>
          <Text className="text-gray-500 mb-2">
            Kreirajte osobni račun za pristup AgroPlan aplikaciji.
          </Text>
          <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-8">
            <Text className="text-green-700 text-sm">
              🌱 Nakon registracije možete kreirati vlastiti OPG ili se
              pridružiti postojećem.
            </Text>
          </View>

          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Osobni podaci
          </Text>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Ime i prezime *
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50"
              placeholder="Ivan Horvat"
              value={form.punoIme}
              onChangeText={(v) => update('punoIme', v)}
              autoCapitalize="words"
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Email *
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50"
              placeholder="ivan@primjer.hr"
              value={form.email}
              onChangeText={(v) => update('email', v)}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Lozinka *
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50"
              placeholder="Min. 6 znakova"
              value={form.password}
              onChangeText={(v) => update('password', v)}
              secureTextEntry
            />
          </View>

          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Potvrdi lozinku *
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50"
              placeholder="Ponovi lozinku"
              value={form.passwordConfirm}
              onChangeText={(v) => update('passwordConfirm', v)}
              secureTextEntry
            />
          </View>

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <Text className="text-red-700 text-sm">{error}</Text>
            </View>
          )}

          <TouchableOpacity
            className="bg-green-600 rounded-xl py-4 items-center mt-2"
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-semibold text-base">
                Kreiraj račun
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
