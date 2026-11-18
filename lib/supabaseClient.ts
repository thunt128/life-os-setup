import { createBrowserClient } from "@supabase/ssr";

// One shared Supabase client for the browser.
// Reads your project URL + anon key from .env.local.
// The anon key is safe to expose to the browser — Row Level Security
// is what actually protects your data.
//
// The fallbacks below are harmless placeholders used ONLY when the env
// vars are absent (e.g. during `next build`, which prerenders these
// client pages on the server where no browser env is injected). At
// runtime in the browser the real values from .env.local are used, so
// the login flow and live queries are unaffected. Without these, the
// build throws "URL and API key are required" while prerendering.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-placeholder";

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
