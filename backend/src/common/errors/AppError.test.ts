import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError, BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from './AppError.js';

test('AppError preserves code, statusCode and message', () => {
  const error = new AppError('CUSTOM', 418, 'teapot');

  assert.equal(error.code, 'CUSTOM');
  assert.equal(error.statusCode, 418);
  assert.equal(error.message, 'teapot');
});

test('UnauthorizedError defaults to UNAUTHORIZED and 401', () => {
  const error = new UnauthorizedError();

  assert.equal(error.code, 'UNAUTHORIZED');
  assert.equal(error.statusCode, 401);
  assert.equal(error.message, 'Unauthorized');
});

test('domain errors map to expected status codes', () => {
  assert.equal(new ConflictError('dup').statusCode, 409);
  assert.equal(new NotFoundError('missing').statusCode, 404);
  assert.equal(new BadRequestError('invalid').statusCode, 400);
});
