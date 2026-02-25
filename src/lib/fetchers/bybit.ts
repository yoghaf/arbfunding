import { standardizeSymbol, normalizeTo8hRate } from "@/utils/quantHelpers";
import { ArbitrageData } from "./binance";

export async function fetchBybitRates(): Promise<ArbitrageData[]> {
  try {
    const response = await fetch("https://api.bybit.com/v5/market/tickers?category=linear", { next: { revalidate: 30 } });
    
    if (!response.ok) {
      throw new Error(`Bybit API error`);
    }

    const data = await response.json();
    const results: ArbitrageData[] = [];

    if (data && data.result && data.result.list) {
      for (const item of data.result.list) {
        if (item.symbol) {
          const stdSymbol = standardizeSymbol('Bybit', item.symbol);
          if (stdSymbol) {
            const rawRate = parseFloat(item.fundingRate);
            // Bybit returns interval in hours in 'fundingIntervalHour' (string)
            // Defaulting to 8 if not available/parsable
            const intervalHours = parseInt(item.fundingIntervalHour, 10) || 8;
            results.push({
              exchange: "Bybit",
              symbol: stdSymbol,
              rate8h: normalizeTo8hRate(rawRate, intervalHours),
              rawRate: rawRate,
              intervalHours: intervalHours,
              nextFundingTime: item.nextFundingTime ? Number(item.nextFundingTime) : 0
            });
          }
        }
      }
    }

    return results;
  } catch (error) {
    console.error("Failed to fetch Bybit rates:", error);
    return [];
  }
}
