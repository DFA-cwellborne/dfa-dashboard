import { Card } from "./Card";

export function SetupNotice() {
  return (
    <Card className="border-gold/40 bg-gold/5">
      <h2 className="text-lg font-semibold text-navy">Connect Supabase to see data</h2>
      <p className="mt-2 max-w-xl text-sm text-navy/70">
        This dashboard reads only from its Supabase sync layer — never directly from Google
        Sheets/Airtable on page load. Copy <code className="rounded bg-navy/10 px-1 py-0.5">.env.local.example</code>{" "}
        to <code className="rounded bg-navy/10 px-1 py-0.5">.env.local</code>, fill in your Supabase
        project URL/keys, run the migration in{" "}
        <code className="rounded bg-navy/10 px-1 py-0.5">supabase/migrations/0001_init.sql</code>, then set{" "}
        <code className="rounded bg-navy/10 px-1 py-0.5">USE_MOCK_DATA=true</code> and trigger a sync from the
        Admin page to verify everything end-to-end with generated sample data before wiring up real
        credentials.
      </p>
    </Card>
  );
}
