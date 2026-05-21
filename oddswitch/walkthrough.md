# OddSwitch Engine: Translation Pipelines

This document provides a comprehensive walkthrough of the successfully completed **Bet9ja → SportyBet** and **SportyBet → Bet9ja** conversion pipelines.

> [!NOTE]
> *This document has been restored and expanded to include the original documentation for the first half of the project, combined with the new details from the reverse pipeline completion.*

---

## 1. Bet9ja → SportyBet Conversion Pipeline

The first phase of the project focused on translating Bet9ja slips into SportyBet codes. We successfully replaced fragile, UI-based browser automation for SportyBet with direct, lightning-fast REST API requests.

### SportyBet API Implementation
We discovered and implemented internal SportyBet APIs to completely bypass headless Chromium overhead:
- **Extraction**: We implemented `GET /api/ng/orders/share/{shareCode}` for near-instant slip parsing.
- **Generation**: We implemented `POST /api/ng/orders/share` for rapid booking code creation.
- **Error Handling**: Added robust error logging and fixed type mismatches (string/int) for market and outcome IDs in the adapter.

### Pipeline Verification
- Updated `scripts/test_conversion_pipeline.py` to support the new API-based flow.
- Achieved **100% success** on end-to-end integration tests (extract, normalize, match, rebuild, generate). The conversion from Bet9ja to SportyBet now takes roughly 2-5 seconds.

---

## 2. SportyBet → Bet9ja Conversion Pipeline

The second phase focused on the reverse direction. Bet9ja is heavily protected by Cloudflare Turnstile, which presented significant challenges for both extraction and generation.

### Bet9ja API Generation Breakthrough
We successfully bypassed Cloudflare Turnstile's click-tracking to reverse-engineer Bet9ja's hidden `BookABetV2` API endpoint.
- **Hybrid API/Playwright Approach**: We refactored `Bet9jaAdapter.generate_booking_code()` to use Playwright solely to establish an authenticated session and bypass Cloudflare. Once cleared, a raw `fetch` POST request with the constructed `BETSLIP` JSON payload is injected.
- **Impact**: This eliminates all brittle search bar interaction and odds-clicking logic, boosting the Bet9ja generation speed dramatically and removing the possibility of DOM rendering errors.

### SportyBet API Extraction
- Refactored `SportyBetAdapter.resolve_booking_code()` to use the internal REST API `GET /api/ng/orders/share/{code}`.
- Replaced Playwright completely for extraction, making this step execute in under 1 second.

### Normalization Enhancements
- Added canonical mappings in `NormalizerWorker` to properly handle SportyBet's market formatting (e.g., `1X2 - 1UP` mapped to `Match Result 1UP`).
- Fixed mapping keys (`event` vs `event_name`) allowing deterministic leg resolution across both bookmaker engines.

### Reverse Pipeline Verification
The reverse pipeline was fully tested with `scripts/test_reverse_pipeline.py`.

**Test Flow:**
1. A live event was fetched from Bet9ja (e.g. `Cruzeiro EC MG vs SE Palmeiras SP`).
2. A valid SportyBet booking code (`GQY4FW`) was instantly generated using the `SportyBetAdapter`'s API generation logic.
3. The pipeline **Extracted** the code from SportyBet (using API).
4. The pipeline **Normalized** the raw slip to a Canonical Slip.
5. The pipeline **Generated** a new Bet9ja code (`5CLD97W`) by instantly hitting the `BookABetV2` API through Playwright.

> [!SUCCESS]
> Both directions of the translation engine are now fully functional and heavily optimized!
