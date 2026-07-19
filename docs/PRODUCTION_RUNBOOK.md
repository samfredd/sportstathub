# Production deployment and rollback

## Required configuration

Before deployment, provide unique production values for database and Redis passwords, `SECRET_KEY`, `MFA_ENCRYPTION_KEY`, `METRICS_TOKEN`, `RESEND_API_KEY`, deployment SSH password/known-host fingerprint, domain/ACME email, and every enabled provider. Paystack requires both keys; OddSwitch callbacks require `ODDSWITCH_WEBHOOK_SIGNING_SECRET`.

Rotate any credential that has ever appeared in Git history. Merely replacing an example value does not revoke it.

## Deploy

Steps 1–5 below are automated by `.github/workflows/production.yml`'s `deploy`
job on every push to `main` (or manual dispatch with `deploy: true`). This
section documents what the workflow actually does, so an operator can reason
about a run without re-reading the script.

1. **Backup**: a `pg_dump` of the live database is taken and gzip-integrity
   checked before anything else touches the database. An empty or corrupt
   backup aborts the deploy. Backups land in `$PRODUCTION_APP_DIR/backups/`
   on the host, named `pre-deploy-<UTC timestamp>-<commit SHA>.sql.gz`.
2. **Migrations**: run once, in a dedicated one-off `docker compose run --rm
   backend node dist/migrate.js` container — never implicitly on every
   backend container boot (see `backend/docker-entrypoint.sh`). A migration
   failure aborts the deploy before any new container serves traffic; the
   previous release keeps running untouched.
3. **Release**: images pinned to the exact Git commit SHA are pulled and
   started (`docker compose up -d`). Never `latest` for a production release.
4. **Health + smoke tests**: per-container Docker healthchecks are polled
   first, then `deploy/smoke-test.sh` runs against the live domain —
   `/health/live`, `/health/ready` (DB + Redis), homepage, public
   leagues/live-matches endpoints, a non-destructive `/api/subscription-plans`
   read, a frontend static asset, and that `/auth/login` responds with a
   clean 4xx rather than hanging or 5xx-ing.
5. **On failure**: any of steps 3–4 failing triggers an automatic rollback —
   the previous release's images (recorded in `.last_successful_tag` by the
   prior successful deploy) are redeployed. **The database is never
   auto-reverted** — an irreversible-migration auto-rollback can silently
   corrupt data. If the just-applied migration is genuinely incompatible with
   the rolled-back image, restore the pre-deploy backup from step 1 manually
   (see Rollback below) — this requires a human decision, not automation.
   Image/build-cache pruning only happens after a successful deploy, so a
   failed deploy always has the previous release's images available locally
   for an instant rollback without re-pulling from GHCR.

After a successful automated deploy, still manually verify: admin MFA
login, a premium-access denial, and a sandbox Paystack verification, since
those require real credentials/test fixtures the smoke script doesn't have.
Watch error rate, payment reconciliation failures, webhook failures, AI
quota pressure, SSE connections, and OddSwitch job failures during the
rollout window.

The current GitHub workflow authenticates with `PRODUCTION_USER` and `PRODUCTION_PASSWORD`. It connects to `PRODUCTION_HOST` on `PRODUCTION_SSH_PORT` (port 22 by default). `PRODUCTION_HOST_FINGERPRINT` is optional: when set, the SSH action verifies it; when unset, host-key verification is skipped rather than blocking the deploy. Get a fingerprint to set with `ssh-keyscan -t ed25519 <host> | ssh-keygen -lf -`. The old environment-copy deployment was removed; secrets are supplied to the immutable-image deployment at runtime.

## Bootstrap an administrator

Run this only from a protected operator shell after migrations:

```bash
cd backend
npm run seed-admin -- admin@example.com 'a-unique-long-password' initial-admin
```

The account cannot use admin routes until TOTP enrollment is completed. Create later admins through the invitation flow, not the seed command.

## Rollback

An image-only rollback (previous release, current database) happens
automatically when a deploy's health checks or smoke tests fail — see
"On failure" above. Use this section when you need to roll back **after** a
deploy already succeeded and passed smoke tests, or when the automatic
rollback itself needs a manual follow-up.

1. Stop routing new traffic if data integrity is at risk (e.g. `docker
   compose -f docker-compose.prod.yml stop backend frontend` on the host).
