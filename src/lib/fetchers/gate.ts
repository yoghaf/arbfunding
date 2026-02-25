import { standardizeSymbol, normalizeTo8hRate } from "@/utils/quantHelpers";
import { ArbitrageData } from "./binance";

export async function fetchGateRates(): Promise<ArbitrageData[]> {
  try {
    const response = await fetch("https://api.gateio.ws/api/v4/futures/usdt/contracts", { next: { revalidate: 3600 } });
    
    if (!response.ok) {
      throw new Error(`Gate API error`);
    }

    const data = await response.json();
    const results: ArbitrageData[] = [];

    for (const item of data) {
      if (item.name) {
        // Gate contracts are like BTC_USDT
        const stdSymbol = standardizeSymbol('Gate', item.name);
        if (stdSymbol) {
          const rawRate = parseFloat(item.funding_rate);
          // Gate returns interval in seconds in 'funding_interval'
          const intervalHours = (item.funding_interval || 28800) / 3600;
          results.push({
            exchange: "Gate",
            symbol: stdSymbol,
            rate8h: normalizeTo8hRate(rawRate, intervalHours),
            rawRate: rawRate,
            intervalHours: intervalHours,
            nextFundingTime: item.funding_next_apply ? Number(item.funding_next_apply) * 1000 : 0
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error("Failed to fetch Gate rates:", error);
    return [];
  }
}
