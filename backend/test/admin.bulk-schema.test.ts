import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import { bulkUserSchema } from '../src/modules/admin/admin.schemas.js';

// Validates the exact schema object registered on POST /api/admin/users/bulk
// (see admin.routes.ts) — not a re-implementation of it — with an Ajv
// instance matching Fastify's default validator options.
// `as any`: ajv's CJS type exports don't resolve cleanly under this
// project's NodeNext/ESM tsconfig (a known ajv/TS ecosystem issue) even
// though the runtime import is correct — this only relaxes the type, not
// the actual behavior under test.
const ajv = new (Ajv as any)({ allErrors: true, strict: false });
(addFormats as any)(ajv);
const validate = ajv.compile(bulkUserSchema);

function isValid(body: unknown) {
  return validate(body);
}

test('bulk schema accepts a bare delete action with no payload', () => {
  assert.equal(isValid({ ids: [1, 2], action: 'delete' }), true);
});

test('bulk schema rejects an arbitrary payload object on delete', () => {
  assert.equal(isValid({ ids: [1], action: 'delete', payload: { foo: 'bar' } }), false);
});

test('bulk schema accepts suspend/unsuspend with only an optional reason', () => {
  assert.equal(isValid({ ids: [1], action: 'suspend', reason: 'ToS violation' }), true);
  assert.equal(isValid({ ids: [1], action: 'unsuspend' }), true);
});

test('bulk schema rejects an arbitrary payload object on suspend', () => {
  assert.equal(isValid({ ids: [1], action: 'suspend', payload: { status: 'banned' } }), false);
});

test('bulk schema requires payload.role for change_role', () => {
  assert.equal(isValid({ ids: [1], action: 'change_role' }), false);
  assert.equal(isValid({ ids: [1], action: 'change_role', payload: {} }), false);
  assert.equal(isValid({ ids: [1], action: 'change_role', payload: { role: 'moderator' } }), true);
});

test('bulk schema rejects a role outside the allowed enum', () => {
  assert.equal(isValid({ ids: [1], action: 'change_role', payload: { role: 'superuser' } }), false);
});

test('bulk schema rejects unknown top-level properties', () => {
  assert.equal(isValid({ ids: [1], action: 'delete', extra: true }), false);
});

test('bulk schema rejects an empty or oversized id list', () => {
  assert.equal(isValid({ ids: [], action: 'delete' }), false);
  assert.equal(isValid({ ids: Array.from({ length: 101 }, (_, i) => i), action: 'delete' }), false);
});
