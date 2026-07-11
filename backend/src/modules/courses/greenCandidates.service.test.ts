import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictError, NotFoundError } from '../../common/errors/AppError.js';
import { greenCandidatesRepository } from './greenCandidates.repository.js';
import { coursesRepository } from './courses.repository.js';
import { greenCandidatesService } from './greenCandidates.service.js';

const gcRepo = greenCandidatesRepository as any;
const cRepo = coursesRepository as any;

test('list filters out candidates whose every hole already has a green', async () => {
  const origList = gcRepo.listOpenForCourse;
  const origCourse = cRepo.getById;
  gcRepo.listOpenForCourse = async () => [
    { id: 'a', polygon: [1], forHoles: [3, 5] },
    { id: 'b', polygon: [1], forHoles: [8] }
  ];
  // hole 8 already resolved, holes 3 & 5 not
  cRepo.getById = async () => ({ holes: [
    { holeNumber: 3, holeLayout: { greenPolygon: [] } },
    { holeNumber: 5, holeLayout: null },
    { holeNumber: 8, holeLayout: { greenPolygon: [{},{},{}] } }
  ]});
  const out = await greenCandidatesService.listOpen('course-1');
  assert.deepEqual(out.map((c) => c.id), ['a']);
  assert.deepEqual(out[0], { id: 'a', polygon: [1], forHoles: [3, 5] });
  gcRepo.listOpenForCourse = origList;
  cRepo.getById = origCourse;
});

test('confirm maps repo conflict codes to typed errors', async () => {
  const orig = gcRepo.confirmGreen;
  const origCourse = cRepo.getById;
  cRepo.getById = async () => ({ id: 'course-1' });
  for (const [code, Err] of [
    ['already-assigned', ConflictError],
    ['candidate-taken', ConflictError],
    ['not-a-candidate', ConflictError],
    ['candidate-not-found', NotFoundError],
    ['hole-not-found', NotFoundError]
  ] as const) {
    gcRepo.confirmGreen = async () => { throw { code }; };
    await assert.rejects(
      () => greenCandidatesService.confirm('course-1', 3, 'cand-1', 'user-1'),
      Err,
      `code ${code}`
    );
  }
  gcRepo.confirmGreen = orig;
  cRepo.getById = origCourse;
});

test('confirm returns the mapped hole (with layout.geometry) on success', async () => {
  const orig = gcRepo.confirmGreen;
  const origHole = cRepo.getHoleWithLayout;
  const origCourse = cRepo.getById;
  cRepo.getById = async () => ({ id: 'course-1' });
  gcRepo.confirmGreen = async () => ({ holeId: 'hole-1' });
  cRepo.getHoleWithLayout = async () => ({
    id: 'hole-1', courseId: 'course-1', holeNumber: 3, par: 4, length: 320,
    hcpIndex: 5, createdAt: new Date(), updatedAt: new Date(),
    holeLayout: { id: 'l1', greenPolygon: [{ lat: 56, lng: 12 }, { lat: 56, lng: 12.001 }, { lat: 56.001, lng: 12 }],
      teePoint: null, fairwayPolygon: null, bunkerPolygons: [], treesPolygons: [], obPolygons: [], layoutStatus: 'PARTIAL' }
  });
  const out: any = await greenCandidatesService.confirm('course-1', 3, 'cand-1', 'user-1');
  assert.equal(out.holeNumber, 3);
  assert.equal(out.layout.geometry.greenPolygon.length, 3);
  gcRepo.confirmGreen = orig;
  cRepo.getHoleWithLayout = origHole;
  cRepo.getById = origCourse;
});
