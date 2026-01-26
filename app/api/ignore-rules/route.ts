import { NextResponse } from "next/server";
import { RuleService } from "@/lib/services/rule.service";

export async function GET() {
  try {
    const rules = await RuleService.getIgnoreRules();
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

    if (!description && !transactionId) {
      return NextResponse.json({ error: "Missing description or transactionId" }, { status: 400 });
    }

    const rules = await RuleService.updateIgnoreRule({
      description,
      transactionId,
      isIgnored,
      applyGlobally
    });

    return NextResponse.json({ success: true, rules });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update ignore rules" }, { status: 500 });
  }
}
