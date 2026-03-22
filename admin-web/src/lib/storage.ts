import { Course, HoleLayoutGeometry } from './types';

const COURSE_KEY = 'gt_admin_courses_v1';

const emptyLayout = (): HoleLayoutGeometry => ({
  teePoint: null,
  greenPolygon: [],
  fairwayPolygon: [],
  bunkerPolygons: [],
  treesPolygons: [],
  obPolygons: []
});

const createHole = (holeNumber: number) => ({
  id: `${holeNumber}_${Math.random().toString(36).slice(2, 10)}`,
  holeNumber,
  par: null,
  length: null,
  hcpIndex: null,
  layout: emptyLayout()
});

export const courseRepo = {
  list(): Course[] {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(COURSE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as Course[];
    } catch {
      return [];
    }
  },
  saveAll(courses: Course[]) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(COURSE_KEY, JSON.stringify(courses));
  },
  create(input: { clubName: string; courseName: string; teeName: string; holeCount: 9 | 18 }) {
    const courses = this.list();
    const course: Course = {
      id: `course_${Math.random().toString(36).slice(2, 10)}`,
      ...input,
      holes: Array.from({ length: input.holeCount }, (_, idx) => createHole(idx + 1))
    };
    this.saveAll([course, ...courses]);
    return course;
  },
  update(courseId: string, patch: Partial<Omit<Course, 'id' | 'holes'>>) {
    const updated = this.list().map((course) => (course.id === courseId ? { ...course, ...patch } : course));
    this.saveAll(updated);
    return updated.find((course) => course.id === courseId) ?? null;
  },
  find(courseId: string) {
    return this.list().find((course) => course.id === courseId) ?? null;
  },
  updateHole(courseId: string, holeNumber: number, patch: Partial<Course['holes'][number]>) {
    const courses = this.list();
    const updated = courses.map((course) => {
      if (course.id !== courseId) return course;
      return {
        ...course,
        holes: course.holes.map((hole) => (hole.holeNumber === holeNumber ? { ...hole, ...patch } : hole))
      };
    });
    this.saveAll(updated);
    return updated.find((course) => course.id === courseId) ?? null;
  }
};
