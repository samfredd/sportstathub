# Secret rotation checklist

Use this checklist after any suspected disclosure and on the organization’s regular rotation schedule.

1. Identify the affected provider and revoke the exposed credential in that provider’s console.
2. Create a replacement with the minimum required scope and, where supported, an expiry date and IP restrictions.
3. Update the production secret manager or protected GitHub environment. Never paste secrets into commits, issues, logs, or chat.
4. Redeploy the affected services and confirm readiness and a provider-specific smoke test.
5. Revoke the old value after the replacement is confirmed. For JWT or MFA encryption-key compromise, invalidate all sessions; re-encrypt or reset MFA enrollment as part of a planned migration.
6. Review audit logs for unauthorized use, record the incident timeline, and notify affected users when required.
7. Run Gitleaks over the full Git history. Removing a value from the current tree does not make a previously committed credential safe.

Credentials covered: database, Redis, JWT signing, MFA encryption, Resend API, Paystack, API-Football/API-Sports, Odds API, NVIDIA, Google OAuth, OddSwitch, container registry, and deployment SSH credentials.
