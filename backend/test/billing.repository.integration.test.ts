import test from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import pg from 'pg';
import {createBillingRepository} from '../src/modules/billing/billing.repository.js';

const connectionString=process.env.DATABASE_URL;
test('billing repository persists cancellation, receipt, refund, revocation, and timeline atomically',{skip:!connectionString},async()=>{
  const pool=new pg.Pool({connectionString});
  const db={query:(text:string,params?:unknown[])=>pool.query(text,params),transact:async(fn:any)=>{
    const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result}catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  }};
  const repo=createBillingRepository(db);const suffix=`${Date.now()}_${Math.floor(Math.random()*10000)}`;let userId:number|undefined;
  try{
    const {rows:[user]}=await pool.query(`INSERT INTO users(username,email,is_verified) VALUES($1,$2,TRUE) RETURNING id`,[`billing_${suffix}`,`billing_${suffix}@example.test`]);userId=user.id;
    const {rows:[subscription]}=await pool.query(`INSERT INTO subscriptions(user_id,plan,status,expires_at) VALUES($1,'pro','active',NOW()+INTERVAL '30 days') RETURNING *`,[userId]);
    const cancelled=await repo.cancelAtPeriodEnd(userId,'integration test');assert.equal(cancelled.cancel_at_period_end,true);assert.equal(cancelled.status,'active');
    const restored=await repo.restoreSubscription(userId);assert.equal(restored.cancel_at_period_end,false);
    const reference=`integration_${suffix}`;
    const payment=await repo.createPaymentTransaction({userId,provider:'paystack',reference,plan:'pro',billingInterval:'monthly',amountMinor:999,currency:'USD',status:'processing',providerPayload:{}});
    const settled=await repo.settleVerifiedPayment(reference,{raw:{status:true},paidAt:new Date().toISOString()});assert.equal(settled.payment.status,'success');
    const {rows:receipts}=await pool.query(`SELECT * FROM payment_receipts WHERE payment_id=$1`,[payment.id]);assert.equal(receipts.length,1);
    const refunded=await repo.applyAdversePaymentEvent(reference,'refund.processed',{data:{id:`refund_${suffix}`,amount:999,status:'processed'}});assert.equal(refunded.status,'refunded');
    const {rows:[revoked]}=await pool.query(`SELECT status,revocation_reason FROM subscriptions WHERE id=$1`,[settled.subscription.id]);assert.equal(revoked.status,'cancelled');assert.equal(revoked.revocation_reason,'refunded');
    const {rows:[timeline]}=await pool.query(`SELECT COUNT(*)::int AS count FROM subscription_events WHERE user_id=$1`,[userId]);assert.ok(timeline.count>=4);
    assert.notEqual(subscription.id,settled.subscription.id);
  }finally{if(userId)await pool.query(`DELETE FROM users WHERE id=$1`,[userId]);await pool.end()}
});
