import { NextResponse } from "next/server";

interface PricesResponse {
  btc: number | null;
  xau: number | null;
  eurusd: number | null;
  spy: number | null;
}

export async function GET() {
  const result: PricesResponse = { btc: null, xau: null, eurusd: null, spy: null };

  // BTC from CoinGecko (no API key needed)
  const btcPromise = fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    { next: { revalidate: 30 } }
  )
    .then((r) => r.json())
    .then((d) => {
      console.log("[COINGECKO] BTC =>", JSON.stringify(d));
      result.btc = d?.bitcoin?.usd ?? null;
    })
    .catch((err) => console.error("[COINGECKO] BTC error:", err));

  // XAU, EUR/USD, SPY from Twelve Data
  const twelveKey = process.env.TWELVE_DATA_API_KEY;

  const xauPromise = twelveKey
    ? fetch(`https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${twelveKey}`, { next: { revalidate: 30 } })
        .then((r) => r.json())
        .then((d) => {
          console.log("[TWELVE DATA] XAU/USD =>", JSON.stringify(d));
          if (d?.price) result.xau = parseFloat(d.price);
        })
        .catch((err) => console.error("[TWELVE DATA] XAU/USD error:", err))
    : Promise.resolve();

  const eurusdPromise = twelveKey
    ? fetch(`https://api.twelvedata.com/price?symbol=EUR/USD&apikey=${twelveKey}`, { next: { revalidate: 30 } })
        .then((r) => r.json())
        .then((d) => {
          console.log("[TWELVE DATA] EUR/USD =>", JSON.stringify(d));
          if (d?.price) result.eurusd = parseFloat(d.price);
        })
        .catch((err) => console.error("[TWELVE DATA] EUR/USD error:", err))
    : Promise.resolve();

  const spyPromise = twelveKey
    ? fetch(`https://api.twelvedata.com/price?symbol=SPY&apikey=${twelveKey}`, { next: { revalidate: 30 } })
        .then((r) => r.json())
        .then((d) => {
          console.log("[TWELVE DATA] SPY =>", JSON.stringify(d));
          if (d?.price) result.spy = parseFloat(d.price);
        })
        .catch((err) => console.error("[TWELVE DATA] SPY error:", err))
    : Promise.resolve();

  await Promise.all([btcPromise, xauPromise, eurusdPromise, spyPromise]);

  console.log("[PRICES] Final result:", JSON.stringify(result));

  return NextResponse.json(result, {
    headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
  });
}
