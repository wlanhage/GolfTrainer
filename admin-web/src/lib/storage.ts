import { api } from './api';
import { Course, HoleLayoutGeometry } from './types';

type ApiCourse = {
  id: string;
  clubName: string;
  courseName: string;
  teeName: string | null;
  holeCount: 9 | 18;
  holes: Array<{
    id: string;
    holeNumber: number;
    par: number | null;
    length: number | null;
    hcpIndex: number | null;
    layout?: {
      geometry: HoleLayoutGeometry;
    } | null;
  }>;
};

const emptyLayout = (): HoleLayoutGeometry => ({
  teePoint: null,
  greenPolygon: [],
  fairwayPolygon: [],
  bunkerPolygons: [],
  treesPolygons: [],
  obPolygons: []
});

const toCourse = (course: ApiCourse): Course => ({
  id: course.id,
  clubName: course.clubName,
  courseName: course.courseName,
  teeName: course.teeName ?? '',
  holeCount: course.holeCount,
  holes: (course.holes ?? [])
    .sort((a, b) => a.holeNumber - b.holeNumber)
    .map((hole) => ({
      id: hole.id,
      holeNumber: hole.holeNumber,
      par: hole.par,
      length: hole.length,
      hcpIndex: hole.hcpIndex,
      layout: hole.layout?.geometry ?? emptyLayout()
    }))
});

export const courseRepo = {
  async list(search = ''): Promise<Course[]> {
    const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
    const rows = await api.request<ApiCourse[]>(`/courses${query}`);
    return rows.map(toCourse);
  },

  async find(courseId: string): Promise<Course | null> {
    try {
      const row = await api.request<ApiCourse>(`/courses/${courseId}`);
      return toCourse(row);
    } catch {
      return null;
    }
  },

  async create(input: { clubName: string; courseName: string; teeName: string; holeCount: 9 | 18 }) {
    const created = await api.request<ApiCourse>('/courses', {
      method: 'POST',
      body: JSON.stringify(input)
    });

    await api.request(`/courses/${created.id}/holes`, {
      method: 'POST',
      body: JSON.stringify({ holeCount: input.holeCount })
    });

    return this.find(created.id) as Promise<Course>;
  },

  async update(courseId: string, patch: Partial<Omit<Course, 'id' | 'holes'>>) {
    const payload = {
      ...(patch.clubName !== undefined ? { clubName: patch.clubName } : {}),
      ...(patch.courseName !== undefined ? { courseName: patch.courseName } : {}),
      ...(patch.teeName !== undefined ? { teeName: patch.teeName } : {}),
      ...(patch.holeCount !== undefined ? { holeCount: patch.holeCount } : {})
    };

    if (Object.keys(payload).length > 0) {
      await api.request(`/courses/${courseId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    }

    return this.find(courseId);
  },

  async remove(courseId: string) {
    await api.request(`/courses/${courseId}`, { method: 'DELETE' });
    return this.list();
  },

  async updateHole(courseId: string, holeNumber: number, patch: Partial<Course['holes'][number]>) {
    const holeMetaPayload = {
      ...(patch.par !== undefined ? { par: patch.par } : {}),
      ...(patch.length !== undefined ? { length: patch.length } : {}),
      ...(patch.hcpIndex !== undefined ? { hcpIndex: patch.hcpIndex } : {})
    };

    if (Object.keys(holeMetaPayload).length > 0) {
      await api.request(`/courses/${courseId}/holes/${holeNumber}`, {
        method: 'PATCH',
        body: JSON.stringify(holeMetaPayload)
      });
    }

    if (patch.layout) {
      await api.request(`/courses/${courseId}/holes/${holeNumber}/layout`, {
        method: 'PATCH',
        body: JSON.stringify({ geometry: patch.layout })
      });
    }

    return this.find(courseId);
  },

  async saveAll(courses: Course[]) {
    for (const course of courses) {
      const created = await this.create({
        clubName: course.clubName,
        courseName: course.courseName,
        teeName: course.teeName,
        holeCount: course.holeCount
      });

      for (const hole of course.holes) {
        await this.updateHole(created.id, hole.holeNumber, {
          par: hole.par,
          length: hole.length,
          hcpIndex: hole.hcpIndex,
          layout: hole.layout
        });
      }
    }
  }
};
