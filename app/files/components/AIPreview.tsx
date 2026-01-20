import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckIcon, XIcon, InfoIcon, AlertTriangleIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AIPreviewProps {
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

export function AIPreview({ data }: AIPreviewProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Total Abonos</p>
          <p className="text-sm font-bold text-emerald-600">
            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(data.meta_info.resumen.total_abonos)}
          </p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Total Cargos</p>
          <p className="text-sm font-bold text-rose-600">
            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(data.meta_info.resumen.total_cargos)}
          </p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Saldo Final</p>
          <p className={`text-sm font-bold ${data.meta_info.resumen.saldo_actual >= 0 ? 'text-blue-600' : 'text-zinc-900 dark:text-zinc-100'}`}>
            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(data.meta_info.resumen.saldo_actual)}
          </p>
        </div>
      </div>

      <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-3 rounded-xl flex gap-3 items-start">
        <InfoIcon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
          Verifica que la IA haya interpretado correctamente los signos de los valores.
          <b> Cargos (-)</b> deben ser negativos y <b>Abonos (+)</b> positivos.
        </p>
      </div>

      <ScrollArea className="h-[300px] border rounded-xl">
        <Table>
          <TableHeader className="bg-zinc-50 dark:bg-zinc-900/50 sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-[80px] text-[10px] font-bold">FECHA</TableHead>
              <TableHead className="text-[10px] font-bold">DESCRIPCIÓN</TableHead>
              <TableHead className="text-right text-[10px] font-bold">VALOR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.transacciones.map((tx, i) => (
              <TableRow key={i} className={tx.ignored ? "opacity-50" : ""}>
                <TableCell className="text-[11px] font-medium py-2">{tx.fecha}</TableCell>
                <TableCell className="text-[11px] py-2">
                  <div className="flex flex-col">
                    <span className="truncate max-w-[180px]">{tx.descripcion}</span>
                    {tx.ignored && <span className="text-[9px] text-zinc-400 font-medium">Ignorada (Pago/Transferencia)</span>}
                  </div>
                </TableCell>
                <TableCell className={`text-right text-[11px] font-bold py-2 ${tx.valor < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(tx.valor)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
