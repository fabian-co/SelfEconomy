import { NextResponse } from "next/server";
import { RuleService } from "@/lib/services/rule.service";

export async function GET() {
  try {
    const rules = await RuleService.getPositiveRules();
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

    if (!description && !transactionId) {
      return NextResponse.json({ error: "Missing description or transactionId" }, { status: 400 });
    }

    const rules = await RuleService.updatePositiveRule({
      description,
      transactionId,
      isPositive,
      applyGlobally
    });

    return NextResponse.json({ success: true, rules });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update positive rules" }, { status: 500 });
  }
}
