"use client";

import { useState } from "react";
import useSWR from "swr";
import { ArbitrageTable, ArbitrageOpportunity } from "@/components/ArbitrageTable";
import { Activity, RefreshCw, Zap, Trophy } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function Home() {
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(['Hyperliquid', 'Binance', 'Bybit', 'Gate', 'Bitget', 'Lighter', 'Paradex', 'Variational']);

  const { data, error, isLoading, isValidating, mutate } = useSWR<ArbitrageOpportunity[]>(
    "/api/arbitrage",
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  const lastUpdate = new Date().toLocaleTimeString();

  const bestOpp = data && data.length > 0 ? data[0] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-sky-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-500/10 rounded-lg ring-1 ring-sky-500/20">
                <Zap className="w-6 h-6 text-sky-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  Funding Rate Arbitrage Screener
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Real-time cross-exchange funding rate spreads
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Status indicator */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className={`w-2 h-2 rounded-full ${isValidating ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                <span>{isValidating ? "Updating..." : `Live · ${lastUpdate}`}</span>
              </div>

              {/* Refresh button */}
              <button
                onClick={() => mutate()}
                disabled={isValidating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/60 hover:bg-slate-700/60 rounded-lg ring-1 ring-slate-700/50 transition-all disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {/* Stats bar */}
        {data && data.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard
              label="Total Pairs"
              value={data.length.toString()}
              icon={<Activity className="w-4 h-4 text-sky-400" />}
            />
            <StatCard
              label="Max Spread"
              value={`${data[0]?.deltaSpread8h.toFixed(4)}%`}
              sublabel={data[0]?.symbol}
              icon={<Zap className="w-4 h-4 text-amber-400" />}
            />
            <StatCard
              label="Hot Opps (>10%)"
              value={data.filter((d) => d.deltaSpread8h > 10).length.toString()}
              icon={<span className="text-sm">🔥</span>}
            />
          </div>
        )}

        {/* Best Opportunity Banner */}
        {bestOpp && (
          <div className="mb-6 bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-emerald-500/10 ring-1 ring-emerald-500/20 rounded-xl p-4 sm:p-6 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Trophy className="w-24 h-24" />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> BEST OPPORTUNITY
                  </span>
                  <span className="text-2xl font-black text-white">{bestOpp.symbol}</span>
                </div>
                <p className="text-sm text-slate-400">
                  <strong className="text-white">Long on {bestOpp.minExchange}</strong> ({(bestOpp.minRawRate * 100).toFixed(4)}% /{bestOpp.minIntervalHours}h) &nbsp;·&nbsp;
                  <strong className="text-white">Short on {bestOpp.maxExchange}</strong> ({(bestOpp.maxRawRate * 100).toFixed(4)}% /{bestOpp.maxIntervalHours}h)
                </p>
              </div>
              
              <div className="flex flex-col items-end text-right min-w-[140px]">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Estimated Net APR</span>
                <span className="text-2xl font-black text-emerald-400">+{bestOpp.netApr.toFixed(2)}%</span>
                <span className="text-xs text-sky-400 font-medium">Spread: {bestOpp.deltaSpread8h.toFixed(4)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-2 border-sky-500/30 border-t-sky-400 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Fetching funding rates from exchanges...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-rose-400 font-medium">Failed to load data</p>
            <p className="text-sm text-slate-500 mt-1">Check your connection and try again</p>
            <button
              onClick={() => mutate()}
              className="mt-4 px-4 py-2 text-sm bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Exchange Filters */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
              {['Hyperliquid', 'Binance', 'Bybit', 'Gate', 'Bitget', 'Lighter', 'Paradex', 'Variational'].map(exchange => (
                <button
                  key={exchange}
                  onClick={() => {
                    setSelectedExchanges(prev => 
                      prev.includes(exchange) 
                        ? prev.filter(e => e !== exchange)
                        : [...prev, exchange]
                    );
                  }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    selectedExchanges.includes(exchange)
                      ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/50"
                      : "bg-slate-800/40 text-slate-400 hover:bg-slate-700/50 ring-1 ring-slate-700/50"
                  }`}
                >
                  {exchange}
                </button>
              ))}
            </div>
            
            <ArbitrageTable data={data || []} selectedExchanges={selectedExchanges} />
          </>
        )}

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-slate-600">
          Auto-refreshes every 30s · Powered by Binance, Hyperliquid, Bybit, Gate, Bitget, Lighter, Paradex & Variational APIs
        </footer>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-slate-800/40 rounded-xl ring-1 ring-slate-700/50 backdrop-blur-sm">
      <div className="p-2 bg-slate-700/40 rounded-lg">{icon}</div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-lg font-bold text-white">{value}</p>
        {sublabel && <p className="text-[10px] text-slate-500">{sublabel}</p>}
      </div>
    </div>
  );
}
