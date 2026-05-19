import { describe, expect, it } from 'vitest';
import {
  parseOptionalHcpIndex,
  parseOptionalPositiveNumber,
  parseStrokes,
  validateCourseInput
} from './validation';

describe('validateCourseInput', () => {
  it('rejects empty club name', () => {
    expect(validateCourseInput({ clubName: '', courseName: 'X', holeCount: 9 })).toBeTruthy();
  });

  it('rejects empty course name', () => {
    expect(validateCourseInput({ clubName: 'X', courseName: '', holeCount: 9 })).toBeTruthy();
  });

  it('rejects invalid hole count', () => {
    expect(validateCourseInput({ clubName: 'X', courseName: 'Y', holeCount: 12 as 9 })).toBeTruthy();
  });

  it('accepts valid input', () => {
    expect(validateCourseInput({ clubName: 'X', courseName: 'Y', holeCount: 18 })).toBeNull();
  });
});

describe('parseOptionalPositiveNumber', () => {
  it('returns null for empty', () => {
    expect(parseOptionalPositiveNumber('')).toBeNull();
    expect(parseOptionalPositiveNumber('   ')).toBeNull();
  });

  it('returns null for 0 or negative', () => {
    expect(parseOptionalPositiveNumber('0')).toBeNull();
    expect(parseOptionalPositiveNumber('-5')).toBeNull();
  });

  it('returns null for non-numbers', () => {
    expect(parseOptionalPositiveNumber('abc')).toBeNull();
  });

  it('returns parsed positive number', () => {
    expect(parseOptionalPositiveNumber('42')).toBe(42);
    expect(parseOptionalPositiveNumber('3.5')).toBe(3.5);
  });
});

describe('parseOptionalHcpIndex', () => {
  it('returns null for empty', () => {
    expect(parseOptionalHcpIndex('')).toBeNull();
  });

  it('returns null outside [1,18]', () => {
    expect(parseOptionalHcpIndex('0')).toBeNull();
    expect(parseOptionalHcpIndex('19')).toBeNull();
    expect(parseOptionalHcpIndex('1.5')).toBeNull();
  });

  it('returns parsed integer in range', () => {
    expect(parseOptionalHcpIndex('1')).toBe(1);
    expect(parseOptionalHcpIndex('18')).toBe(18);
    expect(parseOptionalHcpIndex('10')).toBe(10);
  });
});

describe('parseStrokes', () => {
  it('returns null for empty', () => {
    expect(parseStrokes('')).toBeNull();
  });

  it('returns null for negative', () => {
    expect(parseStrokes('-1')).toBeNull();
  });

  it('returns null for non-integer', () => {
    expect(parseStrokes('3.5')).toBeNull();
  });

  it('returns 0 for "0"', () => {
    expect(parseStrokes('0')).toBe(0);
  });

  it('returns integer for valid input', () => {
    expect(parseStrokes('4')).toBe(4);
    expect(parseStrokes('15')).toBe(15);
  });
});
