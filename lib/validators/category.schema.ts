import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  icon: z.string().optional(),
  color: z.string().optional(),
  id: z.string().optional(), // Optional, generated if not provided
});

export const updateCategorySchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});
