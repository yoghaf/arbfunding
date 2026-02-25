import { NextResponse } from "next/server";
import { fetchBinanceRates } from "@/lib/fetchers/binance";
import { fetchHyperliquidRates } from "@/lib/fetchers/hyperliquid";
import { fetchBybitRates } from "@/lib/fetchers/bybit";
import { fetchGateRates } from "@/lib/fetchers/gate";
import { fetchBitgetRates } from "@/lib/fetchers/bitget";
import { fetchLighterRates } from "@/lib/fetchers/lighter";
import { fetchParadexRates } from "@/lib/fetchers/paradex";
import { calculateDelta } from "@/utils/quantHelpers";
import type { ArbitrageData } from "@/lib/fetchers/binance";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_IDS = process.env.TELEGRAM_CHAT_IDS; // comma-separated

async function sendTelegramMessage(chatId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (e) {
    console.error(`Failed to send Telegram message to ${chatId}:`, e);
  }
}

function formatTopOpportunities(opportunities: {
  symbol: string;
  deltaSpread8h: number;
  netApr: number;
  maxExchange: string;
  maxRawRate: number;
  maxIntervalHours: number;
  minExchange: string;
  minRawRate: number;
  minIntervalHours: number;
}[]): string {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dateStr = now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });

  let msg = `🔔 <b>Funding Rate Alert</b>\n`;
  msg += `📅 ${dateStr} • ${timeStr} UTC\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  opportunities.forEach((opp, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
    const shortRate = (opp.maxRawRate * 100).toFixed(4);
    const longRate = (opp.minRawRate * 100).toFixed(4);

    msg += `${medal} <b>${opp.symbol}</b>\n`;
    msg += `   📊 Spread: <b>${opp.deltaSpread8h.toFixed(4)}%</b> (8h)\n`;
    msg += `   💰 Net APR: <b>+${opp.netApr.toFixed(2)}%</b>\n`;
    msg += `   🟢 Long: ${opp.minExchange} (${longRate}% / ${opp.minIntervalHours}h)\n`;
    msg += `   🔴 Short: ${opp.maxExchange} (${shortRate}% / ${opp.maxIntervalHours}h)\n`;
    msg += `\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💡 <i>Long = buka posisi long (bayar fee rendah)</i>\n`;
  msg += `💡 <i>Short = buka posisi short (terima fee tinggi)</i>\n`;
  msg += `🔄 <i>Alert setiap 1 jam</i>\n\n`;
  msg += `🌐 <b>Full Dashboard:</b> https://arbfunding-fee.vercel.app`;

  return msg;
}

export async function GET(request: Request) {
  // Optional: protect with secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_IDS) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_IDS must be set" },
      { status: 500 }
    );
  }

  try {
    // 1. Fetch all rates
    const [binanceRates, hyperliquidRates, bybitRates, gateRates, bitgetRates, lighterRates, paradexRates] =
      await Promise.all([
        fetchBinanceRates(),
        fetchHyperliquidRates(),
        fetchBybitRates(),
        fetchGateRates(),
        fetchBitgetRates(),
        fetchLighterRates(),
        fetchParadexRates(),
      ]);

    const allRates = [
      ...binanceRates, ...hyperliquidRates, ...bybitRates,
      ...gateRates, ...bitgetRates, ...lighterRates, ...paradexRates
    ];

    // 2. Group by symbol
    const grouped = new Map<string, ArbitrageData[]>();
    for (const rate of allRates) {
      if (!grouped.has(rate.symbol)) grouped.set(rate.symbol, []);
      grouped.get(rate.symbol)?.push(rate);
    }

    // 3. Calculate spreads
    const opportunities: {
      symbol: string;
      deltaSpread8h: number;
      netApr: number;
      maxExchange: string;
      maxRawRate: number;
      maxIntervalHours: number;
      minExchange: string;
      minRawRate: number;
      minIntervalHours: number;
    }[] = [];

    for (const [symbol, rates] of grouped.entries()) {
      if (rates.length < 2) continue;
      let maxRate = rates[0], minRate = rates[0];
      for (const r of rates) {
        if (r.rate8h > maxRate.rate8h) maxRate = r;
        if (r.rate8h < minRate.rate8h) minRate = r;
      }
      const delta = calculateDelta(minRate.rate8h, maxRate.rate8h);
      opportunities.push({
        symbol,
        deltaSpread8h: delta,
        netApr: delta * 3 * 365,
        maxExchange: maxRate.exchange,
        maxRawRate: maxRate.rawRate,
        maxIntervalHours: maxRate.intervalHours,
        minExchange: minRate.exchange,
        minRawRate: minRate.rawRate,
        minIntervalHours: minRate.intervalHours,
      });
    }

    // 4. Sort and take top 5
    opportunities.sort((a, b) => b.deltaSpread8h - a.deltaSpread8h);
    const top5 = opportunities.slice(0, 5);

    if (top5.length === 0) {
      return NextResponse.json({ message: "No opportunities found" });
    }

    // 5. Format and send to all chat IDs
    const message = formatTopOpportunities(top5);
    const chatIds = TELEGRAM_CHAT_IDS.split(",").map((id) => id.trim());

    for (const chatId of chatIds) {
      await sendTelegramMessage(chatId, message);
    }

    return NextResponse.json({
      success: true,
      sent_to: chatIds.length,
      top_opportunities: top5.map((o) => o.symbol),
    });
  } catch (error) {
    console.error("Cron alert error:", error);
    return NextResponse.json({ error: "Failed to send alerts" }, { status: 500 });
  }
}
