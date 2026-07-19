"use client";
import {useEffect,useState} from 'react';
import {adminApi} from '@/lib/adminApi';

interface Report {id:number;content_type:string;content_id:number;reason:string;details:string|null;reporter_username:string;created_at:string}
export default function ModerationPage(){
  const [reports,setReports]=useState<Report[]>([]);const [loading,setLoading]=useState(true);const [message,setMessage]=useState('');
  async function load(){setLoading(true);try{const rows=await adminApi.getModerationReports();setReports(Array.isArray(rows)?rows:[])}finally{setLoading(false)}}
  useEffect(()=>{let mounted=true;adminApi.getModerationReports().then(rows=>{if(mounted)setReports(Array.isArray(rows)?rows:[])}).finally(()=>{if(mounted)setLoading(false)});return()=>{mounted=false}},[]);
  async function decide(reportId:number,action:'hide'|'remove'|'dismiss'|'warn'){const reason=window.prompt(`Reason for ${action}:`);if(!reason||reason.trim().length<5)return;
    try{await adminApi.moderateReport({reportId,action,reason});setMessage('Decision recorded and the author was notified.');await load()}catch(error){setMessage(error instanceof Error?error.message:'Decision failed')}}
  return <div className="space-y-6"><div><h1 className="text-2xl font-black text-foreground">Moderation queue</h1><p className="text-sm text-muted mt-1">Review user reports with an auditable decision trail</p></div>
    {message&&<div className="glass p-4 rounded-xl text-sm font-bold">{message}</div>}
    <div className="glass rounded-2xl border border-border/30 divide-y divide-border/20">{loading?<p className="p-6 text-muted">Loading…</p>:reports.length===0?<p className="p-6 text-muted">No open reports.</p>:reports.map(report=><article key={report.id} className="p-5">
      <div className="flex flex-wrap justify-between gap-3"><div><p className="font-black text-foreground capitalize">{report.reason} · {report.content_type} #{report.content_id}</p><p className="text-sm text-muted mt-1">Reported by {report.reporter_username} · {new Date(report.created_at).toLocaleString()}</p>{report.details&&<p className="text-sm text-foreground mt-3">{report.details}</p>}</div>
      <div className="flex flex-wrap gap-2">{(['warn','hide','remove','dismiss'] as const).map(action=><button key={action} onClick={()=>decide(report.id,action)} className="px-3 py-2 rounded-xl border border-border/40 text-xs font-black capitalize hover:border-accent/50">{action}</button>)}</div></div>
    </article>)}</div></div>;
}
