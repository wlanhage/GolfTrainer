import assert from 'node:assert/strict';
import test from 'node:test';
import { loginSchema, refreshSchema, registerSchema } from './auth.schema.js';

test('registerSchema accepts valid payload', () => {
  const parsed = registerSchema.safeParse({
    email: 'player@example.com',
    password: 'supersecure123',
    displayName: 'Golf Player'
  });

  assert.equal(parsed.success, true);
});

test('registerSchema rejects invalid payload', () => {
  const parsed = registerSchema.safeParse({
    email: 'not-an-email',
    password: 'short',
    displayName: 'A'
  });

  assert.equal(parsed.success, false);
});

test('loginSchema enforces password length', () => {
  const parsed = loginSchema.safeParse({
    email: 'player@example.com',
    password: '1234567'
  });

  assert.equal(parsed.success, false);
});

test('refreshSchema requires long-enough token', () => {
  const parsed = refreshSchema.safeParse({
    refreshToken: 'too-short-token'
  });

  assert.equal(parsed.success, false);
});
