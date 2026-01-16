"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { XIcon } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";

interface RuleConfigurationProps {
  bank: string;
  accountType: string;
  transactions: string[];
  selectedRules: string[];
  onRulesChange: (rules: string[]) => void;
}

export function RuleConfiguration({
  bank,
  accountType,
  transactions,
  selectedRules,
  onRulesChange
}: RuleConfigurationProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const toggleRule = (desc: string) => {
    onRulesChange(
      selectedRules.includes(desc)
        ? selectedRules.filter(r => r !== desc)
        : [...selectedRules, desc]
    );
  };

  const filteredTransactions = transactions.filter(desc =>
    desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl text-sm text-blue-600 dark:text-blue-400">
        {bank === 'bancolombia' ? (
          <>Selecciona las transacciones que deseas <strong>ignorar</strong> (ej: pagos de tarjeta, transferencias internas). Estas no se incluirán en el reporte.</>
        ) : (
          <>Selecciona las transacciones que correspondan a <strong>pagos a la tarjeta</strong> (ej: pagos desde cuenta de ahorros). Estas se registrarán como valores positivos (abonos).</>
        )}
      </div>

      {/* Selected Rules Badges */}
      {selectedRules.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedRules.map((rule, i) => (
            <Badge key={i} variant="secondary" className="pl-3 pr-1 py-1 rounded-lg text-xs font-normal flex items-center gap-1">
              {rule}
              <button
                onClick={() => toggleRule(rule)}
                className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
                type="button"
              >
                <XIcon className="h-3 w-3 text-zinc-500" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search Bar */}
      <SearchInput
        placeholder="Buscar transacción..."
        value={searchTerm}
        onChange={setSearchTerm}
      />

      {/* Transaction List */}
      <ScrollArea className="h-[300px] w-full rounded-xl border p-4">
        <div className="space-y-2">
          {filteredTransactions.map((desc, i) => (
            <div key={i} className="flex items-start space-x-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg transition-colors">
              <Checkbox
                id={`desc-${i}`}
                checked={selectedRules.includes(desc)}
                onCheckedChange={() => toggleRule(desc)}
              />
              <label
                htmlFor={`desc-${i}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer pt-0.5"
              >
                {desc}
              </label>
            </div>
          ))}
          {filteredTransactions.length === 0 && (
            <div className="text-center py-10 text-zinc-400 text-sm">
              No se encontraron coincidencias
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
