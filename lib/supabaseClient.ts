import { createBrowserClient } from "@supabase/ssr";

// One shared Supabase client for the browser.
// Reads your project URL + anon key from .env.local (inlined at build time
// because they are NEXT_PUBLIC_*). The anon key is safe to expose to the
// browser — Row Level Security is what actually protects your data.
//
// When the env vars are missing (e.g. a CI build or a local build before you
// have added .env.local) we fall back to harmless placeholder values so the
// app still compiles and prerenders. With placeholders the client simply
// can't reach a real project — set the real values to make it live.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createBrowserClient(url, anonKey);
