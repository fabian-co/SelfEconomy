import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InfoIcon, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { Input } from "@/components/ui/input";

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
    }>;
  };
}

export function IATablePreview({ data }: IATablePreviewProps) {
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
            </TableRow>
          </TableHeader>
          <TableBody id="ia-transactions-body">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx, i) => (
                <TableRow key={i} className={tx.ignored ? "opacity-50" : ""} id={`ia-tx-row-${i}`}>
                  <TableCell className="text-[11px] font-medium py-2">{tx.fecha}</TableCell>
                  <TableCell className="text-[11px] py-2">
                    <div className="flex flex-col">
                      <span className="truncate max-w-[180px]">{tx.descripcion}</span>
                      {tx.ignored && <span className="text-[9px] text-zinc-400 font-medium">Ignorada (Pago/Transferencia)</span>}
                    </div>
                  </TableCell>
                  <TableCell className={`text-right text-[11px] font-bold py-2 ${tx.valor < 0 ? 'text-rose-600' : 'text-emerald-600'}`} id={`ia-tx-value-${i}`}>
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(tx.valor)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-zinc-500 text-[11px]">
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
