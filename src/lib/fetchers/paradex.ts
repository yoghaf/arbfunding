import { standardizeSymbol, normalizeTo8hRate } from "@/utils/quantHelpers";
import { ArbitrageData } from "./binance";

export async function fetchParadexRates(): Promise<ArbitrageData[]> {
  try {
    const response = await fetch(
      "https://api.prod.paradex.trade/v1/markets/summary?market=ALL",
      { next: { revalidate: 30 } }
    );

    if (!response.ok) {
      throw new Error(`Paradex API error`);
    }

    const json = await response.json();
    const results: ArbitrageData[] = [];

    if (json.results) {
      // Paradex uses continuous funding, we treat it as 1hr for display
      const now = Date.now();
      const nextHour = new Date(now);
      nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);

      for (const item of json.results) {
        if (item.symbol && item.funding_rate) {
          const stdSymbol = standardizeSymbol("Paradex", item.symbol);
          if (stdSymbol) {
            const rawRate = parseFloat(item.funding_rate);
            results.push({
              exchange: "Paradex",
              symbol: stdSymbol,
              rate8h: normalizeTo8hRate(rawRate, 1), // continuous/1hr
              rawRate: rawRate,
              intervalHours: 1,
              nextFundingTime: nextHour.getTime(),
            });
          }
        }
      }
    }

    return results;
  } catch (error) {
    console.error("Failed to fetch Paradex rates:", error);
    return [];
  }
}
