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
      color: newCategory.color || '#3f3f46',
    };

    categories.push(categoryToAdd);
    fs.writeFileSync(CATEGORIES_PATH, JSON.stringify(categories, null, 2));

    return NextResponse.json(categoryToAdd);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add category' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const updatedCategory = await request.json();
    if (!updatedCategory.id || !updatedCategory.name) {
      return NextResponse.json({ error: 'ID and Name are required' }, { status: 400 });
    }

    if (!fs.existsSync(CATEGORIES_PATH)) {
      return NextResponse.json({ error: 'Categories file not found' }, { status: 404 });
    }

    const content = fs.readFileSync(CATEGORIES_PATH, 'utf8');
    let categories = JSON.parse(content);

    const index = categories.findIndex((c: any) => c.id === updatedCategory.id);
    if (index === -1) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    categories[index] = {
      ...categories[index],
      name: updatedCategory.name,
      icon: updatedCategory.icon || categories[index].icon,
      color: updatedCategory.color || categories[index].color
    };
    fs.writeFileSync(CATEGORIES_PATH, JSON.stringify(categories, null, 2));

    return NextResponse.json(categories[index]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    if (!fs.existsSync(CATEGORIES_PATH)) {
      return NextResponse.json({ error: 'Categories file not found' }, { status: 404 });
    }

    const content = fs.readFileSync(CATEGORIES_PATH, 'utf8');
    let categories = JSON.parse(content);

    const filteredCategories = categories.filter((c: any) => c.id !== id);
    if (categories.length === filteredCategories.length) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    fs.writeFileSync(CATEGORIES_PATH, JSON.stringify(filteredCategories, null, 2));

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
