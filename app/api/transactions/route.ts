import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PROCESSED_DIR = path.join(process.cwd(), 'app/api/extracto/processed');

export async function PUT(request: NextRequest) {
  try {
    const { transactionId, newDescription } = await request.json();

    if (!transactionId || !newDescription) {
      return NextResponse.json(
        { error: 'Missing transactionId or newDescription' },
        { status: 400 }
      );
    }

    // Search for the transaction in all processed JSON files
    const files = fs.readdirSync(PROCESSED_DIR).filter(f => f.endsWith('.json'));
    let found = false;
    let updatedFile = '';

    for (const file of files) {
      const filePath = path.join(PROCESSED_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (!data.transacciones) continue;

      const txIndex = data.transacciones.findIndex((tx: any) => tx.id === transactionId);

      if (txIndex !== -1) {
        // Store original description if not already stored
        if (!data.transacciones[txIndex].originalDescription) {
          data.transacciones[txIndex].originalDescription = data.transacciones[txIndex].descripcion;
        }

        // Update the description
        data.transacciones[txIndex].descripcion = newDescription;

        // Write back to file
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

        found = true;
        updatedFile = file;
        break;
      }
    }

    if (!found) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Description updated in ${updatedFile}`,
      transactionId,
      newDescription
    });
  } catch (error: any) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update transaction' },
      { status: 500 }
    );
  }
}
