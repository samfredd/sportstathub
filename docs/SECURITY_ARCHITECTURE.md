# Security architecture

## Identity and sessions

- Browser access and refresh tokens are `httpOnly`, `Secure` in production, and never stored in web storage. Local storage contains only a non-authoritative user display descriptor.
- Access tokens are short-lived and carry a session ID plus session version. Every protected request loads the database session and current user status; suspended, banned, revoked, expired, or version-mismatched sessions are rejected.
- Refresh tokens are random opaque values. Only their hashes are stored. Rotation is transactional, allows a narrow concurrent-tab grace result, and revokes the complete token family on reuse.
- Registration state is stored in Redis under a random browser-bound challenge. A permanent user is created only after the challenge and OTP are atomically validated.
- Password resets/changes and security-sensitive role/status changes revoke sessions. Users can inspect and revoke active devices from Settings.

## Administrator boundary

- There is no public permanent-admin registration route. The first admin is created by the explicit `npm run seed-admin -- <email> <password> <username>` operator command, which has no default credentials and never promotes an existing account.
- Subsequent administrators require a short-lived, one-time, intended-recipient invitation created by a recently authenticated admin. Only a hash of the invitation token is stored.
- Administrators must enroll TOTP MFA before receiving an admin session. TOTP secrets are AES-256-GCM encrypted and recovery codes are individually password-hashed.
- Final-active-admin demotion, suspension, and deletion are rejected under a database advisory lock. Admin mutations and invitation use are audit logged.

## Payments

- Paystack webhook bodies are verified with HMAC-SHA512 over the raw request bytes. Missing configuration fails closed and invalid signatures are rejected.
- Valid events are committed to `payment_webhook_events` before acknowledgement and processed by a retryable database worker.
- Verification, payment settlement, subscription replacement/renewal, and linkage occur transactionally under row locks. Duplicate events and browser/webhook races are idempotent.
- Reconciliation checks stale pending/processing transactions and records every attempt. Early renewal extends from the current paid expiry rather than discarding remaining time.
- The current product is manual-renewal: no recurring debit mandate is created. Refund, chargeback, grace-period, and receipt workflows remain provider/product work and must not be represented as implemented.

## OddSwitch

- Every job belongs to a non-null API-key tenant. API reads, Redis caches, deduplication keys, worker state, and callbacks preserve that tenant boundary.
- Callback URLs reject credentials, fragments, non-HTTP schemes, local/private/reserved addresses, and non-HTTPS production targets. DNS is re-resolved before every delivery and redirects are disabled.
- Callbacks include delivery ID, event, timestamp, and an HMAC signature. Booking codes are represented in logs only by a SHA-256 fingerprint.
- Celery retries remain non-terminal until exhausted; only the final failure updates durable job state and clears tenant deduplication.

## Application and edge controls

- Exact proxy addresses are trusted; arbitrary forwarded client IP headers are not.
- The frontend emits a per-request CSP nonce and a restrictive production policy. API CORS is an allowlist with credentials.
- AI requires authenticated feature access, daily user/IP quotas, bounded concurrency, provider timeouts, and model/status-aware cache keys and TTLs.
- Live SSE uses shared upstream polling, origin validation, global/user/IP caps, heartbeat, backpressure handling, and maximum connection age.
- Contact and tracking endpoints use tight rate limits and strict schemas. RSS parsing uses a real XML parser, safe URLs, per-item isolation, deduplication, and stale fallback.

## Secret handling

Use a protected deployment environment or secret manager. Never store production values in `.env.example`, Git history, build arguments, logs, tickets, or chat. Follow [SECRET_ROTATION.md](./SECRET_ROTATION.md) after any suspected disclosure.
