import { standardizeSymbol, normalizeTo8hRate } from "@/utils/quantHelpers";

export interface ArbitrageData {
  exchange: string;
  symbol: string;
  rate8h: number;
  rawRate: number;
  intervalHours: number;
  nextFundingTime: number;
}

export async function fetchBinanceRates(): Promise<ArbitrageData[]> {
  try {
    const [infoResponse, premiumResponse] = await Promise.all([
      fetch("https://fapi.binance.com/fapi/v1/fundingInfo", { next: { revalidate: 3600 } }),
      fetch("https://fapi.binance.com/fapi/v1/premiumIndex", { next: { revalidate: 30 } })
    ]);
    
    if (!infoResponse.ok || !premiumResponse.ok) {
      throw new Error(`Binance API error`);
    }

    const infoData = await infoResponse.json();
    const premiumData = await premiumResponse.json();

    const intervalMap = new Map<string, number>();
    for (const sym of infoData) {
      // fundingInfo returns an array of objects with symbol and fundingIntervalHours
      intervalMap.set(sym.symbol, sym.fundingIntervalHours || 8);
    }

    const results: ArbitrageData[] = [];

    for (const item of premiumData) {
      if (item.symbol) {
        const stdSymbol = standardizeSymbol('Binance', item.symbol);
        if (stdSymbol) {
          const rawRate = parseFloat(item.lastFundingRate);
          const intervalHours = intervalMap.get(item.symbol) || 8;
          results.push({
            exchange: "Binance",
            symbol: stdSymbol,
            rate8h: normalizeTo8hRate(rawRate, intervalHours), 
            rawRate: rawRate,
            intervalHours: intervalHours,
            nextFundingTime: item.nextFundingTime ? Number(item.nextFundingTime) : 0
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error("Failed to fetch Binance rates:", error);
    return [];
  }
}
