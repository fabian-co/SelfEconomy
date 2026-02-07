import { NextResponse } from "next/server";
import { RuleService } from "@/lib/services/rule.service";
import fs from 'fs';
import path from 'path';

// Helper to update JSON file directly for batch to avoid read/write loop overhead of service if not optimized
// But for safety, we might want to extend the service. 
// Given the user instructions "teniendo presente como funciona category-rules para que ejerza la misma logica",
// I should respect the Service pattern if possible, or replicate its logic exactly.

// Replicating logic safely:
const RULES_BASE_DIR = path.join(process.cwd(), 'custom-data', 'rules');
const CATEGORY_RULES_PATH = path.join(RULES_BASE_DIR, 'category-rules.json');

export async function POST(request: Request) {
  try {
    const { rules } = await request.json(); // Expecting array of { originalDescription, categoryId, categoryName, title? }

    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Read current rules
    let currentRules: Record<string, any> = {};
    if (fs.existsSync(CATEGORY_RULES_PATH)) {
      currentRules = JSON.parse(fs.readFileSync(CATEGORY_RULES_PATH, 'utf8'));
    }

    const timestamp = new Date().toISOString();
    let updateCount = 0;

    // Apply updates
    rules.forEach(rule => {
      const { originalDescription, description, categoryId, categoryName } = rule;

      if (originalDescription && categoryId) {
        currentRules[originalDescription] = {
          title: description || originalDescription, // Use new description if provided, else keep original as title? No, usually we want to rename it to something clean.
          // If description is not provided, we might want to default to something.
          // BUT: The UI usually provides a clean name.
          categoryId,
          categoryName,
          lastUpdated: timestamp
        };
        updateCount++;
      }
    });

    // Write back
    // Ensure directory exists
    if (!fs.existsSync(RULES_BASE_DIR)) {
      fs.mkdirSync(RULES_BASE_DIR, { recursive: true });
    }

    fs.writeFileSync(CATEGORY_RULES_PATH, JSON.stringify(currentRules, null, 2));

    return NextResponse.json({ success: true, count: updateCount });
  } catch (error) {
    console.error("Batch rule update failed:", error);
    return NextResponse.json({ error: "Failed to update rules batch" }, { status: 500 });
  }
}
