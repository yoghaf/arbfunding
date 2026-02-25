import { standardizeSymbol, normalizeTo8hRate } from "@/utils/quantHelpers";
import { ArbitrageData } from "./binance";

export async function fetchBitgetRates(): Promise<ArbitrageData[]> {
  try {
    const response = await fetch(
      "https://api.bitget.com/api/v2/mix/market/current-fund-rate?productType=USDT-FUTURES",
      { next: { revalidate: 30 } }
    );

    if (!response.ok) {
      throw new Error(`Bitget API error`);
    }

    const json = await response.json();
    const results: ArbitrageData[] = [];

    if (json.code === "00000" && json.data) {
      for (const item of json.data) {
        if (item.symbol) {
          const stdSymbol = standardizeSymbol("Bitget", item.symbol);
          if (stdSymbol) {
            const rawRate = parseFloat(item.fundingRate);
            const intervalHours = parseInt(item.fundingRateInterval, 10) || 8;
            results.push({
              exchange: "Bitget",
              symbol: stdSymbol,
              rate8h: normalizeTo8hRate(rawRate, intervalHours),
              rawRate: rawRate,
              intervalHours: intervalHours,
              nextFundingTime: item.nextUpdate ? Number(item.nextUpdate) : 0,
            });
          }
        }
      }
    }

    return results;
  } catch (error) {
    console.error("Failed to fetch Bitget rates:", error);
    return [];
  }
}
