"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { GroupedTransaction } from "../types/index";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Category } from "./category-manager/CategoryItem";

interface ExpensesPieChartProps {
  currentGroup?: GroupedTransaction;
  categories: Category[];
  ignoreCreditCardInflows?: boolean;
  ignoreDebitCardInflows?: boolean;
}

export function ExpensesPieChart({
  currentGroup,
  categories,
  ignoreCreditCardInflows,
  ignoreDebitCardInflows
}: ExpensesPieChartProps) {
  const data = useMemo(() => {
    if (!currentGroup) return [];

    const groups: Record<string, { name: string; value: number; color: string }> = {};

    currentGroup.transactions.forEach(tx => {
      // Logic for ignoring transactions
      if (tx.ignored) return;
      if (tx.tipo_cuenta === 'credit' && tx.valor > 0 && ignoreCreditCardInflows) return;
      if (tx.tipo_cuenta === 'debit' && tx.valor > 0 && ignoreDebitCardInflows) return;

      // Only count expenses (negative values)
      if (tx.valor >= 0) return;

      const catId = tx.categoryId || "uncategorized";
      const category = categories.find(c => c.id === catId);
      const absValue = Math.abs(tx.valor);

      if (!groups[catId]) {
        groups[catId] = {
          name: category?.name || (catId === "uncategorized" ? "Sin Categoría" : "Desconocida"),
          value: 0,
          color: category?.color || "#71717a"
        };
      }
      groups[catId].value += absValue;
    });

    return Object.values(groups)
      .sort((a, b) => b.value - a.value);
  }, [currentGroup, categories, ignoreCreditCardInflows, ignoreDebitCardInflows]);

  if (data.length === 0) return null;

  const totalExpense = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percent = ((data.value / totalExpense) * 100).toFixed(1);
      return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-lg">
          <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{data.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(data.value)}
            </span>
            <span className="text-xs font-medium text-zinc-400">({percent}%)</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="pb-2 px-0">
        <CardTitle className="text-lg font-bold text-zinc-700 dark:text-zinc-300">
          Gastos por Categoría
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
                  const RADIAN = Math.PI / 180;
                  const radius = outerRadius + 25;
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);

                  return (
                    <text
                      x={x}
                      y={y}
                      fill="#71717a"
                      textAnchor={x > cx ? 'start' : 'end'}
                      dominantBaseline="central"
                      className="text-xs font-medium dark:fill-zinc-400"
                      style={{ fontSize: '11px', fontWeight: 500 }}
                    >
                      {`${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    </text>
                  );
                }}
                labelLine={{ stroke: '#e4e4e7', strokeWidth: 1 }}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
