"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from "@tanstack/react-table";
import { useState, useEffect } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown } from "lucide-react";

export interface ExchangeRateData {
  exchange: string;
  rate8h: number;
  rawRate: number;
  intervalHours: number;
  nextFundingTime?: number;
}

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
  exchanges: ExchangeRateData[];
}

const columnHelper = createColumnHelper<ArbitrageOpportunity>();

function RateCell({ value, rawRate, intervalHours, nextFundingTime }: { value: number; rawRate: number; intervalHours: number; nextFundingTime?: number }) {
  // Annualized APR = rawRate * (24 / intervalHours) * 365
  const annualizedAPR = rawRate * (24 / intervalHours) * 365 * 100;
  
  const isPositive = annualizedAPR > 0;
  const isNegative = annualizedAPR < 0;
  const pct = rawRate * 100;

  const [countdown, setCountdown] = useState<string>("");
  
  useEffect(() => {
    if (!nextFundingTime) return;

    const updateCountdown = () => {
      const now = Date.now();
      const diff = nextFundingTime - now;

      if (diff <= 0) {
        setCountdown("00:00:00");
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      const hh = h.toString().padStart(2, "0");
      const mm = m.toString().padStart(2, "0");
      const ss = s.toString().padStart(2, "0");

      setCountdown(`${hh}:${mm}:${ss}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [nextFundingTime]);

  return (
    <div className="flex flex-col gap-1 min-w-[130px]">
      <div className="flex items-center gap-1.5 border-b border-dashed border-slate-700/60 pb-1">
        <span
          className={`font-mono text-sm font-bold ${
            isPositive ? "text-emerald-400" : isNegative ? "text-amber-500" : "text-slate-400"
          } border-b border-dashed ${
            isPositive ? "border-emerald-400/50" : isNegative ? "border-amber-500/50" : "border-slate-500/50"
          }`}
        >
          {isPositive ? "+" : ""}{pct.toFixed(4)}%
        </span>
        <span className="text-slate-500 text-xs">/</span>
        <span className="text-slate-200 font-mono text-xs font-semibold tracking-wider">
          {countdown || "00:00:00"}
        </span>
      </div>
      <div className="flex justify-between items-center px-0.5">
        <span className="text-[10px] text-slate-500 font-medium">{intervalHours}h</span>
        <span className={`text-[10px] font-mono ${isPositive ? "text-emerald-400/70" : isNegative ? "text-rose-400/70" : "text-slate-500"}`}>
          Ann: {isPositive ? "+" : ""}{annualizedAPR.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

export function ArbitrageTable({
  data,
  selectedExchanges,
}: {
  data: ArbitrageOpportunity[];
  selectedExchanges: string[];
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "deltaSpread8h", desc: true },
  ]);

  // Construct dynamic columns based on selected exchanges
  const dynamicColumns = [
    columnHelper.accessor("symbol", {
      header: "Symbol",
      cell: (info) => (
        <span className="font-bold text-white tracking-wide">{info.getValue()}</span>
      ),
    }),
    ...selectedExchanges.map((exchangeName) =>
      columnHelper.accessor((row) => row.exchanges.find((e) => e.exchange === exchangeName), {
        id: `exchange_${exchangeName}`,
        header: exchangeName.toUpperCase(),
        cell: (info) => {
          const exData = info.getValue() as ExchangeRateData | undefined;
          if (!exData) {
            return <div className="text-slate-600 pl-4">—</div>;
          }
          return (
            <RateCell
              value={exData.rate8h}
              rawRate={exData.rawRate}
              intervalHours={exData.intervalHours}
              nextFundingTime={exData.nextFundingTime}
            />
          );
        },
      })
    ),
    columnHelper.accessor("deltaSpread8h", {
      header: "DELTA SPREAD (8H EQUIV)",
      cell: (info) => {
        const val = info.getValue();
        const isHot = val > 10.0;
        return (
          <div className="flex items-center gap-2 min-w-[120px]">
            <span
              className={`font-mono text-sm font-bold px-2 py-0.5 rounded ${
                isHot
                  ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 animate-pulse"
                  : val > 5.0
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-slate-300"
              }`}
            >
              {val.toFixed(4)}%
            </span>
            {isHot && <span className="text-[10px] text-amber-400 font-semibold">🔥 HOT</span>}
          </div>
        );
      },
      sortDescFirst: true,
    }),
    columnHelper.accessor("netApr", {
      header: "NET APR",
      cell: (info) => {
        const val = info.getValue() || 0;
        return (
          <span className="font-mono text-sm font-bold text-emerald-400">
            +{val.toFixed(2)}%
          </span>
        );
      },
      sortDescFirst: true,
    }),
    columnHelper.display({
      id: "bep",
      header: "EST. BEP",
      cell: (info) => {
        const spread8h = info.row.original.deltaSpread8h;
        // Assume 0.05% taker fee per leg. Entry (2 legs) + Exit (2 legs) = 4 * 0.05% = 0.20% total fee
        const ASSUMED_TOTAL_FEE_PCT = 0.20;
        
        // Spread is per 8h. Daily spread = spread8h * 3
        const dailySpread = spread8h * 3;
        
        if (dailySpread <= 0) return <span className="text-slate-500">—</span>;
        
        const daysToBreakeven = ASSUMED_TOTAL_FEE_PCT / dailySpread;
        
        let displayStr = "";
        if (daysToBreakeven < 1) {
          const hours = daysToBreakeven * 24;
          displayStr = `${hours.toFixed(1)} hrs`;
        } else {
          displayStr = `${daysToBreakeven.toFixed(1)} days`;
        }

        return (
          <div className="flex flex-col">
            <span className="font-mono text-sm text-sky-300">{displayStr}</span>
            <span className="text-[9px] text-slate-500 uppercase tracking-wide">@ 0.20% Fee</span>
          </div>
        );
      },
    }),
    columnHelper.accessor("recommendation", {
      header: "RECOMMENDATION",
      cell: (info) => (
        <span className="text-[11px] font-medium text-sky-300 bg-sky-500/10 px-2 py-1 rounded-md whitespace-nowrap">
          {info.getValue()}
        </span>
      ),
    }),
  ];

  const table = useReactTable({
    data,
    columns: dynamicColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-sm shadow-2xl">
      <table className="min-w-[1400px] w-full text-left">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-slate-700/50">
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-pointer select-none hover:text-slate-200 transition-colors"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1.5">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: <ArrowUp className="w-3 h-3 text-sky-400" />,
                      desc: <ArrowDown className="w-3 h-3 text-sky-400" />,
                    }[header.column.getIsSorted() as string] ?? (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={dynamicColumns.length} className="text-center py-12 text-slate-500">
                No arbitrage data available
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
