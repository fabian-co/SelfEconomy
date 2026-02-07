"use client";

import { useSettingsStore } from "@/lib/store/settingsStore";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Info, ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ConfigurationPage() {
  const {
    ignoreCreditCardInflows,
    setIgnoreCreditCardInflows,
    ignoreDebitCardInflows,
    setIgnoreDebitCardInflows
  } = useSettingsStore();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 md:p-8 font-sans">
      <div className="w-full max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Configuración</h1>
        </div>

        <div className="bg-white dark:bg-zinc-950 rounded-3xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800 space-y-8">

          <div className="space-y-1 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Cálculo de Totales</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Personaliza qué transacciones se incluyen en los resúmenes y saldos.
            </p>
          </div>

          <div className="space-y-6">

            {/* Credit Card Inflows Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1 pr-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="ignore-cc-inflows" className="text-base font-medium">
                    Ignorar ingresos de tarjetas de crédito
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-zinc-400 hover:text-blue-500 transition-colors" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs p-4 text-sm bg-zinc-800 text-white rounded-xl border-zinc-700">
                        <p>
                          Ignorar los ingresos en las tarjetas de crédito por defecto están ignorados porque comúnmente corresponden a pagos de la misma tarjeta débito del mismo usuario, entonces no corresponden a un ingreso económico, más que el pago de los mismo gastos hechos por el usuario.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {ignoreCreditCardInflows
                    ? "Los abonos a tarjetas de crédito no suman a los ingresos totales."
                    : "Los abonos a tarjetas de crédito se suman a los ingresos totales."}
                </p>
              </div>
              <Switch
                id="ignore-cc-inflows"
                checked={ignoreCreditCardInflows}
                onCheckedChange={setIgnoreCreditCardInflows}
              />
            </div>

            {/* Debit Card Inflows Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1 pr-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="ignore-dc-inflows" className="text-base font-medium">
                    Ignorar ingresos de tarjetas débito
                  </Label>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {ignoreDebitCardInflows
                    ? "Los ingresos en cuentas de débito (ahorros/corriente) no se suman a los totales."
                    : "Los ingresos en cuentas de débito se suman normalmente a los totales."}
                </p>
              </div>
              <Switch
                id="ignore-dc-inflows"
                checked={ignoreDebitCardInflows}
                onCheckedChange={setIgnoreDebitCardInflows}
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
