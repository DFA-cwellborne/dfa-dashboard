/**
 * sync_log is publicly readable (anon key, RLS-gated to SELECT only) so the
 * dashboard can show sync history to any visitor — which means error text
 * stored there is public too, as are GitHub Actions logs on a public repo.
 * Google's client library (and raw HTTP errors) can embed the full request
 * URL, including an API-key query param, in the error message. Strip anything
 * that looks like a secret before it's ever logged or persisted.
 */
export function redactSecrets(message: string): string {
  return message
    .replace(/([?&](?:key|api_key|apikey|token)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
}
