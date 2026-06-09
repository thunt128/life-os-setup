import { createBrowserClient } from "@supabase/ssr";

// One shared Supabase client for the browser.
// Reads your project URL + anon key from .env.local.
// The anon key is safe to expose to the browser — Row Level Security
// is what actually protects your data.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
