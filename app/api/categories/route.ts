import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CATEGORIES_PATH = path.join(process.cwd(), 'constants', 'categories.json');

export async function GET() {
  try {
    if (!fs.existsSync(CATEGORIES_PATH)) {
      return NextResponse.json([], { status: 200 });
    }
    const content = fs.readFileSync(CATEGORIES_PATH, 'utf8');
    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read categories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const newCategory = await request.json();

    if (!newCategory.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    let categories = [];
    if (fs.existsSync(CATEGORIES_PATH)) {
      const content = fs.readFileSync(CATEGORIES_PATH, 'utf8');
      categories = JSON.parse(content);
    }

    // Generate ID from name if not provided
    const id = newCategory.id || newCategory.name.toLowerCase().replace(/\s+/g, '_');

    const categoryToAdd = {
      id,
      name: newCategory.name,
      icon: newCategory.icon || 'Tag',
    };

    categories.push(categoryToAdd);
    fs.writeFileSync(CATEGORIES_PATH, JSON.stringify(categories, null, 2));

    return NextResponse.json(categoryToAdd);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add category' }, { status: 500 });
  }
}
