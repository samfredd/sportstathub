import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.browser.adapters.sportybet import SportyBetAdapter
from app.browser.adapters.bet9ja import Bet9jaAdapter
from app.workers.normalizer import NormalizerWorker
from app.db.repository import MappingRepository, SlipRepository

async def manual_conversion(source: str, target: str, code: str):
    print(f"\n--- ODDSWITCH CLI CONVERSION ---")
    print(f"Translating {source} -> {target}")
    print(f"Booking Code: {code}\n")

    # 1. Setup DB
    engine = create_async_engine("postgresql+asyncpg://oddswitch:oddswitch@localhost:5432/oddswitch", echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    source_adapter = SportyBetAdapter() if source.lower() == "sportybet" else Bet9jaAdapter()
    target_adapter = SportyBetAdapter() if target.lower() == "sportybet" else Bet9jaAdapter()

    # STEP 1: Extraction
    print(f"[STEP 1] Extracting from {source}...")
    try:
        raw_slip = await source_adapter.resolve_booking_code(code)
        if not raw_slip.legs:
            print("EXTRACTION FAILED: No legs found in slip.")
            return
        print(f"Success! Extracted {len(raw_slip.legs)} legs.")
    except Exception as e:
        print(f"EXTRACTION FAILED: {e}")
        return

    # STEP 2: Normalization
    print("\n[STEP 2] Normalizing to Canonical Format...")
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

    # STEP 3: Matching & Generation
    print(f"\n[STEP 3] Generating {target} Code...")
    target_slip_data = canonical_slip.model_dump(mode="json")

    try:
        generated_code = await target_adapter.generate_booking_code(target_slip_data)
        print(f"\nSUCCESS! Conversion Complete.")
        print(f"Source Code ({source}): {code}")
        print(f"Target Code ({target}): {generated_code}")
    except Exception as e:
        print(f"GENERATION FAILED: {e}")
    finally:
        await source_adapter.close()
        await target_adapter.close()
        await engine.dispose()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OddSwitch Manual Conversion CLI")
    parser.add_argument("--source", type=str, required=True, choices=["sportybet", "bet9ja"], help="Source bookmaker")
    parser.add_argument("--target", type=str, required=True, choices=["sportybet", "bet9ja"], help="Target bookmaker")
    parser.add_argument("--code", type=str, required=True, help="Booking code to translate")

    args = parser.parse_args()

    if args.source == args.target:
        print("Source and target must be different.")
        sys.exit(1)

    asyncio.run(manual_conversion(args.source, args.target, args.code))
