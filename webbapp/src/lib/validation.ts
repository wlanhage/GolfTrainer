import type { CreateCourseInput } from './types';

export const validateCourseInput = (input: CreateCourseInput): string | null => {
  if (!input.clubName.trim()) return 'Klubbnamn krävs.';
  if (!input.courseName.trim()) return 'Banans namn krävs.';
  if (input.holeCount !== 9 && input.holeCount !== 18) return 'Antal hål måste vara 9 eller 18.';
  return null;
};

export const parseOptionalPositiveNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
};

export const parseOptionalHcpIndex = (value: string): number | null => {
  if (!value.trim()) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 18) return null;
  return n;
};

export const parseStrokes = (value: string): number | null => {
  if (!value.trim()) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
};
