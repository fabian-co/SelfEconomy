import { TransactionItem } from "./TransactionItem";

interface Transaction {
  fecha: string;
  descripcion: string;
  valor: number;
  saldo: number;
}

interface MonthGroupProps {
  monthName: string;
  year: number;
  transactions: Transaction[];
  totalIncome: number;
  totalExpense: number;
}

export function MonthGroup({ monthName, year, transactions, totalIncome, totalExpense }: MonthGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white/80 py-4 backdrop-blur-md dark:bg-black/80">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 capitalize">
          {monthName} <span className="text-zinc-500 dark:text-zinc-600 font-normal">{year}</span>
        </h2>
        {/* Optional: Show monthly summary in header */}
        {/* <div className="text-xs font-medium text-zinc-500">
          <span className="text-emerald-600">+{formatCurrency(totalIncome)}</span>
          <span className="mx-2">•</span>
          <span className="text-rose-600">{formatCurrency(totalExpense)}</span>
        </div> */}
      </div>

      <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
        {transactions.map((tx, index) => (
          <TransactionItem
            key={`${tx.fecha}-${index}`}
            description={tx.descripcion}
            date={tx.fecha}
            value={tx.valor}
          />
        ))}
      </div>
    </div>
  );
}
