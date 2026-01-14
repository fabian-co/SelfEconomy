"use client";

import { useMemo } from "react";
import { MonthGroup } from "./MonthGroup";
import { parseTransactionDate, formatCurrency } from "@/lib/utils";
import { WalletIcon, TrendingUpIcon, TrendingDownIcon } from "lucide-react";

interface Transaction {
  fecha: string;
  descripcion: string;
  valor: number;
  saldo: number;
}

interface MetaInfo {
  cliente: {
    nombre: string;
    // ... other fields
  };
  resumen: {
    saldo_actual: number;
    total_abonos: number;
    total_cargos: number;
    // ... other fields
  };
  cuenta: {
    desde: string; // YYYY/MM/DD
    hasta: string;
    // ...
  }
}

interface FinancialDashboardProps {
  transactions: Transaction[];
  metaInfo: MetaInfo;
}

export function FinancialDashboard({ transactions, metaInfo }: FinancialDashboardProps) {
  // Group transactions by month and year
  const groupedTransactions = useMemo(() => {
    // Extract year from meta_info.cuenta.desde to be safer, or perform better date parsing
    // The current data format in transactions is "D/M".
    // We can assume the year from the meta_info which says "2025/09/30" to "2025/12/31".

    // Safer approach: Let's assume the year is consistent with the meta info range. 
    // Since "desde" is 2025, we use 2025. 
    // If the list spans multiple years and only gives D/M, it's tricky, but for now we assume the single year from the extract.
    const year = parseInt(metaInfo.cuenta.desde.split('/')[0]);

    const groups = new Map<string, {
      monthKey: string; // YYYY-MM for sorting
      monthName: string;
      year: number;
      transactions: Transaction[];
      totalIncome: number;
      totalExpense: number;
    }>();

    transactions.forEach(tx => {
      const date = parseTransactionDate(tx.fecha, year);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleString('es-CO', { month: 'long' });

      if (!groups.has(monthKey)) {
        groups.set(monthKey, {
          monthKey,
          monthName,
          year: date.getFullYear(),
          transactions: [],
          totalIncome: 0,
          totalExpense: 0,
        });
      }

      const group = groups.get(monthKey)!;
      group.transactions.push(tx);

      if (tx.valor >= 0) {
        group.totalIncome += tx.valor;
      } else {
        group.totalExpense += tx.valor;
      }
    });

    // Sort groups descending by date (newest months first)
    // Within each group, transactions are already likely in order, but we could sort them too if needed.
    // The provided JSON seems to be chronological order. Let's keep it or reverse it? 
    // Usually statements are chronological. Dashboards often show newest first.
    // Let's reverse the MONTHS order to show December at top, October at bottom.
    // And also reverse transactions within month to show newest first? 
    // The json has 'fecha' 1/10 then 2/10. So it's oldest first.
    // Let's reverse everything for a "timeline" feed feel.

    const sortedGroups = Array.from(groups.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    sortedGroups.forEach(g => {
      g.transactions.reverse();
    });

    return sortedGroups;
  }, [transactions, metaInfo]);

  return (
    <div className="w-full max-w-2xl mx-auto pb-20">
      {/* Header / Summary Card */}
      <div className="mb-8 p-6 rounded-3xl bg-zinc-900 text-white shadow-xl dark:bg-zinc-800 dark:border dark:border-zinc-700">
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-zinc-400 text-sm font-medium mb-1">Saldo Actual</p>
            <h1 className="text-4xl font-bold tracking-tight">{formatCurrency(metaInfo.resumen.saldo_actual)}</h1>
          </div>
          <div className="p-3 bg-zinc-800 rounded-2xl dark:bg-zinc-950/50">
            <WalletIcon className="h-6 w-6 text-emerald-400" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-zinc-800/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2 mb-2 text-emerald-400">
              <TrendingUpIcon className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Ingresos</span>
            </div>
            <p className="text-lg font-semibold">{formatCurrency(metaInfo.resumen.total_abonos)}</p>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-800/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2 mb-2 text-rose-400">
              <TrendingDownIcon className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Egresos</span>
            </div>
            <p className="text-lg font-semibold">{formatCurrency(metaInfo.resumen.total_cargos)}</p>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-8">
        {groupedTransactions.map(group => (
          <MonthGroup
            key={group.monthKey}
            monthName={group.monthName}
            year={group.year}
            transactions={group.transactions}
            totalIncome={group.totalIncome}
            totalExpense={group.totalExpense}
          />
        ))}
      </div>
    </div>
  );
}
