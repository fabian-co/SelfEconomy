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
  const positiveRulesPath = path.join(process.cwd(), "custom-data/rules/positive-rules.json");
  const categoriesPath = path.join(process.cwd(), "constants/categories.json");
  const customCategoriesPath = path.join(process.cwd(), "custom-data/categories/custom-categories.json");
  const ignoreRulesPath = path.join(process.cwd(), "custom-data/rules/ignore-rules.json");

  let categoryRules: Record<string, any> = {};
  let positiveRules: { byDescription: Record<string, any>; byId: Record<string, any> } = { byDescription: {}, byId: {} };
  let ignoreRules: { byDescription: Record<string, any>; byId: Record<string, any> } = { byDescription: {}, byId: {} };
  let categories: any[] = [];

  if (fs.existsSync(rulesPath)) {
    categoryRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  }

  // Load positive rules
  if (fs.existsSync(positiveRulesPath)) {
    positiveRules = JSON.parse(fs.readFileSync(positiveRulesPath, 'utf8'));
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

          // Check positive rules (by description or by ID)
          let isMarkedPositive = false;
          let isPositiveGlobal = false;
          let valor = tx.valor;

          // Check if there's a positive rule by description (partial match)
          const descriptionRule = Object.keys(positiveRules.byDescription).find(
            key => originalDescription.includes(key)
          );

          if (descriptionRule && positiveRules.byDescription[descriptionRule]?.isPositive) {
            isMarkedPositive = true;
            isPositiveGlobal = true;
          } else if (positiveRules.byId[txId]?.isPositive) {
            isMarkedPositive = true;
            isPositiveGlobal = false;
          }

          // Check ignore rules (by description or by ID)
          let isMarkedIgnored = false;
          let isIgnoredGlobal = false;

          const ignoreDescriptionRule = Object.keys(ignoreRules.byDescription).find(
            key => originalDescription.includes(key)
          );

          if (ignoreDescriptionRule && ignoreRules.byDescription[ignoreDescriptionRule]?.isIgnored) {
            isMarkedIgnored = true;
            isIgnoredGlobal = true;
          } else if (ignoreRules.byId[txId]?.isIgnored) {
            isMarkedIgnored = true;
            isIgnoredGlobal = false;
          }

          // If marked as positive and value is negative, make it positive
          if (isMarkedPositive && valor < 0) {
            valor = Math.abs(valor);
          }

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
            isMarkedPositive,
            isPositiveGlobal,
            isMarkedIgnored,
            isIgnoredGlobal,
            ignored: isMarkedIgnored || tx.ignored
          };
        });

        allTransactions = [...allTransactions, ...transactionsWithSource];

        // Aggregate totals
        metaInfo.resumen.saldo_actual += data.meta_info?.resumen?.saldo_actual || 0;

        // Treat credit card "abonos" (payments to the card) differently
        if (accountType === 'credit') {
          // For credit cards, 'abonos' are payments TO the card, not income.
          // We don't add them to the global income summary as requested.
        } else {
          metaInfo.resumen.total_abonos += data.meta_info?.resumen?.total_abonos || 0;
        }

        metaInfo.resumen.total_cargos += data.meta_info?.resumen?.total_cargos || 0;

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

    // Sort all transactions by date (assuming DD/MM format and a year from context)
    // Actually, FinancialDashboard already does grouping and sorting.
    // We just need to pass the combined list.
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

