import { z } from 'zod';

export const clubIdParamSchema = z.object({ clubId: z.string().cuid() });

export const createClubSchema = z.object({
  clubCatalogId: z.string().cuid().optional(),
  label: z.string().min(1).max(40),
  isActive: z.boolean().optional()
});

export const updateClubSchema = createClubSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'At least one field must be provided'
});
