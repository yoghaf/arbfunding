import { standardizeSymbol, normalizeTo8hRate } from "@/utils/quantHelpers";
import type { ArbitrageData } from "./binance";

export async function fetchHyperliquidRates(): Promise<ArbitrageData[]> {
  try {
    const response = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      next: { revalidate: 30 } // Cache for 30 seconds
    });

    if (!response.ok) {
      throw new Error(`Hyperliquid API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Hyperliquid returns [meta, assetCtxs]
    const meta = data[0];
    const assetCtxs = data[1];

    const results: ArbitrageData[] = [];

    for (let i = 0; i < meta.universe.length; i++) {
      const assetMeta = meta.universe[i];
      const assetCtx = assetCtxs[i];
      
      const symbol = assetMeta.name;
      
      if (symbol) {
        const stdSymbol = standardizeSymbol('Hyperliquid', symbol);
        if (stdSymbol) {
          const rawRate = parseFloat(assetCtx.funding); // 1h rate
          const rate8h = normalizeTo8hRate(rawRate, 1);
          
          const now = Date.now();
          const nextHour = new Date(now);
          nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);

          results.push({
            exchange: "Hyperliquid",
            symbol: stdSymbol,
            rate8h: rate8h,
            rawRate: rawRate,
            intervalHours: 1,
            nextFundingTime: nextHour.getTime()
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error("Failed to fetch Hyperliquid rates:", error);
    return [];
  }
}
