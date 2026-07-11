import { ConflictError, NotFoundError } from '../../common/errors/AppError.js';
import { coursesRepository } from './courses.repository.js';
import { mapHoleWithLayout } from './courses.service.js';
import { greenCandidatesRepository } from './greenCandidates.repository.js';

type GeoPoint = { lat: number; lng: number };

export const greenCandidatesService = {
  async listOpen(courseId: string) {
    const course: any = await coursesRepository.getById(courseId);
    if (!course) throw new NotFoundError('Course not found');
    const greenByHole = new Map<number, boolean>();
    for (const h of course.holes ?? []) {
      const g = (h.holeLayout?.greenPolygon as GeoPoint[] | null) ?? [];
      greenByHole.set(h.holeNumber, g.length >= 3);
    }
    const open = await greenCandidatesRepository.listOpenForCourse(courseId);
    return open
      .filter((c: any) => (c.forHoles as number[]).some((n) => !greenByHole.get(n)))
      .map((c: any) => ({ id: c.id, polygon: c.polygon, forHoles: c.forHoles }));
  },

  async confirm(courseId: string, holeNumber: number, candidateId: string, userId: string) {
    const course: any = await coursesRepository.getById(courseId);
    if (!course) throw new NotFoundError('Course not found');
    try {
      await greenCandidatesRepository.confirmGreen({ courseId, holeNumber, candidateId, userId });
    } catch (e: any) {
      if (e?.code === 'candidate-not-found' || e?.code === 'hole-not-found') throw new NotFoundError('Not found');
      if (e?.code === 'already-assigned' || e?.code === 'candidate-taken' || e?.code === 'not-a-candidate') {
        throw new ConflictError(e.code);
      }
      throw e;
    }
    const hole = await coursesRepository.getHoleWithLayout(courseId, holeNumber);
    if (!hole) throw new NotFoundError('Hole not found');
    return mapHoleWithLayout(hole);
  }
};
