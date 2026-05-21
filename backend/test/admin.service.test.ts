import test from 'node:test';
import assert from 'node:assert/strict';

import { createAdminService } from '../src/modules/admin/admin.service.js';

function makeRepo() {
  const calls = [];

  return {
    calls,
    async updateUser(id, payload) {
      calls.push({ method: 'updateUser', id, payload });
      return { id, username: 'creator', email: 'creator@example.com', ...payload };
    },
    async createAuditLog(payload) {
      calls.push({ method: 'createAuditLog', payload });
    },
  };
}

test('updateUser accepts creator role as an admin-managed role', async () => {
  const repo = makeRepo();
  const service = createAdminService(repo);

  const result = await service.updateUser(1, 2, { role: 'creator' });

  assert.equal(result.role, 'creator');
  assert.deepEqual(repo.calls[0], {
    method: 'updateUser',
    id: 2,
    payload: { role: 'creator' },
  });
});

test('updateUser accepts admin-managed account status', async () => {
  const repo = makeRepo();
  const service = createAdminService(repo);

  const result = await service.updateUser(1, 2, { status: 'suspended' });

  assert.equal(result.status, 'suspended');
  assert.deepEqual(repo.calls[0], {
    method: 'updateUser',
    id: 2,
    payload: { status: 'suspended' },
  });
});

test('updateUser rejects invalid account status', async () => {
  const repo = makeRepo();
  const service = createAdminService(repo);

  await assert.rejects(
    () => service.updateUser(1, 2, { status: 'paused' }),
    /Invalid status/,
  );
});

test('listUsers passes status filter to repository methods', async () => {
  const calls = [];
  const repo = {
    calls,
    async findAllUsers(params) {
      calls.push({ method: 'findAllUsers', params });
      return [];
    },
    async countUsers(search, status) {
      calls.push({ method: 'countUsers', search, status });
      return 0;
    },
  };
  const service = createAdminService(repo);

  await service.listUsers({ page: 2, limit: 10, search: 'sam', status: 'banned' });

  assert.deepEqual(calls, [
    { method: 'findAllUsers', params: { limit: 10, offset: 10, search: 'sam', status: 'banned' } },
    { method: 'countUsers', search: 'sam', status: 'banned' },
  ]);
});
