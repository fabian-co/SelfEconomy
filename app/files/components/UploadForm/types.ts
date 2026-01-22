import * as z from "zod";
import { UseFormReturn } from "react-hook-form";

export const uploadSchema = z.object({
  extractName: z.string().min(1, "El nombre del extracto es obligatorio"),
  bank: z.string().optional(),
  accountType: z.string().optional(),
  password: z.string().optional(),
  file: z.instanceof(File, { message: "El archivo es obligatorio" }),
});

export type UploadFormValues = z.infer<typeof uploadSchema>;

export type Step = 'upload' | 'configure' | 'ai_preview';

export interface Template {
  entity: string;
  account_type: string;
  transaction_regex: string;
  [key: string]: any;
}

export interface SharedStepProps {
  isUploading: boolean;
  form: UseFormReturn<UploadFormValues>;
}
