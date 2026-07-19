import test from 'node:test';import assert from 'node:assert/strict';import 'dotenv/config';import pg from 'pg';
import {createCommunityRepository} from '../src/modules/community/community.repository.js';
import {SAVED_MATCH_REMINDER_QUERY} from '../src/plugins/scheduler.js';
const connectionString=process.env.DATABASE_URL;
test('moderation repository preserves revisions, enforces visibility controls, appeals, and notifies',{skip:!connectionString},async()=>{
  const pool=new pg.Pool({connectionString});const db={query:(text:string,params?:unknown[])=>pool.query(text,params),transact:async(fn:any)=>{const client=await pool.connect();try{await client.query('BEGIN');const value=await fn(client);await client.query('COMMIT');return value}catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}}};
  const repo=createCommunityRepository(db);const suffix=`${Date.now()}_${Math.floor(Math.random()*10000)}`;const userIds:number[]=[];let threadId:number|undefined;
  try{
    for(const role of ['user','user','admin']){const {rows:[user]}=await pool.query(`INSERT INTO users(username,email,role,is_verified) VALUES($1,$2,$3,TRUE) RETURNING id`,[`mod_${userIds.length}_${suffix}`,`mod_${userIds.length}_${suffix}@example.test`,role]);userIds.push(user.id)}
    const mentionedUsername=`mod_1_${suffix}`;
    const thread=await repo.createThread(userIds[0],{category:'testing',title:'Original moderation title',content:`Original content mentioning @${mentionedUsername}.`,tags:[],mentionUsernames:[mentionedUsername.toLowerCase()]});threadId=thread.id;
    const mentionNotifications=await repo.listNotifications(userIds[1]);assert.ok(mentionNotifications.some((row:any)=>row.category==='mentions'));
    const saved=await repo.saveMatch(userIds[0],{fixtureId:'fixture-123',sport:'football',startsAt:new Date(Date.now()+3600000).toISOString(),homeTeam:'Home FC',awayTeam:'Away FC',league:'Test League'});assert.equal(saved.fixture_id,'fixture-123');
    assert.equal((await repo.listSavedMatches(userIds[0])).length,1);assert.equal((await repo.deleteSavedMatch(userIds[0],'fixture-123','football')).deleted,true);
    await repo.saveMatch(userIds[0],{fixtureId:'fixture-due',sport:'basketball',startsAt:new Date(Date.now()+300000).toISOString(),homeTeam:'Home Hoops',awayTeam:'Away Hoops',league:'Test League'});
    const reminder=await pool.query(SAVED_MATCH_REMINDER_QUERY);assert.equal(reminder.rowCount,1);
    const {rows:[savedReminder]}=await pool.query(`SELECT link,metadata FROM notifications WHERE user_id=$1 AND category='saved_match_starts'`,[userIds[0]]);assert.equal(savedReminder.link,'/match/basketball/fixture-due');assert.equal(savedReminder.metadata.fixtureId,'fixture-due');
    await repo.updateContent({id:userIds[0],role:'user'},'thread',thread.id,{title:'Edited moderation title',content:'Edited content long enough for moderation tests.'});
    const {rows:[revision]}=await pool.query(`SELECT previous_title FROM content_revisions WHERE content_type='thread' AND content_id=$1`,[thread.id]);assert.equal(revision.previous_title,'Original moderation title');
    const report=await repo.reportContent(userIds[1],{contentType:'thread',contentId:thread.id,reason:'misinformation',details:'Integration report'});assert.equal(report.status,'open');
    const action=await repo.moderateContent(userIds[2],{reportId:report.id,action:'hide',reason:'Hidden pending author clarification'});assert.equal(action.action,'hide');assert.equal(await repo.findThreadById(thread.id),null);
    const appeal=await repo.appealModeration(userIds[0],{actionId:action.id,contentType:'thread',statement:'This is a detailed integration appeal statement.'});assert.equal(appeal.status,'open');
    const resolved=await repo.resolveAppeal(userIds[2],{appealId:appeal.id,decision:'overturned',reason:'Content verified during integration review'});assert.equal(resolved.status,'overturned');assert.ok(await repo.findThreadById(thread.id));
    await repo.setRelationship(userIds[1],userIds[0],'mute',true);assert.equal((await repo.listThreads({viewerId:userIds[1]})).some((row:any)=>row.id===thread.id),false);
    await repo.setRelationship(userIds[1],userIds[0],'mute',false);assert.equal((await repo.listThreads({viewerId:userIds[1]})).some((row:any)=>row.id===thread.id),true);
    const notifications=await repo.listNotifications(userIds[0]);assert.ok(notifications.some((row:any)=>row.category==='moderation'));
  }finally{
    if(threadId){await pool.query(`DELETE FROM moderation_appeals WHERE action_id IN(SELECT id FROM moderation_actions WHERE content_type='thread' AND content_id=$1)`,[threadId]);await pool.query(`DELETE FROM moderation_actions WHERE content_type='thread' AND content_id=$1`,[threadId]);await pool.query(`DELETE FROM content_reports WHERE content_type='thread' AND content_id=$1`,[threadId]);await pool.query(`DELETE FROM content_revisions WHERE content_type='thread' AND content_id=$1`,[threadId]);await pool.query(`DELETE FROM forum_threads WHERE id=$1`,[threadId]);}
    if(userIds.length)await pool.query(`DELETE FROM users WHERE id=ANY($1::int[])`,[userIds]);await pool.end();
  }
});
