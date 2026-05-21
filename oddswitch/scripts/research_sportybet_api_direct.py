"""
SportyBet: Test the event search + selection + share code creation flow.

From the API discovery we know:
  - Events API: GET /api/ng/factsCenter/liveOrPrematchEvents?sportId=sr:sport:1
  - Event detail: GET /api/ng/factsCenter/event?eventId=sr:match:XXXXX
  - Share resolve: GET /api/ng/orders/share/{code}

Goal: Find how to CREATE a share code from a list of outcome IDs.
Approach: Load a share code, see what outcome IDs are used, and find
the event page URL structure for clicking selections.
"""
import asyncio
import json
import httpx


SPORTYBET_API = "https://www.sportybet.com/api/ng"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://www.sportybet.com/ng/",
    "Origin": "https://www.sportybet.com",
}


async def main():
    print("=" * 60)
    print("  SportyBet API: Event Search & Share Code Flow")
    print("=" * 60)

    async with httpx.AsyncClient(headers=HEADERS, timeout=15.0) as client:

        # Step 1: Search for events by team name
        print("\n--- Step 1: Get all live/prematch football events ---")
        resp = await client.get(f"{SPORTYBET_API}/factsCenter/liveOrPrematchEvents", params={
            "sportId": "sr:sport:1",
            "_t": "1",
        })
        data = resp.json()

        events = []
        for tournament in data.get("data", []):
            for event in tournament.get("events", []):
                events.append({
                    "eventId": event["eventId"],
                    "gameId": event.get("gameId"),
                    "home": event.get("homeTeamName", ""),
                    "away": event.get("awayTeamName", ""),
                    "tournament": tournament.get("name", ""),
                    "status": event.get("status"),
                })

        print(f"  Found {len(events)} live/prematch events")
        for e in events[:5]:
            print(f"    {e['eventId']} | {e['home']} vs {e['away']} | {e['tournament']}")

        # Also get prematch events
        print("\n--- Step 1b: Get important/prematch events ---")
        resp2 = await client.get(f"{SPORTYBET_API}/factsCenter/importantEvents", params={
            "sportId": "sr:sport:1",
            "_t": "1",
        })
        data2 = resp2.json()
        for tournament in data2.get("data", []):
            for event in tournament.get("events", []):
                events.append({
                    "eventId": event["eventId"],
                    "gameId": event.get("gameId"),
                    "home": event.get("homeTeamName", ""),
                    "away": event.get("awayTeamName", ""),
                    "tournament": tournament.get("name", ""),
                    "status": event.get("status"),
                })

        print(f"  Total events after prematch: {len(events)}")

        # Step 2: Get markets for first event
        if events:
            ev = events[0]
            print(f"\n--- Step 2: Markets for {ev['home']} vs {ev['away']} ---")
            resp = await client.get(f"{SPORTYBET_API}/factsCenter/event", params={
                "eventId": ev["eventId"],
                "_t": "1",
            })
            mdata = resp.json()

            event_detail = mdata.get("data", {})
            markets = event_detail.get("markets", [])
            print(f"  Markets: {len(markets)}")

            # Show the full structure of the first few markets
            for m in markets[:8]:
                print(f"\n  Market id={m.get('id')} name={m.get('name')} desc={m.get('desc','')}")
                print(f"    specifier: {m.get('specifier', '')}")
                outcomes = m.get("outcomes", [])
                for o in outcomes:
                    print(f"    Outcome: id={o.get('id')} name={o.get('name')} odds={o.get('odds')} isActive={o.get('isActive')}")

            # Step 2b: Look at the full event response structure
            print(f"\n  Event keys: {list(event_detail.keys())}")
            # Print non-market keys
            for key in event_detail:
                if key != "markets":
                    val = event_detail[key]
                    if isinstance(val, (str, int, float, bool)):
                        print(f"    {key}: {val}")
                    elif isinstance(val, list) and len(val) < 5:
                        print(f"    {key}: {val}")

        # Step 3: Try to find the share/book API
        print("\n--- Step 3: Test share code creation API ---")

        # Try different share/booking endpoints
        test_endpoints = [
            ("POST", f"{SPORTYBET_API}/orders/share", {"outcomes": []}),
            ("POST", f"{SPORTYBET_API}/orders/share/create", {"outcomes": []}),
            ("POST", f"{SPORTYBET_API}/orders/v2/share", {"outcomes": []}),
            ("POST", f"{SPORTYBET_API}/factsCenter/share", {"outcomes": []}),
        ]

        for method, url, body in test_endpoints:
            try:
                if method == "POST":
                    resp = await client.post(url, json=body)
                else:
                    resp = await client.get(url)
                print(f"  {method} {url.replace(SPORTYBET_API, '')} → {resp.status_code}")
                text = resp.text[:300]
                print(f"    {text}")
            except Exception as e:
                print(f"  {method} {url.replace(SPORTYBET_API, '')} → Error: {e}")

        # Step 4: Try to find the share code structure by resolving a code
        print("\n--- Step 4: Resolve known share code to see payload format ---")
        # We need a valid code. Let's try a few known patterns
        # First try the format the previous session used
        test_codes = ["6234E4B3F4B4", "A1B2C3D4"]
        for code in test_codes:
            resp = await client.get(f"{SPORTYBET_API}/orders/share/{code}")
            print(f"  Share code {code}: status={resp.status_code}")
            try:
                data = resp.json()
                print(f"    bizCode: {data.get('bizCode')}")
                print(f"    message: {data.get('message')}")
                if data.get("data"):
                    print(f"    data keys: {list(data['data'].keys()) if isinstance(data['data'], dict) else 'not dict'}")
                    print(f"    data preview: {json.dumps(data['data'], indent=2)[:500]}")
            except Exception:
                print(f"    body: {resp.text[:200]}")

        # Step 5: Try fetching prematch events for other sports
        print("\n--- Step 5: Event listing for other sports ---")
        sport_ids = {
            "sr:sport:2": "Basketball",
            "sr:sport:4": "Ice Hockey",
            "sr:sport:5": "Tennis",
        }
        for sid, sname in sport_ids.items():
            resp = await client.get(f"{SPORTYBET_API}/factsCenter/importantEvents", params={
                "sportId": sid, "_t": "1",
            })
            data = resp.json()
            total = sum(len(t.get("events", [])) for t in data.get("data", []))
            print(f"  {sname} ({sid}): {total} events")

    print("\n  Done!")


if __name__ == "__main__":
    asyncio.run(main())
