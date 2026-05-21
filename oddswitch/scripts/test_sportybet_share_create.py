"""
SportyBet: Create a share code via the API (v3).
Use the event detail API which includes full markets.
"""
import asyncio
import json
import httpx


SPORTYBET_API = "https://www.sportybet.com/api/ng"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Referer": "https://www.sportybet.com/ng/",
    "Origin": "https://www.sportybet.com",
}


async def main():
    print("=" * 60)
    print("  SportyBet: Create Share Code via API (v3)")
    print("=" * 60)

    async with httpx.AsyncClient(headers=HEADERS, timeout=15.0) as client:

        # Get events from liveOrPrematchEvents (these have eventId but not markets)
        print("\n  Getting events from all sports...")

        # Try all sports
        all_event_ids = []
        for sport_id in ["sr:sport:1"]:
            resp = await client.get(f"{SPORTYBET_API}/factsCenter/liveOrPrematchEvents", params={
                "sportId": sport_id, "_t": "1",
            })
            data = resp.json()
            for tournament in data.get("data", []):
                for event in tournament.get("events", []):
                    all_event_ids.append(event["eventId"])

            # Also prematch
            resp = await client.get(f"{SPORTYBET_API}/factsCenter/importantEvents", params={
                "sportId": sport_id, "_t": "1",
            })
            data = resp.json()
            for tournament in data.get("data", []):
                for event in tournament.get("events", []):
                    if event["eventId"] not in all_event_ids:
                        all_event_ids.append(event["eventId"])

        print(f"  Total event IDs: {len(all_event_ids)}")

        # Get full details for first 5 events to find one with active markets
        target_event = None
        target_market = None
        target_outcome = None

        for eid in all_event_ids[:10]:
            resp = await client.get(f"{SPORTYBET_API}/factsCenter/event", params={
                "eventId": eid, "_t": "1",
            })
            ev_data = resp.json().get("data", {})
            markets = ev_data.get("markets", [])

            if not markets:
                continue

            # Find any active market with active outcomes
            for m in markets:
                outcomes = m.get("outcomes", [])
                active = [o for o in outcomes if o.get("isActive") == 1]
                if active:
                    target_event = ev_data
                    target_market = m
                    target_outcome = active[0]
                    break

            if target_event:
                break

        if not target_event:
            print("  No event with active markets found!")
            return

        eid = target_event["eventId"]
        gid = target_event.get("gameId")
        home = target_event.get("homeTeamName")
        away = target_event.get("awayTeamName")
        sport = target_event.get("sport", {})

        print(f"\n  Event: {home} vs {away}")
        print(f"  eventId: {eid}, gameId: {gid}")
        print(f"  Sport: {sport}")
        print(f"  Market: id={target_market['id']}, name={target_market['name']}, specifier={target_market.get('specifier','')}")
        print(f"  Outcome: id={target_outcome['id']}, odds={target_outcome['odds']}")

        # Test payloads
        print("\n  Testing share code creation...")

        payloads = [
            # Format 1: Basic
            {
                "selections": [{
                    "eventId": eid,
                    "marketId": target_market["id"],
                    "specifier": target_market.get("specifier", ""),
                    "outcomeId": target_outcome["id"],
                }]
            },
            # Format 2: With odds as number
            {
                "selections": [{
                    "eventId": eid,
                    "marketId": target_market["id"],
                    "specifier": target_market.get("specifier", ""),
                    "outcomeId": target_outcome["id"],
                    "odds": float(target_outcome["odds"]),
                }]
            },
            # Format 3: All strings
            {
                "selections": [{
                    "eventId": str(eid),
                    "marketId": str(target_market["id"]),
                    "specifier": str(target_market.get("specifier", "")),
                    "outcomeId": str(target_outcome["id"]),
                    "odds": str(target_outcome["odds"]),
                }]
            },
            # Format 4: With sport and product
            {
                "productId": 3,
                "selections": [{
                    "sportId": "sr:sport:1",
                    "eventId": eid,
                    "marketId": target_market["id"],
                    "specifier": target_market.get("specifier", ""),
                    "outcomeId": target_outcome["id"],
                    "odds": float(target_outcome["odds"]),
                }]
            },
            # Format 5: productId=1 (live)
            {
                "productId": 1,
                "selections": [{
                    "sportId": "sr:sport:1",
                    "eventId": eid,
                    "marketId": target_market["id"],
                    "specifier": target_market.get("specifier", ""),
                    "outcomeId": target_outcome["id"],
                    "odds": float(target_outcome["odds"]),
                }]
            },
        ]

        for i, payload in enumerate(payloads):
            resp = await client.post(f"{SPORTYBET_API}/orders/share", json=payload)
            result = resp.json()

            biz = result.get("bizCode")
            msg = result.get("message", "")

            if biz == 10000:
                print(f"\n  ✅ Format {i+1} WORKS!")
                print(f"    Payload: {json.dumps(payload, indent=2)}")
                print(f"    Response: {json.dumps(result, indent=2)[:500]}")

                # Try to resolve the generated code
                code = result.get("data")
                if isinstance(code, dict):
                    code = code.get("shareCode") or code.get("code")
                if code:
                    print(f"\n    Generated code: {code}")
                    # Verify
                    verify = await client.get(f"{SPORTYBET_API}/orders/share/{code}")
                    vdata = verify.json()
                    print(f"    Verify: {json.dumps(vdata)[:400]}")

                break  # Found working format!
            else:
                inner = result.get("innerMsg", "")
                print(f"\n  ❌ Format {i+1}: bizCode={biz} | {msg} | {inner}")

    print("\n  Done!")


if __name__ == "__main__":
    asyncio.run(main())
