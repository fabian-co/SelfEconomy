import { FinancialDashboard } from "./components/FinancialDashboard";
import fs from "fs";
import path from "path";

export default function Home() {
  const processedDir = path.join(process.cwd(), "app/api/extracto/processed");

  let allTransactions: any[] = [];
  let metaInfo = {
    cliente: { nombre: "Cargando..." },
    resumen: {
      saldo_actual: 0,
      total_abonos: 0,
      total_cargos: 0,
    },
    cuenta: {
      desde: "2025/01/01",
      hasta: new Date().toISOString().split("T")[0].replace(/-/g, "/"),
    },
  };

  const rulesPath = path.join(process.cwd(), "custom-data/rules/category-rules.json");
  const flipRulesPath = path.join(process.cwd(), "custom-data/rules/flip-rules.json");
  const categoriesPath = path.join(process.cwd(), "constants/categories.json");
  const customCategoriesPath = path.join(process.cwd(), "custom-data/categories/custom-categories.json");
  const ignoreRulesPath = path.join(process.cwd(), "custom-data/rules/ignore-rules.json");

  let categoryRules: Record<string, any> = {};
  let flipRules: { byDescription: Record<string, any>; byId: Record<string, any> } = { byDescription: {}, byId: {} };
  let ignoreRules: { byDescription: Record<string, any>; byId: Record<string, any> } = { byDescription: {}, byId: {} };
  let categories: any[] = [];

  if (fs.existsSync(rulesPath)) {
    categoryRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  }

  // Load flip rules
  if (fs.existsSync(flipRulesPath)) {
    flipRules = JSON.parse(fs.readFileSync(flipRulesPath, 'utf8'));
  }

  // Load ignore rules
  if (fs.existsSync(ignoreRulesPath)) {
    ignoreRules = JSON.parse(fs.readFileSync(ignoreRulesPath, 'utf8'));
  }

  // Load default categories
  if (fs.existsSync(categoriesPath)) {
    categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
  }

  // Load and merge custom categories
  if (fs.existsSync(customCategoriesPath)) {
    const customCats = JSON.parse(fs.readFileSync(customCategoriesPath, 'utf8'));
    categories = [...categories, ...customCats];
  }


  if (fs.existsSync(processedDir)) {
    const files = fs.readdirSync(processedDir).filter(f => f.endsWith('.json'));

    files.forEach(file => {
      try {
        const content = fs.readFileSync(path.join(processedDir, file), 'utf8');
        const data = JSON.parse(content);

        // Add source/bank info and account type to each transaction
        const bankName = data.meta_info?.banco || "Bancolombia";
        const accountType = data.meta_info?.tipo_cuenta || "debit";

        const transactionsWithSource = data.transacciones.map((tx: any, index: number) => {
          const originalDescription = tx.descripcion;
          const rule = categoryRules[originalDescription];

          let description = tx.descripcion;
          let categoryId = tx.categoryId;
          let categoryName = tx.categoryName;

          if (rule) {
            description = rule.title || description;
            categoryId = rule.categoryId;
            categoryName = rule.categoryName;
          }

          // Generate transaction ID for positive rule lookup
          const txId = tx.id || `${tx.fecha}-${tx.descripcion}-${tx.valor}-${index}`;

          // Check flip rules (by description or by ID)
          let isMarkedPositive = false;
          let isPositiveGlobal = false;
          // Check if there's a flip rule by description (partial match)
          const descriptionRule = Object.keys(flipRules.byDescription).find(
            key => originalDescription.includes(key)
          );

          if (descriptionRule) {
            isMarkedPositive = flipRules.byDescription[descriptionRule].isPositive === true;
            isPositiveGlobal = true;
          } else if (flipRules.byId[txId]) {
            isMarkedPositive = flipRules.byId[txId].isPositive === true;
            isPositiveGlobal = false;
          } else {
            // Fallback to what was in the AI processed data if no rule exists
            isMarkedPositive = tx.isMarkedPositive || false;
            isPositiveGlobal = false;
          }

          // Check ignore rules (by description or by ID)
          let isMarkedIgnored = false;
          let isIgnoredGlobal = false;

          const ignoreDescriptionRule = Object.keys(ignoreRules.byDescription).find(
            key => originalDescription.includes(key)
          );

          if (ignoreDescriptionRule) {
            isMarkedIgnored = ignoreRules.byDescription[ignoreDescriptionRule].isIgnored === true;
            isIgnoredGlobal = true;
          } else if (ignoreRules.byId[txId]) {
            isMarkedIgnored = ignoreRules.byId[txId].isIgnored === true;
            isIgnoredGlobal = false;
          } else {
            isMarkedIgnored = tx.isMarkedIgnored || false;
            isIgnoredGlobal = false;
          }

          const originalValor = tx.valor;
          let valor = tx.valor;

          // Only flip the sign when there's an explicit flip rule
          // Otherwise, preserve the original value from the AI processing
          const hasFlipRule = descriptionRule || flipRules.byId[txId];
          if (hasFlipRule && isMarkedPositive) {
            valor = Math.abs(originalValor);
          } else if (hasFlipRule && !isMarkedPositive) {
            valor = -Math.abs(originalValor);
          }
          // If no flip rule, keep the original value as-is

          return {
            ...tx,
            id: txId,
            originalDescription, // Keep the original for future edits
            descripcion: description,
            banco: bankName,
            tipo_cuenta: accountType,
            categoryId,
            categoryName,
            valor,
            originalValor,
            isMarkedPositive,
            isPositiveGlobal,
            isMarkedIgnored,
            isIgnoredGlobal,
            ignored: isMarkedIgnored
          };
        });

        allTransactions = [...allTransactions, ...transactionsWithSource];

        // Aggregate totals
        metaInfo.resumen.saldo_actual += data.meta_info?.resumen?.saldo_actual || 0;

        // Use earliest date as "desde"
        if (data.meta_info?.cuenta?.desde < metaInfo.cuenta.desde) {
          metaInfo.cuenta.desde = data.meta_info.cuenta.desde;
        }

        // Set name from first file found if not set
        if (metaInfo.cliente.nombre === "Cargando..." && data.meta_info?.cliente?.nombre) {
          metaInfo.cliente.nombre = data.meta_info.cliente.nombre;
        }
      } catch (err) {
        console.error(`Error reading ${file}:`, err);
      }
    });

    // Recalculate global totals based on processed transactions
    // This ensures rules (sign-flip, ignored) are reflected in the totals
    metaInfo.resumen.total_abonos = 0;
    metaInfo.resumen.total_cargos = 0;

    allTransactions.forEach(tx => {
      // Adjust balance based on changes or ignores
      const delta = (tx.ignored ? 0 : tx.valor) - tx.originalValor;
      metaInfo.resumen.saldo_actual += delta;

      if (!tx.ignored) {
        const isCredit = tx.tipo_cuenta === 'credit';
        if (isCredit) {
          if (tx.valor < 0) {
            metaInfo.resumen.total_cargos += Math.abs(tx.valor);
          }
        } else {
          if (tx.valor > 0) {
            metaInfo.resumen.total_abonos += tx.valor;
          } else {
            metaInfo.resumen.total_cargos += Math.abs(tx.valor);
          }
        }
      }
    });
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 md:p-8 font-sans">
      <FinancialDashboard
        transactions={allTransactions}
        metaInfo={metaInfo}
      />
    </div>
  );
}

