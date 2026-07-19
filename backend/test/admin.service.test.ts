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

test('an admin cannot demote or suspend their own account', async () => {
  const repo = makeRepo();
  const service = createAdminService(repo);

  await assert.rejects(
    () => service.updateUser(1, 1, { role: 'user' }),
    (error: any) => error.statusCode === 403,
  );
  await assert.rejects(
    () => service.updateUser(1, 1, { status: 'suspended' }),
    (error: any) => error.statusCode === 403,
  );
  // Non-security-relevant self-edits (e.g. is_verified) are unaffected.
  await service.updateUser(1, 1, { is_verified: true });
  assert.equal(repo.calls.some((c: any) => c.method === 'updateUser'), true);
});

test('an admin cannot delete their own account', async () => {
  const repo: any = makeRepo();
  repo.deleteUser = async (id: number) => ({ id });
  const service = createAdminService(repo);

  await assert.rejects(
    () => service.deleteUser(1, 1),
    (error: any) => error.statusCode === 403,
  );
});

test('an admin cannot suspend or ban their own account via suspendUser', async () => {
  const repo = makeRepo();
  const service = createAdminService(repo);

  await assert.rejects(
    () => service.suspendUser(1, 1, 'suspended'),
    (error: any) => error.statusCode === 403,
  );
  // Reactivating self is not a privilege reduction — allowed.
  await service.suspendUser(1, 1, 'active');
});

test('bulk user actions reject the actor including their own id', async () => {
  const repo: any = makeRepo();
  repo.bulkUpdateUsers = async () => [{ id: 2 }];
  const service = createAdminService(repo);

  await assert.rejects(
    () => service.bulkUserAction(1, { ids: [1, 2, 3], action: 'suspend' }),
    (error: any) => error.statusCode === 403,
  );
});

test('bulk change_role validates the role against the allowed enum', async () => {
  const repo: any = makeRepo();
  repo.bulkUpdateUsers = async () => [{ id: 2 }];
  const service = createAdminService(repo);

  await assert.rejects(
    () => service.bulkUserAction(1, { ids: [2, 3], action: 'change_role', payload: { role: 'superuser' } }),
    /valid role/,
  );
  const result = await service.bulkUserAction(1, { ids: [2, 3], action: 'change_role', payload: { role: 'moderator' } });
  assert.equal(result.affected, 1);
});

test('createPlan converts decimal prices to minor units and rejects overprecise input', async () => {
  const repo: any = {
    async findPlanBySlug() { return null; },
    async createPlan(payload: any) { return { id: 5, slug: payload.slug, price_monthly_minor: payload.priceMonthlyMinor, price_yearly_minor: payload.priceYearlyMinor }; },
    async createAuditLog() {},
  };
  const service = createAdminService(repo);

  const plan = await service.createPlan(1, { slug: 'pro', displayName: 'Pro', priceMonthly: 9.99, priceYearly: 99.99 });
  assert.equal(plan.price_monthly_minor, 999);
  assert.equal(plan.price_yearly_minor, 9999);

  await assert.rejects(
    () => service.createPlan(1, { slug: 'pro2', displayName: 'Pro 2', priceMonthly: 9.999, priceYearly: 99 }),
    (error: any) => error.statusCode === 400,
  );
});

test('updatePlan recomputes minor units only for prices actually being changed', async () => {
  const calls: any[] = [];
  const repo: any = {
    async findPlanById() { return { price_monthly: '9.99', price_yearly: '99.99' }; },
    async updatePlan(id: number, patch: any) { calls.push(patch); return { id, ...patch }; },
    async createAuditLog() {},
  };
  const service = createAdminService(repo);

  await service.updatePlan(1, 5, { priceMonthly: 14.99 });
  assert.equal(calls[0].priceMonthlyMinor, 1499);
  assert.equal(calls[0].priceYearlyMinor, undefined);
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
