"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setErr(error.message);
    else router.push("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <form onSubmit={signIn} className="w-full max-w-sm space-y-4 rounded-md border border-line bg-panel p-6">
        <div>
          <h1 className="text-xl font-semibold text-acid">Operator</h1>
          <p className="panel-title mt-1">Sign in to your OS</p>
        </div>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          className="w-full rounded border border-line bg-panel2 px-3 py-2 text-[13px] text-ghost outline-none focus:border-acid/50"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          className="w-full rounded border border-line bg-panel2 px-3 py-2 text-[13px] text-ghost outline-none focus:border-acid/50"
        />
        {err && <p className="text-[12px] text-red-400">{err}</p>}
        <button
          disabled={loading}
          className="w-full rounded bg-acid py-2 text-[13px] font-semibold text-ink hover:bg-acid/90 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
