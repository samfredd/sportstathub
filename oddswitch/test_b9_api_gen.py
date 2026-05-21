import asyncio
import json
import urllib.parse
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            channel="chrome",
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()

        print("Navigating to Bet9ja to pass Cloudflare...")
        await page.goto("https://sports.bet9ja.com/", timeout=60000)
        await asyncio.sleep(5)

        print("Fetching an event ID to book...")
        res = await page.evaluate("""async () => {
            let r = await fetch('https://sports.bet9ja.com/desktop/feapi/PalimpsestAjax/GetEventsInDailyBundleV3?DISP=1000&DISPH=0&SPORTID=1&LIMIT=1&v_cache_version=1');
            return await r.json();
        }""")

        event = res['D']['E'][0]
        event_id = event['ID']
        event_code = event['C']
        event_name = event['N']
        startdate = event['D']
        print(f"Using event: {event_id} - {event_name}")

        # Build the BETSLIP JSON
        # The key is something like "9218531$LIVES_1X2_1"
        key = f"{event_id}$S_1X2_1"

        betslip_json = {
            "BETS": [{
                "BSTYPE": 3,
                "TAB": 3,
                "NUMLINES": 1,
                "COMB": 1,
                "TYPE": 1,
                "STAKE": 0,
                "POTWINMIN": 0,
                "POTWINMAX": 0,
                "BONUSMIN": "0",
                "BONUSMAX": "0",
                "ODDMIN": 2.0,
                "ODDMAX": 2.0,
                "ODDS": {
                    key: 2.0
                },
                "FIXED": {}
            }],
            "EVS": {
                key: {
                    "id": key,
                    "eventId": event_id,
                    "eventCode": event_code,
                    "eventName": event_name,
                    "market": "1X2",
                    "sid": "S_1X2_1",
                    "sign": "1",
                    "GN": "undefined - undefined",
                    "leagueName": "undefined - undefined",
                    "startdate": startdate,
                    "oddValue": 2.0,
                    "hnd": ""
                }
            },
            "IMPERSONIZE": 0
        }

        payload_str = "BETSLIP=" + urllib.parse.quote(json.dumps(betslip_json, separators=(',', ':'))) + "&IS_PASSBET=0"
        print(f"Payload constructed.")

        print("Executing BookABetV2 API via fetch...")
        # Bet9ja search API is usually something like this:
        result = await page.evaluate("""async (payload) => {
            try {
                const res = await fetch('https://apigw.bet9ja.com/sportsbook/placebet/BookABetV2?source=desktop', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'Accept': 'application/json, text/javascript, */*; q=0.01'
                    },
                    body: payload
                });
                return await res.json();
            } catch(e) {
                return e.toString();
            }
        }""", payload_str)

        print(f"Result from API:")
        print(json.dumps(result, indent=2))

        await browser.close()

asyncio.run(main())
