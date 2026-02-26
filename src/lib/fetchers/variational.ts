import { standardizeSymbol, normalizeTo8hRate } from "@/utils/quantHelpers";
import { ArbitrageData } from "./binance";

export async function fetchVariationalRates(): Promise<ArbitrageData[]> {
  try {
    const response = await fetch(
      "https://omni-client-api.prod.ap-northeast-1.variational.io/metadata/stats",
      { next: { revalidate: 30 } }
    );

    if (!response.ok) {
      throw new Error(`Variational API error`);
    }

    const json = await response.json();
    const results: ArbitrageData[] = [];

    if (json.listings) {
      for (const item of json.listings) {
        if (item.ticker && item.funding_rate) {
          const stdSymbol = standardizeSymbol("Variational", item.ticker);
          if (stdSymbol) {
            const intervalHours = item.funding_interval_s ? item.funding_interval_s / 3600 : 8; // Default 8h if missing
            
            // Variational's API returns the Annualized Funding Rate as a decimal (e.g., -55.6886 means -5568.86% APR)
            // To get the per-interval raw rate, divide by the number of intervals in a year.
            const annualizedRate = parseFloat(item.funding_rate);
            const intervalsPerYear = (365 * 24) / intervalHours;
            const rawRate = annualizedRate / intervalsPerYear;
            
            // Variational funds exactly at the start of every hour/interval
            const now = Date.now();
            const nextFunding = new Date(now);
            nextFunding.setUTCHours(nextFunding.getUTCHours() + 1, 0, 0, 0); // Always tops of the hour since it's a 1h interval usually 
            
            results.push({
              exchange: "Variational",
              symbol: stdSymbol,
              rate8h: normalizeTo8hRate(rawRate, intervalHours),
              rawRate: rawRate,
              intervalHours: intervalHours,
              nextFundingTime: nextFunding.getTime(),
            });
          }
        }
      }
    }

    return results;
  } catch (error) {
    console.error("Failed to fetch Variational rates:", error);
    return [];
  }
}
