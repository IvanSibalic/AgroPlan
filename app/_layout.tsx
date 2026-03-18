import '@/global.css';
import { useEffect, useState, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { supabase } from '@/lib/supabase';
import { getUserProfile } from '@/services/api';

export default function RootLayout() {
  useFrameworkReady();

  // undefined = još učitavamo, 'loading' = provjeravamo OPG
  const [status, setStatus] = useState<'loading' | 'done'>('loading');
  const navigated = useRef(false);

  async function handleSignedIn() {
    try {
      const profile = await getUserProfile();
      if (profile?.opg_id) {
        router.replace('/(tabs)');
      } else {
        router.replace('/opg-setup');
      }
    } catch {
      // Greška pri dohvatu profila — ostani na tabs, ne vrti loop
      router.replace('/(tabs)');
    } finally {
      setStatus('done');
    }
  }

  useEffect(() => {
    // Inicijalna provjera sesije
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/(auth)/login');
        setStatus('done');
        return;
      }
      handleSignedIn();
    });

    // Sluša SAMO prijavu i odjavu — ne TOKEN_REFRESHED
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && !navigated.current) {
          navigated.current = true;
          handleSignedIn();
        } else if (event === 'SIGNED_OUT') {
          navigated.current = false;
          setStatus('loading');
          router.replace('/(auth)/login');
        }
        // TOKEN_REFRESHED, USER_UPDATED itd. — ignoriramo
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="opg-setup" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
