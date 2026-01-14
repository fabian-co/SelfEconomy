import { formatCurrency } from "@/lib/utils";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

interface TransactionItemProps {
  description: string;
  date: string;
  value: number;
}

export function TransactionItem({ description, date, value }: TransactionItemProps) {
  const isIncome = value >= 0;

  return (
    <div className="group flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 rounded-xl transition-colors">
      <div className="flex items-center gap-4">
        <div className={`
          flex h-10 w-10 items-center justify-center rounded-full 
          ${isIncome ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-500' : 'bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-500'}
        `}>
          {isIncome ? <ArrowUpIcon className="h-5 w-5" /> : <ArrowDownIcon className="h-5 w-5" />}
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1">{description}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{date}</span>
        </div>
      </div>
      <div className={`font-semibold ${isIncome ? 'text-emerald-600 dark:text-emerald-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
        {isIncome ? '+' : ''}{formatCurrency(value)}
      </div>
    </div>
  );
}
