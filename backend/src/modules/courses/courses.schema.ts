import { z } from 'zod';

const holeCountSchema = z.union([z.literal(9), z.literal(18)]);

const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

const polygonSchema = z.array(geoPointSchema);

export const holeLayoutGeometrySchema = z.object({
  teePoint: geoPointSchema.nullable(),
  greenPolygon: polygonSchema,
  fairwayPolygon: polygonSchema,
  bunkerPolygons: z.array(polygonSchema),
  treesPolygons: z.array(polygonSchema),
  obPolygons: z.array(polygonSchema)
});

export const listCoursesQuerySchema = z.object({
  search: z.string().optional()
});

export const courseIdParamSchema = z.object({
  id: z.string().cuid()
});

export const holeParamsSchema = z.object({
  id: z.string().cuid(),
  holeNumber: z.coerce.number().int().min(1).max(18)
});

export const createCourseSchema = z.object({
  clubName: z.string().min(2).max(120),
  courseName: z.string().min(2).max(120),
  teeName: z.string().min(1).max(120).nullable().optional(),
  holeCount: holeCountSchema,
  isDraft: z.boolean().optional()
});

export const updateCourseSchema = createCourseSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'At least one field must be provided'
});

export const ensureHolesSchema = z.object({
  holeCount: holeCountSchema
});

export const updateHoleMetaSchema = z
  .object({
    par: z.number().int().min(1).max(10).nullable().optional(),
    length: z.number().int().min(1).max(1500).nullable().optional(),
    hcpIndex: z.number().int().min(1).max(18).nullable().optional()
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });

export const updateHoleLayoutSchema = z.object({
  geometry: holeLayoutGeometrySchema
});
