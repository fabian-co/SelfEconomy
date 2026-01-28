import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InfoIcon, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, TrendingUp, X } from "lucide-react";

interface IATablePreviewProps {
  data: {
    meta_info: {
      banco: string;
      tipo_cuenta: string;
      resumen: {
        saldo_actual: number;
        total_abonos: number;
        total_cargos: number;
      };
    };
    transacciones: Array<{
      fecha: string;
      descripcion: string;
      valor: number;
      ignored: boolean;
      originalValor?: number;
      isMarkedPositive?: boolean;
    }>;
  };
  onUpdateTransaction?: (data: {
    description: string;
    originalDescription: string;
    markAsPositive: boolean;
    applyPositiveGlobally: boolean;
    markAsIgnored: boolean;
    applyIgnoreGlobally: boolean;
    originalAmount: number;
  }) => void;
  pendingRules: any[];
}

export function IATablePreview({ data, onUpdateTransaction, pendingRules }: IATablePreviewProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTransactions = data.transacciones.filter((tx) =>
    tx.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4" id="ia-table-preview-container">

      <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-3 rounded-xl flex gap-3 items-start" id="ia-verification-notice">
        <InfoIcon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
          Verifica que la IA haya interpretado correctamente los signos de los valores.
          <b> Cargos (-)</b> deben ser negativos y <b>Abonos (+)</b> positivos.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Buscar transacción por descripción..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 rounded-xl h-9 text-[11px]"
        />
      </div>

      <ScrollArea className="h-[300px] border rounded-xl" id="ia-transactions-scroll-area">
        <Table id="ia-transactions-table">
          <TableHeader className="bg-zinc-50 dark:bg-zinc-900/50 sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-[80px] text-[10px] font-bold">FECHA</TableHead>
              <TableHead className="text-[10px] font-bold">DESCRIPCIÓN</TableHead>
              <TableHead className="text-right text-[10px] font-bold">VALOR</TableHead>
              <TableHead className="text-center text-[10px] font-bold w-[60px]">ACCIONES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody id="ia-transactions-body">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx, i) => {
                // Apply pending rules to display state
                const pendingRule = pendingRules.find((r: any) => r.description === tx.descripcion);
                const isIgnored = pendingRule ? (pendingRule.markAsIgnored === true) : tx.ignored;
                const isMarkedPositive = pendingRule ? (pendingRule.markAsPositive === true) : (tx.isMarkedPositive || (tx.valor > 0));

                let displayValor = tx.valor;
                const originalAmount = tx.originalValor ?? tx.valor;
                if (pendingRule) {
                  if (pendingRule.markAsPositive !== undefined) {
                    displayValor = pendingRule.markAsPositive ? Math.abs(originalAmount) : -Math.abs(originalAmount);
                  }
                }

                return (
                  <TableRow key={i} className={isIgnored ? "opacity-50" : ""} id={`ia-tx-row-${i}`}>
                    <TableCell className="text-[11px] font-medium py-2">{tx.fecha}</TableCell>
                    <TableCell className="text-[11px] py-2">
                      <div className="flex flex-col">
                        <span className="truncate max-w-[180px]">{tx.descripcion}</span>
                        {isIgnored && <span className="text-[9px] text-zinc-400 font-medium">Ignorada (Manual/IA)</span>}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right text-[11px] font-bold py-2 ${displayValor < 0 ? 'text-rose-600' : 'text-emerald-600'}`} id={`ia-tx-value-${i}`}>
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(displayValor)}
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <EditTransactionDialog
                        transaction={{ ...tx, ignored: isIgnored, isMarkedPositive }}
                        onSave={(editData) => onUpdateTransaction?.({
                          ...editData,
                          originalDescription: tx.descripcion,
                          originalAmount: originalAmount
                        })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-zinc-500 text-[11px]">
                  No se encontraron transacciones con esa descripción.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function EditTransactionDialog({
  transaction,
  onSave
}: {
  transaction: any;
  onSave: (data: any) => void
}) {
  const [open, setOpen] = useState(false);
  const [markAsPositive, setMarkAsPositive] = useState(transaction.isMarkedPositive || false);
  const [applyPositiveGlobally, setApplyPositiveGlobally] = useState(false);
  const [markAsIgnored, setMarkAsIgnored] = useState(transaction.ignored || false);
  const [applyIgnoreGlobally, setApplyIgnoreGlobally] = useState(false);

  const originalAmount = transaction.originalValor ?? transaction.valor;

  const handleSave = () => {
    onSave({
      description: transaction.descripcion,
      markAsPositive,
      applyPositiveGlobally,
      markAsIgnored,
      applyIgnoreGlobally
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <Pencil className="h-3.5 w-3.5 text-zinc-500" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] rounded-3xl p-6 bg-white dark:bg-zinc-950 border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Editar Transacción</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Descripción Original</p>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">{transaction.descripcion}</p>
          </div>

          {/* Mark as Positive (Flip Sign) - Recycled Logic */}
          <div className={`space-y-3 p-4 rounded-xl border transition-colors duration-300 ${(originalAmount < 0 && !markAsPositive) || (originalAmount > 0 && markAsPositive)
            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30"
            : "bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30"
            }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className={`h-4 w-4 ${(originalAmount < 0 && !markAsPositive) || (originalAmount > 0 && markAsPositive)
                  ? "text-emerald-600 dark:text-emerald-500"
                  : "text-rose-600 dark:text-rose-500"
                  }`} />
                <Label htmlFor="markAsPositive" className={`text-sm font-medium cursor-pointer ${(originalAmount < 0 && !markAsPositive) || (originalAmount > 0 && markAsPositive)
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400"
                  }`}>
                  {originalAmount < 0
                    ? (markAsPositive ? "Desmarcar como ingreso" : "Marcar como ingreso (+)")
                    : (markAsPositive ? "Desmarcar como egreso" : "Marcar como egreso (-)")
                  }
                </Label>
              </div>
              <Switch
                id="markAsPositive"
                checked={markAsPositive}
                onCheckedChange={(checked) => {
                  setMarkAsPositive(checked);
                  if (!checked) setApplyPositiveGlobally(false);
                }}
                className={
                  (originalAmount < 0 && markAsPositive) || (originalAmount > 0 && !markAsPositive)
                    ? "data-[state=checked]:bg-rose-500"
                    : "data-[state=checked]:bg-emerald-600"
                }
              />
            </div>
            {markAsPositive && (
              <div className={`flex items-center space-x-2 pt-2 border-t ${(originalAmount < 0 && !markAsPositive) || (originalAmount > 0 && markAsPositive)
                ? "border-emerald-100 dark:border-emerald-900/30"
                : "border-rose-100 dark:border-rose-900/30"
                }`}>
                <Checkbox
                  id="applyPositiveGlobally"
                  checked={applyPositiveGlobally}
                  onCheckedChange={(checked) => setApplyPositiveGlobally(checked as boolean)}
                  className={`rounded-md ${(originalAmount < 0 && !markAsPositive) || (originalAmount > 0 && markAsPositive)
                    ? "border-emerald-300 dark:border-emerald-700 data-[state=checked]:bg-emerald-600"
                    : "border-rose-300 dark:border-rose-700 data-[state=checked]:bg-rose-600"
                    }`}
                />
                <label htmlFor="applyPositiveGlobally" className="text-xs font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer">
                  Aplicar a todas similares
                </label>
              </div>
            )}
          </div>

          {/* Mark as Ignored - Recycled Logic */}
          <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <X className="h-4 w-4 text-zinc-500" />
                <Label htmlFor="markAsIgnored" className="text-sm font-medium text-zinc-700 dark:text-zinc-400 cursor-pointer">
                  Ignorar transacción
                </Label>
              </div>
              <Switch
                id="markAsIgnored"
                checked={markAsIgnored}
                onCheckedChange={(checked) => {
                  setMarkAsIgnored(checked);
                  if (!checked) setApplyIgnoreGlobally(false);
                }}
              />
            </div>
            {markAsIgnored && (
              <div className="flex items-center space-x-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <Checkbox
                  id="applyIgnoreGlobally"
                  checked={applyIgnoreGlobally}
                  onCheckedChange={(checked) => setApplyIgnoreGlobally(checked as boolean)}
                  className="rounded-md border-zinc-300 dark:border-zinc-700"
                />
                <label htmlFor="applyIgnoreGlobally" className="text-xs font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer">
                  Aplicar a todas similares
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl px-6">
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-10">
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
