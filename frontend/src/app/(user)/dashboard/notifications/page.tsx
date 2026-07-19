"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {communityApi} from '@/lib/communityApi';

interface NotificationItem { id:number;title:string;body:string;category:string;link:string|null;read_at:string|null;created_at:string }
interface NotificationPreferences { replies:boolean;mentions:boolean;follows:boolean;prediction_results:boolean;saved_match_starts:boolean;billing:boolean;moderation:boolean }

export default function NotificationsPage(){
  const [items,setItems]=useState<NotificationItem[]>([]);const [prefs,setPrefs]=useState<NotificationPreferences|null>(null);const [loading,setLoading]=useState(true);
  useEffect(()=>{let mounted=true;Promise.all([communityApi.getNotifications(),communityApi.getNotificationPreferences()]).then(([n,p])=>{if(mounted){setItems(Array.isArray(n)?n:[]);setPrefs(p)}}).finally(()=>{if(mounted)setLoading(false)});return()=>{mounted=false};},[]);
  async function markAll(){await communityApi.markNotificationsRead();setItems(v=>v.map(n=>({...n,read_at:n.read_at??new Date().toISOString()})));}
  async function toggle(key:keyof NotificationPreferences,value:boolean|string){if(!prefs)return;const previous=prefs;setPrefs({...prefs,[key]:value} as NotificationPreferences);try{setPrefs(await communityApi.updateNotificationPreferences({[key]:value}))}catch{setPrefs(previous)}}
  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-2xl font-black text-foreground">Notifications</h2><p className="text-sm text-muted mt-1">Replies, follows, billing, security and moderation updates</p></div>
      <button onClick={markAll} className="px-3 py-2 rounded-xl border border-border/40 text-xs font-black">Mark all read</button></div>
    <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
      <div className="glass rounded-2xl border border-border/30 divide-y divide-border/20">
        {loading?<p className="p-6 text-muted">Loading…</p>:items.length===0?<p className="p-6 text-muted">You have no notifications yet.</p>:items.map(n=><div key={n.id} className={`p-4 ${n.read_at?'':'bg-accent/5'}`}>
          <div className="flex justify-between gap-3"><div><p className="font-black text-sm text-foreground">{n.title}</p><p className="text-sm text-muted mt-1">{n.body}</p></div>{!n.read_at&&<span className="w-2 h-2 rounded-full bg-accent mt-1.5"/>}</div>
          <div className="mt-2 flex gap-3 text-[11px] text-muted"><span className="uppercase font-black">{n.category}</span><span>{new Date(n.created_at).toLocaleString()}</span>{n.link&&<Link href={n.link} className="text-accent font-black">Open</Link>}</div>
        </div>)}</div>
      {prefs&&<aside className="glass rounded-2xl border border-border/30 p-5"><p className="text-[11px] font-black uppercase tracking-widest text-muted mb-4">Preferences</p>
        {([['replies','Replies'],['mentions','Mentions'],['follows','New followers'],['prediction_results','Prediction results'],['saved_match_starts','Saved match starts'],['billing','Billing'],['moderation','Moderation']] as const).map(([key,label])=><label key={key} className="flex items-center justify-between py-2 text-sm font-bold"><span>{label}</span><input type="checkbox" checked={Boolean(prefs[key])} onChange={e=>toggle(key,e.target.checked)}/></label>)}
        <p className="text-[10px] text-muted mt-3">Security notifications are always enabled.</p></aside>}
    </div>
  </div>;
}
