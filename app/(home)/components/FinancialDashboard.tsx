"use client";

import { useMemo, useState } from "react";
import { parseTransactionDate } from "@/lib/utils";
import { Transaction, MetaInfo, GroupedTransaction } from "../types/index";
import { SummaryCard } from "./SummaryCard";
import { TransactionList } from "./TransactionList";
import { useSettingsStore } from "@/lib/store/settingsStore";

interface FinancialDashboardProps {
  transactions: Transaction[];
  metaInfo: MetaInfo;
}

export function FinancialDashboard({ transactions, metaInfo: initialMetaInfo }: FinancialDashboardProps) {
  const { ignoreCreditCardInflows, ignoreDebitCardInflows } = useSettingsStore();

  // Helper function to check if a transaction should be counted based on settings
  const shouldCountTransaction = (tx: Transaction) => {
    if (tx.ignored) return false;

    // Check credit card inflows
    if (tx.tipo_cuenta === 'credit' && tx.valor > 0 && ignoreCreditCardInflows) {
      return false;
    }

    // Check debit card inflows
    if (tx.tipo_cuenta === 'debit' && tx.valor > 0 && ignoreDebitCardInflows) {
      return false;
    }

    return true;
  };

  // Recalculate Global Totals based on settings
  const calculatedMetaInfo = useMemo(() => {
    // Clone the initial meta info to avoid mutating props
    const newMetaInfo = JSON.parse(JSON.stringify(initialMetaInfo));

    // Reset totals to recalculate
    newMetaInfo.resumen.saldo_actual = 0;
    newMetaInfo.resumen.total_abonos = 0;
    newMetaInfo.resumen.total_cargos = 0;

    // We assume the starting balance from files (meta_info.resumen.saldo_actual) 
    // might also need adjustment if it included ignored transactions. 
    // However, usually "saldo_actual" in the file metadata is the bank's reported balance, 
    // which is truth. 
    // Since we are building a personal finance view, maybe we just sum up the delta of VALID transactions?
    // 
    // BUT: The initialMetaInfo props come from page.tsx which ALREADY did a summation logic.
    // To do this cleanly on the client without double-counting, we should probably 
    // re-run the aggregation logic over `transactions` completely on the client, 
    // OR try to "undo" the server logic. 
    // 
    // Given page.tsx calculation is:
    // metaInfo.resumen.total_abonos = 0;
    // metaInfo.resumen.total_cargos = 0;
    // ... loop transactions ...
    //
    // We can replicate that here safely.

    // Base balance (start of period or absolute from bank)
    // If the balance comes from the files metadata, we might keep it or adjust it.
    // For now, let's recalculate the flow totals (Ingresos/Egresos) strictly from the transaction list.
    // "saldo_actual" is tricky because it depends on the "initial balance" which we might not have separately.
    // Let's assume we want to show the "Calculated Balance" based on the visible transactions + initial.
    // OR we just show the accumulated delta.

    // Let's preserve the original "saldo_actual" from the prop as a base, but that might be inconsistent
    // if we start ignoring things calculations-wise.
    // 
    // Let's stick to calculating Totals (Inc/Exp) correctly first. 
    // Use the initialMetaInfo.resumen.saldo_actual as the reference, but we might not be able to "fix" it 
    // perfectly without knowing the starting balance.
    // 
    // Actually, looking at page.tsx:
    // metaInfo.resumen.saldo_actual += data.meta_info?.resumen?.saldo_actual || 0;
    // And then it ADDS deltas. 
    //
    // Let's just recalculate Totals for now, and apply the net flow to the balance?
    // Or just trust the totals calculation.

    let totalIncome = 0;
    let totalExpense = 0;
    let netFlow = 0;

    transactions.forEach(tx => {
      // Calculate net flow effect on balance (delta)
      // Original logic in page.tsx:
      // const delta = (tx.ignored ? 0 : tx.valor) - tx.originalValor;
      // metaInfo.resumen.saldo_actual += delta;

      // Here we want to calculate the totals based on CURRENT settings.
      // If we ignore a CC inflow:
      // - It shouldn't appear in "Ingresos Totales"
      // - It shouldn't increase "Saldo Actual" (if we treat saldo as "User's Net Worth" logic)

      if (shouldCountTransaction(tx)) {
        if (tx.valor > 0) {
          totalIncome += tx.valor;
        } else {
          totalExpense += Math.abs(tx.valor);
        }
        netFlow += tx.valor;
      }
    });

    newMetaInfo.resumen.total_abonos = totalIncome;
    newMetaInfo.resumen.total_cargos = totalExpense;

    // For balance, we can't easily recalculate "absolute balance" without a known start point.
    // However, if we assume the user wants to see the "sum of these transactions", we can show netFlow.
    // BUT the UI shows "Saldo Actual". 
    // Let's assume for now we just update the totals (Ingresos/Egresos) as requested by the prompt:
    // "ignorar los ingresos de los totales y de los resumenes mensuales"
    // The prompt mentions "saldo actual" too: "estos serán presentes o no en los valores del saldo actual, ingresos y egresos totales".
    //
    // This implies we SHOULD adjust saldo actual.
    // If we assume initialMetaInfo.resumen.saldo_actual is "Bank Balance", ignoring a payment shouldn't change the Bank Balance.
    // BUT if the user wants to "ignore it", maybe they want a "Virtual Balance"?
    // 
    // Let's adopt a "Delta" approach. 
    // We calculate the totals of ALL transactions (unfiltered) to see what the "Bank" thinks (roughly).
    // Then we calculate the totals with FILTERS.
    // The difference is what we subtract from the displayed balance.

    let allIncludedFlow = 0;
    transactions.forEach(tx => {
      if (!tx.ignored) allIncludedFlow += tx.valor;
    });

    // Balance Displayed = Original Prop Balance - (All Included Flow) + (Filtered Flow)
    // basically replacing the flow component of the balance.
    const flowDifference = netFlow - allIncludedFlow;
    newMetaInfo.resumen.saldo_actual = initialMetaInfo.resumen.saldo_actual + flowDifference;

    return newMetaInfo;
  }, [transactions, initialMetaInfo, ignoreCreditCardInflows, ignoreDebitCardInflows]);


  // Group transactions by month and year
  const groupedTransactions = useMemo(() => {
    // Extract year from meta_info.cuenta.desde to be safer, or perform better date parsing
    const year = parseInt(initialMetaInfo.cuenta.desde.split('/')[0]);

    const groups = new Map<string, GroupedTransaction>();

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

      // Sum based on Settings
      if (shouldCountTransaction(tx)) {
        if (tx.valor > 0) {
          group.totalIncome += tx.valor;
        } else {
          group.totalExpense += Math.abs(tx.valor);
        }
      }
    });

    // Sort groups descending by date (newest months first)
    const sortedGroups = Array.from(groups.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    sortedGroups.forEach(g => {
      g.transactions.reverse();
    });

    return sortedGroups;
  }, [transactions, initialMetaInfo, ignoreCreditCardInflows, ignoreDebitCardInflows]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentGroup = groupedTransactions[currentIndex];

  const handlePrev = () => {
    if (currentIndex < groupedTransactions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Summary Card */}
        <div className="lg:col-span-5 lg:sticky lg:top-8">
          {/* Pass calculated meta info */}
          <SummaryCard metaInfo={calculatedMetaInfo} currentGroup={currentGroup} />
        </div>

        {/* Right Column: Transactions */}
        <div className="lg:col-span-7">
          <TransactionList
            currentGroup={currentGroup}
            onPrev={handlePrev}
            onNext={handleNext}
            canGoPrev={currentIndex < groupedTransactions.length - 1}
            canGoNext={currentIndex > 0}
          />
        </div>
      </div>
    </div>
  );
}

