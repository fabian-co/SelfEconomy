import { NextResponse } from "next/server";
import { RuleService } from "@/lib/services/rule.service";

export async function GET() {
  try {
    const rules = await RuleService.getCategoryRules();
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

    const rules = await RuleService.updateCategoryRule({
      originalDescription,
      description,
      categoryId,
      categoryName
    });

    return NextResponse.json({ success: true, rules });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update rules" }, { status: 500 });
  }
}
