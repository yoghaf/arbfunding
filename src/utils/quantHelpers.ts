/**
 * Standardizes an exchange-specific symbol into a universal format (e.g., BTC-PERP).
 * @param exchange The exchange name
 * @param rawSymbol The raw symbol from the exchange
 */
export function standardizeSymbol(exchange: 'Binance' | 'Hyperliquid' | 'Bybit' | 'Gate' | 'OKX' | 'Bitget' | 'Lighter' | 'Paradex', rawSymbol: string): string | null {
  if (exchange === 'Binance') {
    // Only map USDT pairs for simplicity, strip USDT
    if (rawSymbol.endsWith('USDT')) {
      let base = rawSymbol.replace('USDT', '');
      // Strip '1000' or '10000' prefixes common on Binance to match Hyperliquid (e.g. 1000PEPE -> PEPE)
      if (base.startsWith('10000')) base = base.substring(5);
      else if (base.startsWith('1000')) base = base.substring(4);
      
      return base + '-PERP';
    }
    return null;
  } else if (exchange === 'Hyperliquid') {
    // Hyperliquid asset names are typically just the base (e.g., "BTC")
    return rawSymbol + '-PERP';
  } else if (exchange === 'Bybit') {
    // Bybit symbols like BTCUSDT
    if (rawSymbol.endsWith('USDT')) {
      let base = rawSymbol.replace('USDT', '');
      if (base.startsWith('10000')) base = base.substring(5);
      else if (base.startsWith('1000')) base = base.substring(4);
      return base + '-PERP';
    }
    return null;
  } else if (exchange === 'Gate') {
    // Gate symbols like BTC_USDT
    if (rawSymbol.endsWith('_USDT')) {
      let base = rawSymbol.replace('_USDT', '');
      if (base.startsWith('10000')) base = base.substring(5);
      else if (base.startsWith('1000')) base = base.substring(4);
      return base + '-PERP';
    }
    return null;
  } else if (exchange === 'OKX') {
    // OKX symbols like BTC-USDT-SWAP
    if (rawSymbol.endsWith('-USDT-SWAP')) {
      let base = rawSymbol.replace('-USDT-SWAP', '');
      if (base.startsWith('10000')) base = base.substring(5);
      else if (base.startsWith('1000')) base = base.substring(4);
      return base + '-PERP';
    }
    return null;
  } else if (exchange === 'Bitget') {
    // Bitget symbols like BTCUSDT
    if (rawSymbol.endsWith('USDT')) {
      let base = rawSymbol.replace('USDT', '');
      if (base.startsWith('10000')) base = base.substring(5);
      else if (base.startsWith('1000')) base = base.substring(4);
      return base + '-PERP';
    }
    return null;
  } else if (exchange === 'Lighter') {
    // Lighter symbols are plain base names like "BTC", "ETH"
    return rawSymbol + '-PERP';
  } else if (exchange === 'Paradex') {
    // Paradex symbols like BTC-USD-PERP
    if (rawSymbol.endsWith('-USD-PERP')) {
      let base = rawSymbol.replace('-USD-PERP', '');
      if (base.startsWith('10000')) base = base.substring(5);
      else if (base.startsWith('1000')) base = base.substring(4);
      return base + '-PERP';
    }
    return null;
  }
  return null;
}

/**
 * Normalizes a given funding rate to an 8-hour rate.
 * @param rate The raw funding rate
 * @param intervalHours The interval of the raw funding rate in hours (e.g., 1 for 1-hour rate, 8 for 8-hour rate)
 * @returns The normalized 8-hour funding rate
 */
export function normalizeTo8hRate(rate: number, intervalHours: number): number {
  if (intervalHours === 0) return 0;
  return rate * (8 / intervalHours);
}

/**
 * Calculates the absolute percentage spread between a long candidate's rate and a short candidate's rate.
 * Formula: Math.abs(shortRate - longRate) * 100
 * @param longRate The funding rate of the long candidate (minimum rate)
 * @param shortRate The funding rate of the short candidate (maximum rate)
 * @returns The absolute percentage spread (e.g., 0.05 for 0.05%)
 */
export function calculateDelta(longRate: number, shortRate: number): number {
  return Math.abs(shortRate - longRate) * 100; // Returns percentage spread (e.g. 0.01%) - assuming inputs are decimals like 0.0001
}
