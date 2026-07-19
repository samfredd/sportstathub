# Production deployment and rollback

## Required configuration

Before deployment, provide unique production values for database and Redis passwords, `SECRET_KEY`, `MFA_ENCRYPTION_KEY`, `METRICS_TOKEN`, `RESEND_API_KEY`, deployment SSH password/known-host fingerprint, domain/ACME email, and every enabled provider. Paystack requires both keys; OddSwitch callbacks require `ODDSWITCH_WEBHOOK_SIGNING_SECRET`.

Rotate any credential that has ever appeared in Git history. Merely replacing an example value does not revoke it.

## Deploy

1. Take a tested PostgreSQL backup and record the currently deployed immutable image SHA.
2. Run secret scanning, production dependency audit, TypeScript typechecks/tests/builds, frontend lint/build, OddSwitch Ruff/tests, and Docker image builds.
3. Apply migrations once with `cd backend && npm run migrate`. Migrations 015–021 are additive/backfilled and are safe to re-run.
4. Deploy images pinned to the Git commit SHA. Do not use `latest` for a production release.
5. Require `GET /health/live` and `GET /health/ready` to succeed before routing traffic. Fetch `/openapi.json` as a contract smoke test.
6. Smoke-test login/refresh/logout, admin MFA, public search, a premium access denial, and a sandbox Paystack verification. Verify payment and OddSwitch workers are consuming their queues.
7. Watch error rate, payment reconciliation failures, webhook failures, AI quota pressure, SSE connections, and OddSwitch job failures during the rollout window.

The current GitHub workflow authenticates with `PRODUCTION_USER` and `PRODUCTION_PASSWORD`. It connects to `PRODUCTION_HOST` on `PRODUCTION_SSH_PORT` (port 22 by default) and validates `PRODUCTION_HOST_FINGERPRINT` when that secret is configured. The old environment-copy deployment was removed; secrets are supplied to the immutable-image deployment at runtime.

## Bootstrap an administrator

Run this only from a protected operator shell after migrations:

```bash
cd backend
npm run seed-admin -- admin@example.com 'a-unique-long-password' initial-admin
```

The account cannot use admin routes until TOTP enrollment is completed. Create later admins through the invitation flow, not the seed command.

## Rollback

1. Stop routing new traffic if data integrity is at risk.
2. Roll application images back to the recorded prior commit SHA.
3. Do not blindly reverse migrations 015–021: they contain security/session/payment/moderation/notification records and additive columns. The old application should tolerate the additions. Restore the pre-deploy database backup only when the release wrote incompatible/corrupt data and after preserving incident evidence.
4. If a signing/session secret was implicated, revoke it and invalidate sessions; do not restore the compromised value to make old sessions work.
5. Re-run liveness/readiness plus the critical login and payment smoke tests, then record the rollback and root cause.

## External/manual follow-up

- Revoke and replace previously exposed API-Football credentials at the provider.
- Verify the sending domain in Resend and validate deliverability, SPF, DKIM, and DMARC.
- Configure Paystack webhook URL and signing secret in the provider dashboard; exercise refund/chargeback test events before claiming full lifecycle support.
- Store the OddSwitch signing secret on both sender and callback receiver and validate signature verification there.
- Scrape backend `GET /metrics` with `Authorization: Bearer $METRICS_TOKEN` and route structured `securityAlert` / `operationalAlert` log records to the operator's paging system. The API emits Prometheus request counts and latency histograms plus built-in spike alerts; the deployment still needs an operator-owned monitoring destination.
- In Admin → AI Controls, set quotas, per-instance concurrency, and output-token limits to the approved provider budget. Review `ai_usage_events` against provider invoices.
