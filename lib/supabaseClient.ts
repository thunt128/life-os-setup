import { createBrowserClient } from "@supabase/ssr";

// One shared Supabase client for the browser.
// Reads your project URL + anon key from .env.local.
// The anon key is safe to expose to the browser — Row Level Security
// is what actually protects your data.
//
// The placeholders below only kick in when the env vars are missing
// (e.g. a CI build with no secrets). They let the app compile and
// prerender without crashing; at runtime, with your real
// NEXT_PUBLIC_SUPABASE_* values set, those real values are used.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export const supabase = createBrowserClient(url, anonKey);

// True only when the app was actually given Supabase credentials.
// Useful for showing a friendly "connect your database" hint instead
// of silently failing when .env.local hasn't been filled in yet.
export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
