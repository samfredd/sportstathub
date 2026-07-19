import fp from 'fastify-plugin';

const durationBuckets = [0.05,0.1,0.25,0.5,1,2.5,5,10];
const esc = (value: unknown) => String(value ?? 'unknown').replace(/\\/g,'\\\\').replace(/"/g,'\\"');

async function observability(fastify: any) {
  const startedAt = Date.now();
  const requests = new Map<string,number>();
  const durations = new Map<string,number[]>();
  let authFailures = 0; let serverErrors = 0; let windowStarted = Date.now();
  const gauges={sseConnections:0};
  fastify.decorate('observabilityGauges',gauges);

  fastify.addHook('onRequest',async (request: any) => { request.metricsStartedAt=process.hrtime.bigint(); });
  fastify.addHook('onResponse',async (request: any,reply: any) => {
    const route = request.routeOptions?.url ?? 'unmatched';
    const key = `${request.method}|${route}|${reply.statusCode}`;
    requests.set(key,(requests.get(key)??0)+1);
    const elapsed = Number(process.hrtime.bigint()-request.metricsStartedAt)/1e9;
    const durationKey = `${request.method}|${route}`;
    const values = durations.get(durationKey) ?? [0,...durationBuckets.map(()=>0),0];
    values[0] += elapsed; durationBuckets.forEach((bucket,index) => { if(elapsed<=bucket) values[index+1]++; }); values[values.length-1]++;
    durations.set(durationKey,values);
    if(reply.statusCode===401 || reply.statusCode===403) authFailures++;
    if(reply.statusCode>=500) serverErrors++;
    const now=Date.now();
    if(now-windowStarted>=60_000){
      if(authFailures>=50) fastify.log.warn({securityAlert:'auth_failure_spike',count:authFailures,windowSeconds:60},'Security alert threshold exceeded');
      if(serverErrors>=20) fastify.log.error({operationalAlert:'server_error_spike',count:serverErrors,windowSeconds:60},'Operational alert threshold exceeded');
      authFailures=0;serverErrors=0;windowStarted=now;
    }
  });

  fastify.get('/metrics',{schema:{hide:true}},async (request: any,reply: any) => {
    const configured=process.env.METRICS_TOKEN;
    const supplied=String(request.headers.authorization??'').replace(/^Bearer\s+/i,'');
    if(configured && supplied!==configured) return reply.status(401).send({error:'Unauthorized'});
    if(process.env.NODE_ENV==='production' && !configured) return reply.status(503).send({error:'Metrics token is not configured'});
    const lines=['# HELP sportstathub_uptime_seconds Process uptime.','# TYPE sportstathub_uptime_seconds gauge',`sportstathub_uptime_seconds ${(Date.now()-startedAt)/1000}`,
      '# HELP sportstathub_http_requests_total HTTP requests.','# TYPE sportstathub_http_requests_total counter'];
    for(const [key,count] of requests){const [method,route,status]=key.split('|');lines.push(`sportstathub_http_requests_total{method="${esc(method)}",route="${esc(route)}",status="${esc(status)}"} ${count}`);}
    lines.push('# HELP sportstathub_http_request_duration_seconds Request duration.','# TYPE sportstathub_http_request_duration_seconds histogram');
    for(const [key,values] of durations){const [method,route]=key.split('|');durationBuckets.forEach((bucket,index)=>lines.push(`sportstathub_http_request_duration_seconds_bucket{method="${esc(method)}",route="${esc(route)}",le="${bucket}"} ${values[index+1]}`));
      lines.push(`sportstathub_http_request_duration_seconds_bucket{method="${esc(method)}",route="${esc(route)}",le="+Inf"} ${values[values.length-1]}`);
      lines.push(`sportstathub_http_request_duration_seconds_sum{method="${esc(method)}",route="${esc(route)}"} ${values[0]}`);
      lines.push(`sportstathub_http_request_duration_seconds_count{method="${esc(method)}",route="${esc(route)}"} ${values[values.length-1]}`);}
    const pool=fastify.pg?.pool;
    lines.push('# TYPE sportstathub_db_pool_total gauge',`sportstathub_db_pool_total ${pool?.totalCount??0}`,
      '# TYPE sportstathub_db_pool_idle gauge',`sportstathub_db_pool_idle ${pool?.idleCount??0}`,
      '# TYPE sportstathub_db_pool_waiting gauge',`sportstathub_db_pool_waiting ${pool?.waitingCount??0}`,
      '# TYPE sportstathub_redis_up gauge',`sportstathub_redis_up ${fastify.redis?.status==='ready'?1:0}`,
      '# TYPE sportstathub_sse_connections gauge',`sportstathub_sse_connections ${gauges.sseConnections}`);
    try{
      const {rows}=await fastify.db.query(`SELECT
        (SELECT COUNT(*)::int FROM payment_webhook_events WHERE processing_status IN ('pending','processing')) AS payment_webhooks_pending,
        (SELECT COUNT(*)::int FROM payment_webhook_events WHERE processing_status='failed') AS payment_webhooks_failed,
        (SELECT COUNT(*)::int FROM payment_transactions WHERE status IN ('pending','processing')) AS payments_pending,
        (SELECT COUNT(*)::int FROM ai_usage_events WHERE created_at>=CURRENT_DATE) AS ai_requests_today,
        (SELECT COALESCE(SUM(output_characters),0)::bigint FROM ai_usage_events WHERE created_at>=CURRENT_DATE) AS ai_output_characters_today`);
      const row=rows[0]??{};
      for(const [name,value] of Object.entries(row))lines.push(`# TYPE sportstathub_${name} gauge`,`sportstathub_${name} ${Number(value??0)}`);
    }catch(error:any){fastify.log.warn({err:error?.message},'Domain metrics query failed');}
    return reply.type('text/plain; version=0.0.4; charset=utf-8').send(`${lines.join('\n')}\n`);
  });
}
export default fp(observability,{name:'observability'});
