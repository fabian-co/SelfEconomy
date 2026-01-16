import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const RULES_PATH = path.join(process.cwd(), "constants/category-rules.json");

function getRules() {
  if (!fs.existsSync(RULES_PATH)) {
    fs.writeFileSync(RULES_PATH, JSON.stringify({}));
  }
  const content = fs.readFileSync(RULES_PATH, "utf-8");
  return JSON.parse(content);
}

export async function GET() {
  try {
    const rules = getRules();
    return NextResponse.json(rules);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { originalDescription, description, categoryId, categoryName } = body;

    if (!originalDescription || !categoryId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const rules = getRules();

    // Key by the original bank description
    rules[originalDescription] = {
      title: description, // The user-friendly name
      categoryId,
      categoryName,
      lastUpdated: new Date().toISOString()
    };

    fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2));

    return NextResponse.json({ success: true, rules });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update rules" }, { status: 500 });
  }
}
