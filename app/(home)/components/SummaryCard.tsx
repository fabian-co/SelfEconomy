"use client";

import { FolderIcon, TrendingDownIcon, TrendingUpIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { MetaInfo, GroupedTransaction } from "../types/index";

interface SummaryCardProps {
  metaInfo: MetaInfo;
  currentGroup?: GroupedTransaction;
}

export function SummaryCard({ metaInfo, currentGroup }: SummaryCardProps) {
  return (
    <div id="summary-card-container" className="p-6 rounded-3xl bg-zinc-900 text-white shadow-xl dark:bg-zinc-800 dark:border dark:border-zinc-700">
      {/* Header with App Branding and Navigation */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 rounded-2xl">
            <WalletIcon className="h-6 w-6 text-emerald-400" />
          </div>
          <span className="text-xl font-bold tracking-tight">SelfEconomy</span>
        </div>
        <Link
          href="/files"
          className="p-2.5 bg-zinc-800/50 rounded-2xl hover:bg-zinc-700 transition-colors group border border-zinc-700/30"
          title="Manage Files"
        >
          <FolderIcon className="h-6 w-6 text-zinc-400 group-hover:text-white transition-colors" />
        </Link>
      </div>

      <div id="summary-card-balance" className="mb-8">
        <p className="text-zinc-400 text-sm font-medium mb-1">Saldo Actual</p>
        <h1 className="text-5xl font-bold tracking-tight">{formatCurrency(metaInfo.resumen.saldo_actual)}</h1>
      </div>

      {/* Global Totals */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div id="summary-card-total-income-global" className="p-4 rounded-2xl bg-zinc-800/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2 mb-2 text-emerald-400">
            <TrendingUpIcon className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Ingresos Totales</span>
          </div>
          <p className="text-lg font-semibold">{formatCurrency(metaInfo.resumen.total_abonos)}</p>
        </div>
        <div id="summary-card-total-expense-global" className="p-4 rounded-2xl bg-zinc-800/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2 mb-2 text-rose-400">
            <TrendingDownIcon className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Egresos Totales</span>
          </div>
          <p className="text-lg font-semibold">{formatCurrency(metaInfo.resumen.total_cargos)}</p>
        </div>
      </div>

      {/* Monthly Totals */}
      {currentGroup && (
        <div id="summary-card-monthly-resume" className="pt-6 border-t border-zinc-700/50">
          <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">
            Resumen {currentGroup.monthName}
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div id="summary-card-total-income-monthly" className="p-4 rounded-2xl bg-zinc-800/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2 mb-2 text-emerald-400">
                <TrendingUpIcon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Ingresos Mes</span>
              </div>
              <p className="text-lg font-semibold">{formatCurrency(currentGroup.totalIncome)}</p>
            </div>
            <div id="summary-card-total-expense-monthly" className="p-4 rounded-2xl bg-zinc-800/50 dark:bg-zinc-900/50">
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
