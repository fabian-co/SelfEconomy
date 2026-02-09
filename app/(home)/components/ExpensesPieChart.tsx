"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { GroupedTransaction } from "../types/index";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Category } from "./category-manager/CategoryItem";
import { IconMap } from "./category-manager/constants";
import { Tag } from "lucide-react";

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

    const dataMap: Record<string, { name: string; value: number; originalValue: number; color: string; icon: string }> = {};

    currentGroup.transactions.forEach(tx => {
      // Logic for ignoring transactions
      if (tx.ignored) return;
      if (tx.tipo_cuenta === 'credit' && tx.valor > 0 && ignoreCreditCardInflows) return;
      if (tx.tipo_cuenta === 'debit' && tx.valor > 0 && ignoreDebitCardInflows) return;

      const catId = tx.categoryId || "uncategorized";
      const category = categories.find(c => c.id === catId);

      if (!dataMap[catId]) {
        dataMap[catId] = {
          name: category?.name || (catId === "uncategorized" ? "Sin Categoría" : "Desconocida"),
          value: 0, // This will store the absolute value for the chart slices
          originalValue: 0, // This stores the actual signed total
          color: category?.color || "#71717a",
          icon: category?.icon || "Tag"
        };
      }
      dataMap[catId].originalValue += tx.valor;
    });

    // Convert to array and handle sorting
    return Object.values(dataMap)
      .map(item => ({
        ...item,
        value: Math.abs(item.originalValue) // Set absolute value for pie chart sizing
      }))
      .filter(item => item.value > 0) // Filter out zero-value categories
      .sort((a, b) => {
        const aIsPositive = a.originalValue >= 0;
        const bIsPositive = b.originalValue >= 0;

        if (aIsPositive && !bIsPositive) return -1; // Positive first
        if (!aIsPositive && bIsPositive) return 1;

        if (aIsPositive) {
          // Both positive: descending value (100 -> 50)
          return b.originalValue - a.originalValue;
        } else {
          // Both negative: descending magnitude (-100 -> -50)
          // -100 is smaller than -50, so ascending numeric sort puts -100 first
          return a.originalValue - b.originalValue;
        }
      });
  }, [currentGroup, categories, ignoreCreditCardInflows, ignoreDebitCardInflows]);

  if (data.length === 0) return null;

  const totalExpense = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percent = ((data.value / totalExpense) * 100).toFixed(1);
      const isPositive = data.originalValue >= 0;

      return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-lg">
          <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{data.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
            <span className={`text-xs ${isPositive ? 'text-emerald-600' : 'text-zinc-500 dark:text-zinc-400'}`}>
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(data.originalValue)}
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
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
                label={(props: any) => {
                  const RADIAN = Math.PI / 180;
                  const { cx, cy, midAngle, outerRadius, percent, payload, index } = props;

                  // Base radius for labels
                  const baseRadius = outerRadius + 50;

                  // Calculate base position
                  let x = cx + baseRadius * Math.cos(-midAngle * RADIAN);
                  let y = cy + baseRadius * Math.sin(-midAngle * RADIAN);

                  // Simple collision avoidance: if in dense area, push label out more
                  const labelHeight = 45;
                  const minVerticalSpacing = 20;

                  // Check if this label is in a densely packed vertical area
                  // by seeing if adjacent indices have similar Y positions
                  if (data.length > 5 && index > 0 && index < data.length - 1) {
                    // For labels close to horizontal axes, add extra spacing
                    const normalizedY = Math.abs((y - cy) / outerRadius);
                    if (normalizedY < 0.3) {
                      // Near horizontal axis - push further out
                      const extraRadius = 15 * (1 - normalizedY);
                      x = cx + (baseRadius + extraRadius) * Math.cos(-midAngle * RADIAN);
                      y = cy + (baseRadius + extraRadius) * Math.sin(-midAngle * RADIAN);
                    }
                  }

                  const IconComponent = IconMap[payload.icon] || Tag;

                  return (
                    <g>
                      {/* Icon */}
                      <foreignObject x={x - 12} y={y - 24} width={24} height={24}>
                        <div className="flex items-center justify-center w-full h-full">
                          <IconComponent
                            size={20}
                            color={payload.color}
                            strokeWidth={2.5}
                          />
                        </div>
                      </foreignObject>

                      {/* Percentage */}
                      <text
                        x={x}
                        y={y + 14}
                        fill="#71717a"
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-[11px] font-bold dark:fill-zinc-400"
                      >
                        {`${((percent || 0) * 100).toFixed(0)}%`}
                      </text>
                    </g>
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
