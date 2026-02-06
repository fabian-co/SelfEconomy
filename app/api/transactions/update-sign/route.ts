import { NextResponse } from "next/server";
import { TransactionService } from "@/app/api/process/services/transaction.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transactionId, isPositive, applyGlobally, bankName, description } = body;

    if (!transactionId || isPositive === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await TransactionService.updateTransactionSign({
      transactionId,
      isPositive,
      applyGlobally,
      bankName: bankName || 'other', // Default if not provided, though it should be
      description
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Error updating transaction sign:", error);
    return NextResponse.json({ error: "Failed to update transaction sign" }, { status: 500 });
  }
}
