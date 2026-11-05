"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";
import { publicEnv } from "@/config/publicEnv";
import { readUnlocked, sha256Hex, storeUnlocked } from "@/lib/security/passwordGate";

/**
 * A casual-visitor gate, not real access control. This is a static export
 * with no server — the Supabase anon key ships in this same JS bundle
 * either way, and answers queries directly regardless of this screen. This
 * only keeps someone who doesn't know the staff password from opening the
 * page normally; it doesn't hide the underlying data from anyone who reads
 * the bundle or inspects network requests. Don't rely on it to protect
 * anything that would be a real problem if read that way.
 *
 * With no password configured (NEXT_PUBLIC_DASHBOARD_PASSWORD_HASH unset —
 * the normal case for local dev), the gate is skipped entirely.
 */
export function PasswordGate({ children }: { children: ReactNode }) {
  const expectedHash = publicEnv.dashboardPasswordHash;
  const [checked, setChecked] = useState(!expectedHash);
  const [unlocked, setUnlocked] = useState(!expectedHash);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!expectedHash) return;
    // localStorage isn't available during the static export's build-time
    // prerender, so this can't be computed during render without a
    // server/client hydration mismatch — it has to run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnlocked(readUnlocked(expectedHash));
    setChecked(true);
  }, [expectedHash]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!expectedHash) return;
    const hash = await sha256Hex(input);
    if (hash === expectedHash) {
      storeUnlocked(hash);
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  }

  // Wait for the one-time localStorage check so a returning visitor doesn't
  // see a flash of the password form before the page settles.
  if (!checked) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2] p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-navy/10 bg-white p-6 shadow-[0_1px_2px_rgba(31,43,81,0.06),0_8px_24px_-12px_rgba(31,43,81,0.15)]"
      >
        <Logo />
        <h1 className="mt-4 text-lg font-semibold text-navy">Staff dashboard</h1>
        <p className="mt-1 text-sm text-navy/60">Enter the staff password to continue.</p>
        <input
          type="password"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(false);
          }}
          autoFocus
          aria-label="Staff password"
          className="mt-4 w-full rounded-lg border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-blue"
          placeholder="Password"
        />
        {error && (
          <p role="alert" className="mt-2 text-xs text-red">
            Incorrect password.
          </p>
        )}
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
