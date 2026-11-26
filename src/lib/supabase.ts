import { createClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    __ENV__?: {
      VITE_SUPABASE_URL?: string;
      VITE_SUPABASE_ANON_KEY?: string;
      SUPABASE_URL?: string;
      SUPABASE_ANON_KEY?: string;
    };
  }
}

const runtimeEnv = typeof window !== 'undefined' ? window.__ENV__ : undefined;

const rawSupabaseUrl =
  runtimeEnv?.VITE_SUPABASE_URL ||
  runtimeEnv?.SUPABASE_URL ||
  (import.meta.env.VITE_SUPABASE_URL as string | undefined);

const supabaseUrl = rawSupabaseUrl
  ? rawSupabaseUrl.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '')
  : undefined;

const supabaseAnonKey = (
  runtimeEnv?.VITE_SUPABASE_ANON_KEY ||
  runtimeEnv?.SUPABASE_ANON_KEY ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
)?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;