2. Roll application images back to the recorded prior commit SHA: SSH in and
   run `IMAGE_TAG=<previous sha> docker compose -f docker-compose.prod.yml
   up -d --remove-orphans`, or re-trigger the workflow via `workflow_dispatch`
   pinned to that commit.
3. Do not blindly reverse migrations: they contain security/session/payment/moderation/notification records and additive columns, and the migration runner (`backend/migrate.ts`) re-executes every `.sql` file on every run with no per-migration tracking — hand-editing an already-applied migration file is not a safe undo mechanism. The old application should tolerate additive changes. Restore the pre-deploy database backup (`$PRODUCTION_APP_DIR/backups/pre-deploy-*.sql.gz` on the host) only when the release wrote incompatible/corrupt data, and only after preserving incident evidence (export the current DB state first if at all possible).
4. If a signing/session secret was implicated, revoke it and invalidate sessions; do not restore the compromised value to make old sessions work.
5. Re-run liveness/readiness plus the critical login and payment smoke tests (`deploy/smoke-test.sh https://<domain>`), then record the rollback and root cause.

## Host hardening (password-based SSH deployment)

Password-based SSH deployment is a deliberate, documented choice for this
project (see commit history: key-based auth was tried and repeatedly failed
to parse in this environment). It stays supported. These are host-level
configuration steps outside this repository's files — apply them once,
directly on the production host, and re-verify after any host rebuild:

- **Restrict the deployment user.** Create a dedicated non-root user for
  `PRODUCTION_USER` (do not deploy as `root`), and grant it only what it
  needs: membership in the `docker` group (or equivalent), and write access
  to `PRODUCTION_APP_DIR`. It should not have sudo access beyond what
  Docker itself requires.
- **Disable root SSH login.** In `/etc/ssh/sshd_config`, set
  `PermitRootLogin no`, then `systemctl reload sshd`.
- **Scope password authentication.** Prefer `Match User <deploy-user>` +
  `PasswordAuthentication yes` for the deployment account specifically, with
  `PasswordAuthentication no` as the global default for every other account,
  if the host supports other accounts. If the deploy user is the only
  account that ever needs password auth, this keeps the blast radius of a
  leaked password limited to that one account's `docker`-group privileges.
- **Install and enable Fail2ban** (or equivalent) on the `sshd` jail to
  rate-limit and temporarily ban repeated failed SSH auth attempts:
  `apt install fail2ban`, ensure the `[sshd]` jail is enabled in
  `/etc/fail2ban/jail.local`.
- **Firewall-level SSH rate limiting** as defense in depth alongside
  Fail2ban, e.g. with `ufw`: `ufw limit OpenSSH` (or the equivalent
  `iptables`/`nftables` recent-connections rule) caps new connection
  attempts per source IP per time window.
- **Strong password policy and rotation.** The deployment password
  (`PRODUCTION_PASSWORD` secret) should be long and randomly generated (a
  password manager, not a memorized phrase), rotated on a schedule (e.g.
  every 90 days) and immediately after any suspected exposure, and updated
  in GitHub Secrets in the same change. Never log it — the deploy script
  never echoes `$APP_...PASSWORD`-shaped values, and any change to that
  script must preserve that.
- **Host fingerprint (optional).** `PRODUCTION_HOST_FINGERPRINT` is not
  currently required by this workflow — if unset, the SSH action skips
  host-key verification rather than blocking the deploy. If you do set it,
  keep it current: regenerate with `ssh-keyscan -t ed25519 <host> |
  ssh-keygen -lf -` and update the GitHub secret whenever the host is
  rebuilt or its SSH host key rotates, since a stale value there would
  actively reject a legitimate host.

## External/manual follow-up

- Revoke and replace previously exposed API-Football credentials at the provider.
- Verify the sending domain in Resend and validate deliverability, SPF, DKIM, and DMARC.
- Configure Paystack webhook URL and signing secret in the provider dashboard; exercise refund/chargeback test events before claiming full lifecycle support.
- Store the OddSwitch signing secret on both sender and callback receiver and validate signature verification there.
- Scrape backend `GET /metrics` with `Authorization: Bearer $METRICS_TOKEN` and route structured `securityAlert` / `operationalAlert` log records to the operator's paging system. The API emits Prometheus request counts and latency histograms plus built-in spike alerts; the deployment still needs an operator-owned monitoring destination.
- In Admin → AI Controls, set quotas, per-instance concurrency, and output-token limits to the approved provider budget. Review `ai_usage_events` against provider invoices.
