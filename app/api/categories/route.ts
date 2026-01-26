import { NextResponse } from 'next/server';
import { CategoryService } from '@/lib/services/category.service';

export async function GET() {
  try {
    const categories = await CategoryService.getAllCategories();
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read categories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newCategory = await CategoryService.addCustomCategory(body);
    return NextResponse.json(newCategory);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to add category' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const updated = await CategoryService.updateCustomCategory(body);
    return NextResponse.json(updated);
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: error.message || 'Failed to update category' }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await CategoryService.deleteCustomCategory(id);
    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: error.message || 'Failed to delete category' }, { status });
  }
}
