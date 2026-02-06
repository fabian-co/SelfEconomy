import { NextResponse } from 'next/server';
import { CategoryService } from '@/lib/services/category.service';
import { createHandler } from '@/lib/api-handler';
import { createCategorySchema, updateCategorySchema } from '@/lib/validators/category.schema';

export const GET = createHandler(async () => {
  const categories = await CategoryService.getAllCategories();
  return NextResponse.json(categories);
});

export const POST = createHandler(async (req: Request) => {
  const body = await req.json();
  const validatedData = createCategorySchema.parse(body);
  const newCategory = await CategoryService.addCustomCategory(validatedData);
  return NextResponse.json(newCategory);
});

export const PUT = createHandler(async (req: Request) => {
  const body = await req.json();
  const validatedData = updateCategorySchema.parse(body);
  const updated = await CategoryService.updateCustomCategory(validatedData);
  return NextResponse.json(updated);
});

export const DELETE = createHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    throw new Error('ID is required'); // Will be caught by generic handler, or we can throw AppError
  }

  // Better to use AppError explicitly if we want 400, but the service throws 404 if not found
  // The service might not throw for missing ID if we don't check here, but the service check exists.
  // Actually, let's let the service handle it or check here.
  // Service has: if (!filtered.length === categories.length) throw new AppError('Category not found', 404);

  await CategoryService.deleteCustomCategory(id);
  return NextResponse.json({ message: 'Category deleted successfully' });
});

