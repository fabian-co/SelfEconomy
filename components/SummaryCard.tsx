"use client";

import { FolderIcon, TrendingDownIcon, TrendingUpIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { MetaInfo, GroupedTransaction } from "./dashboard-types";

interface SummaryCardProps {
  metaInfo: MetaInfo;
  currentGroup?: GroupedTransaction;
}

export function SummaryCard({ metaInfo, currentGroup }: SummaryCardProps) {
  return (
    <div className="p-6 rounded-3xl bg-zinc-900 text-white shadow-xl dark:bg-zinc-800 dark:border dark:border-zinc-700">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-zinc-400 text-sm font-medium mb-1">Saldo Actual</p>
          <h1 className="text-4xl font-bold tracking-tight">{formatCurrency(metaInfo.resumen.saldo_actual)}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/files"
            className="p-3 bg-zinc-800 rounded-2xl dark:bg-zinc-950/50 hover:bg-zinc-700 dark:hover:bg-zinc-900 transition-colors group"
            title="Manage Files"
          >
            <FolderIcon className="h-6 w-6 text-zinc-400 group-hover:text-white transition-colors" />
          </Link>
          <div className="p-3 bg-zinc-800 rounded-2xl dark:bg-zinc-950/50">
            <WalletIcon className="h-6 w-6 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Global Totals */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-2xl bg-zinc-800/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2 mb-2 text-emerald-400">
            <TrendingUpIcon className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Ingresos Totales</span>
          </div>
          <p className="text-lg font-semibold">{formatCurrency(metaInfo.resumen.total_abonos)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-zinc-800/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2 mb-2 text-rose-400">
            <TrendingDownIcon className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Egresos Totales</span>
          </div>
          <p className="text-lg font-semibold">{formatCurrency(metaInfo.resumen.total_cargos)}</p>
        </div>
      </div>

      {/* Monthly Totals */}
      {currentGroup && (
        <div className="pt-6 border-t border-zinc-700/50">
          <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">
            Resumen {currentGroup.monthName}
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 rounded-2xl bg-zinc-800/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2 mb-2 text-emerald-400">
                <TrendingUpIcon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Ingresos Mes</span>
              </div>
              <p className="text-lg font-semibold">{formatCurrency(currentGroup.totalIncome)}</p>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-800/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2 mb-2 text-rose-400">
                <TrendingDownIcon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Egresos Mes</span>
              </div>
              <p className="text-lg font-semibold">{formatCurrency(Math.abs(currentGroup.totalExpense))}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
