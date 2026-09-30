import { createBrowserClient } from "@supabase/ssr";

// One shared Supabase client for the browser.
// Reads your project URL + anon key from .env.local.
// The anon key is safe to expose to the browser — Row Level Security
// is what actually protects your data.
//
// We fall back to harmless placeholders when the env vars are missing so
// that `next build` (and CI) can prerender the pages without secrets. The
// client is only ever *used* in the browser at runtime, where your real
// .env.local / Vercel env values are present.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createBrowserClient(url, anonKey);

// True only when real credentials are configured. Handy for showing a
// friendly "not configured yet" state instead of failing queries.
export const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
