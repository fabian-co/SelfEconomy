import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const RULES_PATH = path.join(process.cwd(), "custom-data/rules/ignore-rules.json");
const RULES_DIR = path.join(process.cwd(), "custom-data/rules");

interface IgnoreRules {
  byDescription: Record<string, { isIgnored: boolean; lastUpdated: string }>;
  byId: Record<string, { isIgnored: boolean; lastUpdated: string }>;
}

function getRules(): IgnoreRules {
  if (!fs.existsSync(RULES_DIR)) {
    fs.mkdirSync(RULES_DIR, { recursive: true });
  }
  if (!fs.existsSync(RULES_PATH)) {
    const initial: IgnoreRules = { byDescription: {}, byId: {} };
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
    return NextResponse.json({ error: "Failed to fetch ignore rules" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { description, transactionId, isIgnored, applyGlobally } = body;

    if (isIgnored === undefined) {
      return NextResponse.json({ error: "Missing isIgnored field" }, { status: 400 });
    }

    const rules = getRules();
    const timestamp = new Date().toISOString();

    if (applyGlobally && description) {
      if (isIgnored) {
        rules.byDescription[description] = { isIgnored: true, lastUpdated: timestamp };
        // Cleanup specific ID rule if it exists for this description
        if (transactionId) {
          delete rules.byId[transactionId];
        }
      } else {
        delete rules.byDescription[description];
      }
    } else if (transactionId) {
      if (isIgnored) {
        rules.byId[transactionId] = { isIgnored: true, lastUpdated: timestamp };
        // Cleanup global rule for this description
        if (description) {
          delete rules.byDescription[description];
        }
      } else {
        delete rules.byId[transactionId];
      }
    } else {
      return NextResponse.json({ error: "Missing description or transactionId" }, { status: 400 });
    }

    fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2));

    return NextResponse.json({ success: true, rules });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update ignore rules" }, { status: 500 });
  }
}
