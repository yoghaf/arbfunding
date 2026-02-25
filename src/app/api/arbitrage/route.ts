import { NextResponse } from "next/server";
import { fetchBinanceRates, ArbitrageData } from "@/lib/fetchers/binance";
import { fetchHyperliquidRates } from "@/lib/fetchers/hyperliquid";
import { fetchBybitRates } from "@/lib/fetchers/bybit";
import { fetchGateRates } from "@/lib/fetchers/gate";
import { calculateDelta } from "@/utils/quantHelpers";
import { kv } from "@vercel/kv";

export const revalidate = 0; // Disable Next.js caching for this route (pure dynamic)

// For Telegram integration, ensure you have set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in your environment variables.
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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
    const [binanceRates, hyperliquidRates, bybitRates, gateRates] = await Promise.all([
      fetchBinanceRates(),
      fetchHyperliquidRates(),
      fetchBybitRates(),
      fetchGateRates()
    ]);

    const allRates = [...binanceRates, ...hyperliquidRates, ...bybitRates, ...gateRates];

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

      // 4. SMART ALERT LOGIC
      if (deltaSpread8h > 10.0) {
        try {
          const stateKey = `alert:${symbol}`;
          const state = await kv.get<{timestamp: number, last_spread: number}>(stateKey);

          let shouldAlert = false;
          let priority = "";

          // Condition A & B
          if (!state || (Date.now() - state.timestamp > 3600000)) {
            // No state or older than 1 hour -> SEND Alert
            shouldAlert = true;
            priority = "STANDARD";
          } else if (deltaSpread8h >= state.last_spread + 2.0) {
            // Inside 1-hour window BUT spread widened significantly -> SEND High-Priority Alert
            shouldAlert = true;
            priority = "HIGH-PRIORITY 🚀";
          }
          // Condition C: Else Ignore

          if (shouldAlert) {
            // 5. Update KV State
            await kv.set(stateKey, { timestamp: Date.now(), last_spread: deltaSpread8h }, { ex: 86400 });

            // 6. Send to Telegram using actual raw rates and their respective intervals for transparency
            if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
              const message = `
<b>${priority} Arbitrage Alert: ${symbol}</b>
Spread: <b>${deltaSpread8h.toFixed(2)}%</b> (8h annualized equivalent)
Action: ${opp.recommendation}
Short: ${maxRateData.exchange} at ${(maxRateData.rawRate * 100).toFixed(4)}% (${maxRateData.intervalHours}h)
Long: ${minRateData.exchange} at ${(minRateData.rawRate * 100).toFixed(4)}% (${minRateData.intervalHours}h)
              `.trim();

              await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: TELEGRAM_CHAT_ID,
                  text: message,
                  parse_mode: "HTML"
                }),
              }).catch(e => console.error("Telegram error:", e));
            } else {
              console.log(`[ALERT TRIGGERED] ${symbol} Spread: ${deltaSpread8h.toFixed(2)}%`);
            }
          }
        } catch (kvError) {
          console.error(`KV Error for ${symbol}:`, kvError);
        }
      }
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
