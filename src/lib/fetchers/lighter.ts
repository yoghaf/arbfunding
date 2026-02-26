import { standardizeSymbol, normalizeTo8hRate } from "@/utils/quantHelpers";
import { ArbitrageData } from "./binance";

export async function fetchLighterRates(): Promise<ArbitrageData[]> {
  try {
    const response = await fetch(
      "https://mainnet.zklighter.elliot.ai/api/v1/funding-rates",
      { next: { revalidate: 30 } }
    );

    if (!response.ok) {
      throw new Error(`Lighter API error`);
    }

    const json = await response.json();
    const results: ArbitrageData[] = [];

    if (json.funding_rates) {
      // Lighter funds every 1 hour
      const now = Date.now();
      const nextHour = new Date(now);
      nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);

      for (const item of json.funding_rates) {
        if (item.symbol) {
          const stdSymbol = standardizeSymbol("Lighter", item.symbol);
          if (stdSymbol) {
            // Lighter API returns the 8-hour expected funding rate.
            // Since it pays hourly, the 1-hour rate is rawRate / 8.
            const rawRate8h = parseFloat(item.rate);
            const actual1hRate = rawRate8h / 8;
            results.push({
              exchange: "Lighter",
              symbol: stdSymbol,
              rate8h: rawRate8h, // Already 8h equivalent
              rawRate: actual1hRate,
              intervalHours: 1,
              nextFundingTime: nextHour.getTime(),
            });
          }
        }
      }
    }

    return results;
  } catch (error) {
    console.error("Failed to fetch Lighter rates:", error);
    return [];
  }
}
