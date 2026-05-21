import asyncio
import os
import sys

# Add the project root to sys.path so we can import 'app'
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.browser.adapters.sportybet import SportyBetAdapter
from app.browser.adapters.bet9ja import Bet9jaAdapter
from app.workers.normalizer import NormalizerWorker
from app.db.repository import MappingRepository, SlipRepository

async def test_reverse_pipeline():
    print("\n--- ODDSWITCH ENGINE REVERSE PIPELINE TEST ---")
    print("Testing SportyBet -> Bet9ja Translation")

    # 1. Setup DB
    engine = create_async_engine("postgresql+asyncpg://oddswitch:oddswitch@localhost:5432/oddswitch", echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    # We will generate a SportyBet code first using a LIVE Bet9ja event to ensure it exists
    print("\n[PRE-FLIGHT] Finding a live event to test...")
    b9_adapter = Bet9jaAdapter()

    # 1. Start Playwright and fetch an event from Bet9ja
    page = await b9_adapter._get_page()
    await page.goto("https://sports.bet9ja.com/", timeout=30000)
    import asyncio
    await asyncio.sleep(3)
    b9_events = await b9_adapter._fetch_all_events(page)

    if not b9_events:
        print("FAILED TO FETCH LIVE EVENTS FROM BET9JA")
        return

    ev = b9_events[0]
    ev_name = ev.get("N", "")
    parts = ev_name.split(" - ")
    if len(parts) == 2:
        home, away = parts
    else:
        home, away = ev_name, ev_name

    print(f"Using Live Event: {ev_name}")

    sb_adapter = SportyBetAdapter()

    # Create a dummy payload to generate a SportyBet code
    slip_data = {
        "legs": [
            {
                "event": f"{home} vs {away}",
                "home_team": home,
                "away_team": away,
                "market": "Match Result",
                "selection": "Home",
                "odds": 2.0
            }
        ]
    }

    try:
        source_code = await sb_adapter.generate_booking_code(slip_data)
        print(f"Generated SportyBet Code: {source_code}")
    except Exception as e:
        print(f"FAILED TO GENERATE TEST CODE: {e}")
        # Try one more event just in case
        ev = b9_events[1]
        ev_name = ev.get("N", "")
        parts = ev_name.split(" - ")
        if len(parts) == 2: home, away = parts
        else: home, away = ev_name, ev_name
        print(f"Retrying with Live Event: {ev_name}")
        slip_data["legs"][0]["event"] = f"{home} vs {away}"
        slip_data["legs"][0]["home_team"] = home
        slip_data["legs"][0]["away_team"] = away
        try:
            source_code = await sb_adapter.generate_booking_code(slip_data)
            print(f"Generated SportyBet Code: {source_code}")
        except Exception as e2:
            print(f"FAILED SECOND ATTEMPT: {e2}")
            return

    print(f"\n[STEP 1] Extraction (SportyBet API) -> Code: {source_code}")
    try:
        raw_slip = await sb_adapter.resolve_booking_code(source_code)
        print(f"Success! Extracted {len(raw_slip.legs)} legs.")
    except Exception as e:
        print(f"EXTRACTION FAILED: {e}")
        return

    print("\n[STEP 2] Normalization (Raw -> Canonical)")
    async with async_session() as session:
        mapping_repo = MappingRepository(session)
        slip_repo = SlipRepository(session)
        normalizer = NormalizerWorker(mapping_repo, slip_repo, session)

        try:
            canonical_slip = await normalizer.normalize(raw_slip)
            await session.commit()
            print(f"Success! Normalized {len(canonical_slip.legs)} legs.")
            for leg in canonical_slip.legs:
                print(f"  -> {leg.event_name} | {leg.market} | {leg.selection} @ {leg.odds}")
        except Exception as e:
            print(f"NORMALIZATION FAILED: {e}")
            return

    print("\n[STEP 3] Target Matching (Canonical -> Bet9ja Format)")
    # Since we are bypassing the adapter's format conversion and doing it inside
    # Bet9jaAdapter.generate_booking_code via fuzzy matching, we can just pass
    # the canonical slip JSON straight to the adapter!
    target_slip_data = canonical_slip.model_dump(mode="json")
    print(f"Prepared slip data for generation with {len(target_slip_data['legs'])} legs.")

    print("\n[STEP 4] Generation (Bet9ja BookABetV2 API via Playwright)")
    b9_adapter = Bet9jaAdapter()
    try:
        generated_code = await b9_adapter.generate_booking_code(target_slip_data)
        print(f"\nSUCCESS! Conversion Complete.")
        print(f"SportyBet Code: {source_code}")
        print(f"Bet9ja Code:    {generated_code}")
    except Exception as e:
        print(f"GENERATION FAILED: {e}")
    finally:
        await sb_adapter.close()
        await b9_adapter.close()
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_reverse_pipeline())
