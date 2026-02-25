import { standardizeSymbol, normalizeTo8hRate } from "@/utils/quantHelpers";
import { ArbitrageData } from "./binance";

const POPULAR_SYMBOLS = [
  "BTC-USDT-SWAP", "ETH-USDT-SWAP", "SOL-USDT-SWAP", "DOGE-USDT-SWAP",
  "XRP-USDT-SWAP", "ADA-USDT-SWAP", "AVAX-USDT-SWAP", "LINK-USDT-SWAP",
  "WLD-USDT-SWAP", "ORDI-USDT-SWAP", "PEPE-USDT-SWAP", "SUI-USDT-SWAP",
  "APT-USDT-SWAP", "AR-USDT-SWAP", "TIA-USDT-SWAP", "SEI-USDT-SWAP",
  "INJ-USDT-SWAP", "OP-USDT-SWAP", "ARB-USDT-SWAP", "NEAR-USDT-SWAP",
  "FTM-USDT-SWAP", "MATIC-USDT-SWAP", "DOT-USDT-SWAP", "LTC-USDT-SWAP",
  "BCH-USDT-SWAP", "TRX-USDT-SWAP", "ATOM-USDT-SWAP", "RNDR-USDT-SWAP",
  "IMX-USDT-SWAP", "STX-USDT-SWAP", "TAO-USDT-SWAP", "FIL-USDT-SWAP",
  "XLM-USDT-SWAP", "UNI-USDT-SWAP", "MKR-USDT-SWAP", "TON-USDT-SWAP",
  "OM-USDT-SWAP", "FET-USDT-SWAP", "JUP-USDT-SWAP", "PYTH-USDT-SWAP",
  "ONDO-USDT-SWAP", "PENDLE-USDT-SWAP", "GALA-USDT-SWAP", "SAND-USDT-SWAP",
  "ENA-USDT-SWAP", "WIF-USDT-SWAP", "BOME-USDT-SWAP", "FLOKI-USDT-SWAP",
  "1000BONK-USDT-SWAP", "SHIB-USDT-SWAP"
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchOKXRates(): Promise<ArbitrageData[]> {
  try {
    const results: ArbitrageData[] = [];
    
    // OKX rate limit is 10 requests per 2 seconds.
    // We fetch in chunks of 5 and wait 1 second between chunks to be safe.
    for (let i = 0; i < POPULAR_SYMBOLS.length; i += 5) {
      const chunk = POPULAR_SYMBOLS.slice(i, i + 5);
      
      const chunkPromises = chunk.map(async (instId) => {
        try {
          const res = await fetch(`https://www.okx.com/api/v5/public/funding-rate?instId=${instId}`, { next: { revalidate: 30 } });
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            const item = json.data[0];
            const stdSymbol = standardizeSymbol('OKX', item.instId);
            if (stdSymbol) {
              const rawRate = parseFloat(item.fundingRate);
              // OKX typically uses 8-hour intervals
              results.push({
                exchange: "OKX",
                symbol: stdSymbol,
                rate8h: normalizeTo8hRate(rawRate, 8),
                rawRate: rawRate,
                intervalHours: 8,
                nextFundingTime: Number(item.nextFundingTime)
              });
            }
          }
        } catch (e) {
             console.error(`Failed OKX symbol ${instId}`, e);
        }
      });
      
      await Promise.all(chunkPromises);
      // sleep 1 second just to prevent spam
      if (i + 5 < POPULAR_SYMBOLS.length) {
        await sleep(1000);
      }
    }

    return results;
  } catch (error) {
    console.error("Failed to fetch OKX rates:", error);
    return [];
  }
}
