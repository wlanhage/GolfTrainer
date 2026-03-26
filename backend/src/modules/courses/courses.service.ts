import { HoleLayoutMappingStatus } from '@prisma/client';
import { NotFoundError } from '../../common/errors/AppError.js';
import { coursesRepository } from './courses.repository.js';

type GeoPoint = { lat: number; lng: number };

type HoleLayoutGeometry = {
  teePoint: GeoPoint | null;
  greenPolygon: GeoPoint[];
  fairwayPolygon: GeoPoint[];
  bunkerPolygons: GeoPoint[][];
  treesPolygons: GeoPoint[][];
  obPolygons: GeoPoint[][];
};

const toMobileStatus = (status: HoleLayoutMappingStatus): 'not_started' | 'partial' | 'required_complete' | 'full' => {
  if (status === 'PARTIAL') return 'partial';
  if (status === 'REQUIRED_COMPLETE') return 'required_complete';
  if (status === 'FULL') return 'full';
  return 'not_started';
};

const fromGeometryStatus = (geometry: HoleLayoutGeometry): HoleLayoutMappingStatus => {
  const hasTee = Boolean(geometry.teePoint);
  const hasGreen = geometry.greenPolygon.length > 2;
  if (!hasTee && !hasGreen) return 'NOT_STARTED';
  if (!hasTee || !hasGreen) return 'PARTIAL';
  return 'REQUIRED_COMPLETE';
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineMeters = (origin: GeoPoint, target: GeoPoint) => {
  const earthRadius = 6371000;
  const latDelta = toRadians(target.lat - origin.lat);
  const lngDelta = toRadians(target.lng - origin.lng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(origin.lat)) * Math.cos(toRadians(target.lat)) * Math.sin(lngDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const resolveGreenCenter = (greenPolygon: GeoPoint[]): GeoPoint | null => {
  if (greenPolygon.length === 0) return null;
  const sum = greenPolygon.reduce((acc, item) => ({ lat: acc.lat + item.lat, lng: acc.lng + item.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / greenPolygon.length, lng: sum.lng / greenPolygon.length };
};

const resolveBearing = (origin: GeoPoint, target: GeoPoint): number => {
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(target.lat);
  const lngDelta = toRadians(target.lng - origin.lng);
  const y = Math.sin(lngDelta) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lngDelta);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
};

const mapCourse = (course: any) => ({
  id: course.id,
  clubName: course.clubName,
  courseName: course.courseName,
  teeName: course.teeName,
  holeCount: course.holeCount,
  createdAt: course.createdAt,
  updatedAt: course.updatedAt,
  source: String(course.source).toLowerCase(),
  isDraft: course.isDraft,
  localOnly: course.localOnly,
  syncStatus: String(course.syncStatus).toLowerCase()
});

const mapHoleWithLayout = (hole: any) => {
  const geometry = {
    teePoint: (hole.holeLayout?.teePoint as GeoPoint | null) ?? null,
    greenPolygon: (hole.holeLayout?.greenPolygon as GeoPoint[]) ?? [],
    fairwayPolygon: (hole.holeLayout?.fairwayPolygon as GeoPoint[]) ?? [],
    bunkerPolygons: (hole.holeLayout?.bunkerPolygons as GeoPoint[][]) ?? [],
    treesPolygons: (hole.holeLayout?.treesPolygons as GeoPoint[][]) ?? [],
    obPolygons: (hole.holeLayout?.obPolygons as GeoPoint[][]) ?? []
  };

  return {
    id: hole.id,
    courseId: hole.courseId,
    holeNumber: hole.holeNumber,
    par: hole.par,
    length: hole.length,
    hcpIndex: hole.hcpIndex,
    createdAt: hole.createdAt,
    updatedAt: hole.updatedAt,
    layout: {
      id: hole.holeLayout?.id ?? null,
      holeId: hole.id,
      geometry,
      mappingStatus: toMobileStatus(hole.holeLayout?.mappingStatus ?? 'NOT_STARTED'),
      layout_status: toMobileStatus(hole.holeLayout?.layoutStatus ?? 'NOT_STARTED'),
      derived: {
        hole_bearing: hole.holeLayout?.holeBearing ? Number(hole.holeLayout.holeBearing) : null,
        hole_length_meters: hole.holeLayout?.holeLengthMeters ? Number(hole.holeLayout.holeLengthMeters) : null,
        tee_to_green_centerline: (hole.holeLayout?.teeToGreenCenterline as GeoPoint[]) ?? []
      },
      createdAt: hole.holeLayout?.createdAt ?? hole.createdAt,
      updatedAt: hole.holeLayout?.updatedAt ?? hole.updatedAt
    }
  };
};

export const coursesService = {
  async list(search?: string) {
    const rows = await coursesRepository.list({ search });
    return rows.map((course) => ({
      ...mapCourse(course),
      holes: course.holes.map((hole: any) => ({
        id: hole.id,
        courseId: hole.courseId,
        holeNumber: hole.holeNumber,
        par: hole.par,
        length: hole.length,
        hcpIndex: hole.hcpIndex,
        createdAt: hole.createdAt,
        updatedAt: hole.updatedAt
      }))
    }));
  },

  async getById(id: string) {
    const course = await coursesRepository.getById(id);
    if (!course) throw new NotFoundError('Course not found');

    return {
      ...mapCourse(course),
      holes: course.holes.map(mapHoleWithLayout)
    };
  },

  create(userId: string, input: { clubName: string; courseName: string; teeName?: string | null; holeCount: 9 | 18; isDraft?: boolean }) {
    return coursesRepository.create(userId, input);
  },

  async update(id: string, input: { clubName?: string; courseName?: string; teeName?: string | null; holeCount?: 9 | 18; isDraft?: boolean }) {
    const result = await coursesRepository.update(id, input);
    if (result.count === 0) throw new NotFoundError('Course not found');
    return this.getById(id);
  },

  async remove(id: string) {
    const result = await coursesRepository.delete(id);
    if (result.count === 0) throw new NotFoundError('Course not found');
  },

  async ensureHoles(id: string, holeCount: 9 | 18) {
    const course = await coursesRepository.getById(id);
    if (!course) throw new NotFoundError('Course not found');
    const holes = await coursesRepository.ensureHoles(id, holeCount);
    return holes;
  },

  async updateHoleMeta(id: string, holeNumber: number, input: { par?: number | null; length?: number | null; hcpIndex?: number | null }) {
    const hole = await coursesRepository.getHoleByNumber(id, holeNumber);
    if (!hole) throw new NotFoundError('Hole not found');

    const result = await coursesRepository.updateHoleMeta(hole.id, input);
    if (result.count === 0) throw new NotFoundError('Hole not found');

    const refreshed = await coursesRepository.getHoleByNumber(id, holeNumber);
    if (!refreshed) throw new NotFoundError('Hole not found');
    return refreshed;
  },

  async updateHoleLayout(id: string, holeNumber: number, geometry: HoleLayoutGeometry) {
    const hole = await coursesRepository.getHoleByNumber(id, holeNumber);
    if (!hole) throw new NotFoundError('Hole not found');

    const status = fromGeometryStatus(geometry);
    const greenCenter = resolveGreenCenter(geometry.greenPolygon);
    const bearing = geometry.teePoint && greenCenter ? resolveBearing(geometry.teePoint, greenCenter) : null;
    const length = geometry.teePoint && greenCenter ? haversineMeters(geometry.teePoint, greenCenter) : null;
    const centerline = geometry.teePoint && greenCenter ? [geometry.teePoint, greenCenter] : [];

    return coursesRepository.updateHoleLayout(hole.id, {
      teePoint: geometry.teePoint,
      greenPolygon: geometry.greenPolygon,
      fairwayPolygon: geometry.fairwayPolygon,
      bunkerPolygons: geometry.bunkerPolygons,
      treesPolygons: geometry.treesPolygons,
      obPolygons: geometry.obPolygons,
      holeBearing: bearing,
      holeLengthMeters: length,
      teeToGreenCenterline: centerline,
      mappingStatus: status
    });
  }
};
