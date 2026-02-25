import { NextResponse } from "next/server";
import { fetchBinanceRates, ArbitrageData } from "@/lib/fetchers/binance";
import { fetchHyperliquidRates } from "@/lib/fetchers/hyperliquid";
import { fetchBybitRates } from "@/lib/fetchers/bybit";
import { fetchGateRates } from "@/lib/fetchers/gate";
import { fetchBitgetRates } from "@/lib/fetchers/bitget";
import { fetchLighterRates } from "@/lib/fetchers/lighter";
import { fetchParadexRates } from "@/lib/fetchers/paradex";
import { calculateDelta } from "@/utils/quantHelpers";

export const revalidate = 0; // Disable Next.js caching for this route (pure dynamic)

export interface ArbitrageOpportunity {
  symbol: string;
  maxRate8h: number;
  maxRawRate: number;
  maxIntervalHours: number;
  maxExchange: string;
  minRate8h: number;
  minRawRate: number;
  minIntervalHours: number;
  minExchange: string;
  deltaSpread8h: number;
  netApr: number;
  recommendation: string;
  exchanges: { exchange: string; rate8h: number; rawRate: number; intervalHours: number; nextFundingTime?: number }[];
}

export async function GET() {
  try {
    // 1. Concurrent Fetching
    const [binanceRates, hyperliquidRates, bybitRates, gateRates, bitgetRates, lighterRates, paradexRates] = await Promise.all([
      fetchBinanceRates(),
      fetchHyperliquidRates(),
      fetchBybitRates(),
      fetchGateRates(),
      fetchBitgetRates(),
      fetchLighterRates(),
      fetchParadexRates()
    ]);

    const allRates = [...binanceRates, ...hyperliquidRates, ...bybitRates, ...gateRates, ...bitgetRates, ...lighterRates, ...paradexRates];

    // 2. Group by Symbol
    const groupedBySymbol = new Map<string, ArbitrageData[]>();
    for (const rate of allRates) {
      if (!groupedBySymbol.has(rate.symbol)) {
        groupedBySymbol.set(rate.symbol, []);
      }
      groupedBySymbol.get(rate.symbol)?.push(rate);
    }

    const opportunities: ArbitrageOpportunity[] = [];

    // 3. Calculate metrics for each symbol
    for (const [symbol, rates] of groupedBySymbol.entries()) {
      // Need at least 2 exchanges to calculate a spread
      if (rates.length < 2) continue;

      let maxRateData = rates[0];
      let minRateData = rates[0];

      for (const rate of rates) {
        if (rate.rate8h > maxRateData.rate8h) maxRateData = rate;
        if (rate.rate8h < minRateData.rate8h) minRateData = rate;
      }

      const deltaSpread8h = calculateDelta(minRateData.rate8h, maxRateData.rate8h);
      const netApr = deltaSpread8h * 3 * 365;
      
      const opp: ArbitrageOpportunity = {
        symbol,
        maxRate8h: maxRateData.rate8h,
        maxRawRate: maxRateData.rawRate,
        maxIntervalHours: maxRateData.intervalHours,
        maxExchange: maxRateData.exchange,
        minRate8h: minRateData.rate8h,
        minRawRate: minRateData.rawRate,
        minIntervalHours: minRateData.intervalHours,
        minExchange: minRateData.exchange,
        deltaSpread8h: deltaSpread8h,
        netApr: netApr,
        recommendation: `Long ${minRateData.exchange} / Short ${maxRateData.exchange}`,
        exchanges: rates.map(r => ({ exchange: r.exchange, rate8h: r.rate8h, rawRate: r.rawRate, intervalHours: r.intervalHours, nextFundingTime: r.nextFundingTime }))
      };

      opportunities.push(opp);
    }

    // Sort opportunities by spread descending
    opportunities.sort((a, b) => b.deltaSpread8h - a.deltaSpread8h);

    // 7. Return Aggregated Data
    return NextResponse.json(opportunities);

  } catch (error) {
    console.error("Aggregation error:", error);
    return NextResponse.json({ error: "Failed to fetch and aggregate data" }, { status: 500 });
  }
}
