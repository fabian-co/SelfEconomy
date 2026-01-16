import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CATEGORIES_PATH = path.join(process.cwd(), 'constants', 'categories.json');
const CUSTOM_CATEGORIES_DIR = path.join(process.cwd(), 'custom-data', 'categories');
const CUSTOM_CATEGORIES_PATH = path.join(CUSTOM_CATEGORIES_DIR, 'custom-categories.json');

function readJsonFile(filePath: string) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
    return [];
  }
}

function writeJsonFile(filePath: string, data: any) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export async function GET() {
  try {
    const defaultCategories = readJsonFile(CATEGORIES_PATH);
    const customCategories = readJsonFile(CUSTOM_CATEGORIES_PATH);

    // Combine both, but ensure custom categories take precedence or are just appended
    return NextResponse.json([...defaultCategories, ...customCategories]);
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

    const customCategories = readJsonFile(CUSTOM_CATEGORIES_PATH);

    // Generate ID from name if not provided
    const id = newCategory.id || newCategory.name.toLowerCase().replace(/\s+/g, '_');

    const categoryToAdd = {
      id,
      name: newCategory.name,
      icon: newCategory.icon || 'Tag',
      color: newCategory.color || '#3f3f46',
    };

    customCategories.push(categoryToAdd);
    writeJsonFile(CUSTOM_CATEGORIES_PATH, customCategories);

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

    // We only allow updating custom categories for now to keep defaults "immutable" via API
    // Or we check both. Let's check both for safety, but usually POST adds to custom.

    let customCategories = readJsonFile(CUSTOM_CATEGORIES_PATH);
    const customIndex = customCategories.findIndex((c: any) => c.id === updatedCategory.id);

    if (customIndex !== -1) {
      customCategories[customIndex] = {
        ...customCategories[customIndex],
        ...updatedCategory
      };
      writeJsonFile(CUSTOM_CATEGORIES_PATH, customCategories);
      return NextResponse.json(customCategories[customIndex]);
    }

    // If not in custom, maybe it's in default? (Though user wants to keep defaults separate)
    // If we want to allow "overriding" defaults, we'd need more complex logic.
    // For now, let's just error if not found in custom (since POST only goes to custom).
    return NextResponse.json({ error: 'Category not found in custom categories' }, { status: 404 });
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

    let customCategories = readJsonFile(CUSTOM_CATEGORIES_PATH);
    const filteredCategories = customCategories.filter((c: any) => c.id !== id);

    if (customCategories.length === filteredCategories.length) {
      return NextResponse.json({ error: 'Category not found in custom categories' }, { status: 404 });
    }

    writeJsonFile(CUSTOM_CATEGORIES_PATH, filteredCategories);
    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}

