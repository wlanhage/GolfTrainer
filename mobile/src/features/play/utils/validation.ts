import { CreateCourseInput } from '../types/play';

export const validateCourseInput = (input: CreateCourseInput): string | null => {
  if (!input.clubName.trim()) return 'Klubbnamn krävs.';
  if (!input.courseName.trim()) return 'Banans namn krävs.';
  if (input.holeCount !== 9 && input.holeCount !== 18) return 'Antal hål måste vara 9 eller 18.';
  return null;
};

export const validateHoleMetaValues = (input: {
  par?: number | null;
  length?: number | null;
  hcpIndex?: number | null;
}): string | null => {
  if (input.par !== undefined && input.par !== null && (!Number.isInteger(input.par) || input.par <= 0)) {
    return 'Par måste vara ett positivt heltal.';
  }

  if (input.length !== undefined && input.length !== null && input.length <= 0) {
    return 'Längd måste vara större än 0.';
  }

  if (
    input.hcpIndex !== undefined &&
    input.hcpIndex !== null &&
    (!Number.isInteger(input.hcpIndex) || input.hcpIndex < 1 || input.hcpIndex > 18)
  ) {
    return 'HCP-index måste vara mellan 1 och 18.';
  }

  return null;
};

export const parseOptionalPositiveNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return numericValue;
};

export const parseOptionalHcpIndex = (value: string): number | null => {
  if (!value.trim()) return null;
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 18) return null;
  return numericValue;
};

export const parseStrokes = (value: string): number | null => {
  if (!value.trim()) return null;
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue < 0) return null;
  return numericValue;
};
