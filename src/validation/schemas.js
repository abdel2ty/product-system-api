import { z } from 'zod';

const trimmed = (max) => z.string().trim().max(max);
const optionalText = (max) => trimmed(max).optional().default('');

const imageUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === '' || /^https:\/\/\S+$/i.test(v), 'Image links must start with https://')
  .optional()
  .default('');

export const productInput = z.object({
  myProductCode: trimmed(40).min(1, 'A product code is required.'),
  supplierProductCode: optionalText(60),
  name: trimmed(200).min(1, 'A product name is required.'),
  categoryId: trimmed(40).min(1, 'Choose a category.'),
  supplierId: trimmed(40).min(1, 'Choose a supplier.'),
  type: optionalText(120),
  description: optionalText(4000),
  specifications: optionalText(4000),
  warrantyMonths: z.coerce.number().int().min(0).max(240).default(0),
  warrantyNote: optionalText(200),
  supplierPrice: z.coerce.number().min(0).max(10_000_000).nullable().optional(),
  sellingPrice: z.coerce.number().min(0).max(10_000_000).nullable().optional(),
  currency: optionalText(8),
  supplierImageUrl: imageUrl,
  myImageUrl: imageUrl,
  notes: optionalText(2000),
  status: z.enum(['active', 'archived']).default('active'),
  allowDuplicateSupplierCode: z.boolean().optional().default(false),
});

export const productUpdate = productInput.partial().extend({
  allowDuplicateSupplierCode: z.boolean().optional().default(false),
});

export const supplierInput = z.object({
  name: trimmed(120).min(1, 'A supplier name is required.'),
  description: optionalText(300),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const categoryInput = z.object({
  name: trimmed(80).min(1, 'A category name is required.'),
  code: trimmed(6)
    .min(1, 'A short code is required.')
    .regex(/^[A-Za-z]{1,6}$/, 'Use 1-6 letters, e.g. CH.'),
  description: optionalText(300),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const loginInput = z.object({
  username: trimmed(32).min(3),
  password: z.string().min(8).max(200),
});

export const changePasswordInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10, 'Use at least 10 characters.').max(200),
});

export const settingsInput = z.object({
  defaultCurrency: optionalText(8),
  defaultWarrantyMonths: z.coerce.number().int().min(0).max(240).optional(),
  codePrefix: optionalText(12),
  tableDensity: z.enum(['comfortable', 'compact']).optional(),
  pageSize: z.coerce.number().int().min(10).max(200).optional(),
});
