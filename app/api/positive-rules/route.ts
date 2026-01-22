import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const RULES_PATH = path.join(process.cwd(), "custom-data/rules/positive-rules.json");
const RULES_DIR = path.join(process.cwd(), "custom-data/rules");

interface PositiveRules {
  byDescription: Record<string, { isPositive: boolean; lastUpdated: string }>;
  byId: Record<string, { isPositive: boolean; lastUpdated: string }>;
}

function getRules(): PositiveRules {
  if (!fs.existsSync(RULES_DIR)) {
    fs.mkdirSync(RULES_DIR, { recursive: true });
  }
  if (!fs.existsSync(RULES_PATH)) {
    const initial: PositiveRules = { byDescription: {}, byId: {} };
    fs.writeFileSync(RULES_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  const content = fs.readFileSync(RULES_PATH, "utf-8");
  return JSON.parse(content);
}

export async function GET() {
  try {
    const rules = getRules();
    return NextResponse.json(rules);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch positive rules" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { description, transactionId, isPositive, applyGlobally } = body;

    if (isPositive === undefined) {
      return NextResponse.json({ error: "Missing isPositive field" }, { status: 400 });
    }

    const rules = getRules();
    const timestamp = new Date().toISOString();

    if (applyGlobally && description) {
      // Apply to all transactions with this description
      if (isPositive) {
        rules.byDescription[description] = { isPositive: true, lastUpdated: timestamp };
      } else {
        delete rules.byDescription[description];
      }
    } else if (transactionId) {
      // Apply only to this specific transaction
      if (isPositive) {
        rules.byId[transactionId] = { isPositive: true, lastUpdated: timestamp };
      } else {
        delete rules.byId[transactionId];
      }
    } else {
      return NextResponse.json({ error: "Missing description or transactionId" }, { status: 400 });
    }

    fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2));

    return NextResponse.json({ success: true, rules });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update positive rules" }, { status: 500 });
  }
}
