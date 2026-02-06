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

    // Helper to get all files recursively
    const getAllFiles = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          results = results.concat(getAllFiles(filePath));
        } else if (file.endsWith('.json')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const allFiles = getAllFiles(PROCESSED_DIR);
    let found = false;
    let updatedFile = '';

    for (const filePath of allFiles) {
      if (!filePath.endsWith('.json')) continue;

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
        updatedFile = path.basename(filePath);
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
