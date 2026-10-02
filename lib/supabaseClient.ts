import { createBrowserClient } from "@supabase/ssr";

// One shared Supabase client for the browser.
// Reads your project URL + anon key from .env.local.
// The anon key is safe to expose to the browser — Row Level Security
// is what actually protects your data.
//
// During `next build` (and on Vercel before env vars are set), these can
// be undefined. createBrowserClient throws if they are, which fails the
// whole build at prerender time. Fall back to harmless placeholders so
// pages can prerender; the real values are used in the browser at runtime.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// True only when both values are present — handy for showing a setup hint.
export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = createBrowserClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-anon-key"
);
