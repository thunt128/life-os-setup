import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// One shared Supabase client for the browser.
// Reads your project URL + anon key from .env.local.
// The anon key is safe to expose to the browser — Row Level Security
// is what actually protects your data.
//
// The client is created lazily, on first use in the browser, rather than
// at import time. That matters because Next prerenders these pages during
// `next build`, where the NEXT_PUBLIC_* env vars may not be present — and
// `createBrowserClient` throws if the URL/key are missing. Deferring creation
// keeps the build (and deploys) working even before the env is wired up; the
// client is only ever instantiated in the browser, where the env is set.

let _client: SupabaseClient | null = null;

function realClient(): SupabaseClient {
  if (_client) return _client;
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return _client;
}

// A lazy proxy so existing call sites (`supabase.auth…`, `supabase.from(…)`)
// keep working unchanged, while the underlying client is only built on first
// property access — never at module load / prerender time.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const value = (realClient() as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(realClient()) : value;
  },
});
