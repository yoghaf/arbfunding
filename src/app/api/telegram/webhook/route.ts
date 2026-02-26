import { NextResponse } from "next/server";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendReply(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
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
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body?.message;

    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const chatType = message.chat.type; // "private", "group", "supergroup"

    // /start command
    if (text === "/start" || text.startsWith("/start@")) {
      const isGroup = chatType === "group" || chatType === "supergroup";
      const welcome = isGroup
        ? `🤖 <b>Funding Rate Bot Active!</b>\n\nBot ini akan mengirim alert Top 5 peluang arbitrage funding rate setiap 1 jam.\n\n<b>Commands:</b>\n/top - Lihat top 5 peluang sekarang\n/help - Bantuan`
        : `👋 <b>Welcome to Funding Rate Alert Bot!</b>\n\nBot ini memberikan notifikasi <b>Top 5 peluang arbitrage</b> funding rate dari 8 exchange:\nBinance, Hyperliquid, Bybit, Gate, Bitget, Lighter, Paradex, Variational\n\n🔔 Alert dikirim setiap <b>1 jam</b>.\n\n<b>Commands:</b>\n/top - Lihat top 5 peluang sekarang\n/help - Bantuan\n\n💡 <i>Add bot ini ke grup untuk alert otomatis!</i>`;

      await sendReply(chatId, welcome);
      return NextResponse.json({ ok: true });
    }

    // /top command - fetch live data
    if (text === "/top" || text.startsWith("/top@")) {
      // Fetch from our own cron endpoint
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

      try {
        const res = await fetch(`${baseUrl}/api/arbitrage`);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
          await sendReply(chatId, "❌ Tidak ada data arbitrage saat ini.");
          return NextResponse.json({ ok: true });
        }

        const top5 = data.slice(0, 5);
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

        let msg = `📊 <b>Top 5 Arbitrage Opportunities</b>\n`;
        msg += `⏰ ${timeStr} UTC\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        top5.forEach((opp: { symbol: string; deltaSpread8h: number; netApr: number; maxExchange: string; maxRawRate: number; maxIntervalHours: number; minExchange: string; minRawRate: number; minIntervalHours: number; }, i: number) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
          msg += `${medal} <b>${opp.symbol}</b>\n`;
          msg += `   📊 Spread: <b>${opp.deltaSpread8h.toFixed(4)}%</b>\n`;
          msg += `   💰 Net APR: <b>+${opp.netApr.toFixed(2)}%</b>\n`;
          msg += `   🟢 Long: ${opp.minExchange} (${(opp.minRawRate * 100).toFixed(4)}%/${opp.minIntervalHours}h)\n`;
          msg += `   🔴 Short: ${opp.maxExchange} (${(opp.maxRawRate * 100).toFixed(4)}%/${opp.maxIntervalHours}h)\n\n`;
        });

        msg += `🔄 <i>Data live dari 8 exchange</i>`;
        await sendReply(chatId, msg);
      } catch {
        await sendReply(chatId, "⚠️ Gagal mengambil data. Coba lagi nanti.");
      }

      return NextResponse.json({ ok: true });
    }

    // /help command
    if (text === "/help" || text.startsWith("/help@")) {
      const help = `📖 <b>Bantuan Funding Rate Bot</b>\n\n<b>Apa itu Funding Rate Arbitrage?</b>\nMembuka posisi Long di exchange dengan rate rendah, dan Short di exchange dengan rate tinggi. Selisihnya = profit.\n\n<b>Commands:</b>\n/top - Top 5 peluang arbitrage saat ini\n/help - Pesan ini\n\n<b>Exchange yang dipantau:</b>\nBinance, Hyperliquid, Bybit, Gate, Bitget, Lighter, Paradex, Variational\n\n🔔 Alert otomatis dikirim setiap 1 jam ke grup/chat ini.`;
      await sendReply(chatId, help);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
