"use client";

import { useMemo, useState } from "react";
import { parseTransactionDate } from "@/lib/utils";
import { Transaction, MetaInfo, GroupedTransaction } from "../types/index";
import { SummaryCard } from "./SummaryCard";
import { TransactionList } from "./TransactionList";

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

      if (tx.valor >= 0) {
        // Only count as income if it's NOT a credit card payment
        if (tx.tipo_cuenta !== 'credit') {
          group.totalIncome += tx.valor;
        }
      } else {
        group.totalExpense += tx.valor;
      }
    });

    // Sort groups descending by date (newest months first)
    const sortedGroups = Array.from(groups.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    sortedGroups.forEach(g => {
      g.transactions.reverse();
    });

    return sortedGroups;
  }, [transactions, metaInfo]);

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
          <SummaryCard metaInfo={metaInfo} currentGroup={currentGroup} />
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

