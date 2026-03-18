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
import { Leaf } from 'lucide-react-native';
import { signIn } from '@/services/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Unesite email i lozinku.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: authError } = await signIn(email.trim(), password);
    setLoading(false);
    if (authError) {
      if (authError.toLowerCase().includes('confirm')) {
        setError('Email nije potvrđen. Provjerite inbox ili isključite potvrdu emaila u Supabase postavkama.');
      } else if (authError.toLowerCase().includes('invalid')) {
        setError('Pogrešan email ili lozinka.');
      } else {
        setError(authError);
      }
    }
    // _layout.tsx sluša onAuthStateChange i automatski preusmjerava na /(tabs)
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
        <View className="flex-1 bg-white px-6 justify-center">
          {/* Logo */}
          <View className="items-center mb-10">
            <View className="w-20 h-20 bg-green-600 rounded-full items-center justify-center mb-4">
              <Leaf size={40} color="#ffffff" />
            </View>
            <Text className="text-3xl font-bold text-gray-900">AgroPlan</Text>
            <Text className="text-gray-500 mt-1">Upravljanje OPG-om</Text>
          </View>

          {/* Form */}
          <Text className="text-2xl font-bold text-gray-900 mb-6">Prijava</Text>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50"
              placeholder="ime@primjer.hr"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View className="mb-2">
            <Text className="text-sm font-medium text-gray-700 mb-1">Lozinka</Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 bg-gray-50"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <Text className="text-red-700 text-sm">{error}</Text>
            </View>
          )}

          <TouchableOpacity
            className="bg-green-600 rounded-xl py-4 items-center mt-4"
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-semibold text-base">Prijavi se</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-6 items-center"
            onPress={() => router.push('/(auth)/register')}
          >
            <Text className="text-gray-500">
              Nemate račun?{' '}
              <Text className="text-green-600 font-semibold">Registrirajte se</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
