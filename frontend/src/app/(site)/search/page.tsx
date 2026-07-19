"use client";

import Link from "next/link";
import { useEffect,useRef,useState } from "react";
import api from "@/lib/api";

interface SearchItem {id:string|number;title:string;subtitle:string;href:string}
interface SearchGroups {teams:SearchItem[];creators:SearchItem[];predictions:SearchItem[];threads:SearchItem[];news:SearchItem[]}
const EMPTY:SearchGroups={teams:[],creators:[],predictions:[],threads:[],news:[]};

function normalize(data:any):SearchGroups{
  return {
    teams:(data.teams??[]).map((item:any)=>({id:item.id,title:item.name,subtitle:item.country||'Football team',href:`/stats?team=${item.id}`})),
    creators:(data.creators??[]).map((item:any)=>({id:item.id,title:item.display_name||item.username,subtitle:`@${item.username}`,href:`/creators/${item.id}`})),
    predictions:(data.predictions??[]).map((item:any)=>({id:item.id,title:`${item.match_data?.homeTeam?.name??'Home'} vs ${item.match_data?.awayTeam?.name??'Away'}`,subtitle:item.prediction?.selection||item.prediction?.type||item.sport,href:`/predictions/${item.id}`})),
    threads:(data.threads??[]).map((item:any)=>({id:item.id,title:item.title,subtitle:item.category,href:`/forum/${item.id}`})),
    news:(data.news??[]).map((item:any)=>({id:item.id,title:item.title,subtitle:item.source,href:`/news/${item.id}`})),
  };
}

export default function SearchPage(){
  const [query,setQuery]=useState("");const [groups,setGroups]=useState<SearchGroups>(EMPTY);const [loading,setLoading]=useState(false);const [error,setError]=useState(false);const inputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{inputRef.current?.focus()},[]);
  useEffect(()=>{const normalized=query.trim();if(normalized.length<2){setGroups(EMPTY);setLoading(false);return}const controller=new AbortController();const timer=setTimeout(async()=>{setLoading(true);setError(false);try{const response=await api.globalSearch(normalized,{signal:controller.signal});setGroups(normalize(response.data??response))}catch{if(!controller.signal.aborted)setError(true)}finally{if(!controller.signal.aborted)setLoading(false)}},300);return()=>{clearTimeout(timer);controller.abort()}},[query]);
  const total=Object.values(groups).reduce((sum,items)=>sum+items.length,0);
  return <main className="mx-auto min-h-[70vh] max-w-4xl px-4 py-10">
    <h1 className="text-3xl font-black">Search</h1><p className="mt-2 text-sm text-muted">Find teams, creators, predictions, forum discussions, and news.</p>
    <label htmlFor="global-search" className="sr-only">Search SportStatHub</label><input ref={inputRef} id="global-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search SportStatHub…" className="mt-6 w-full rounded-2xl border border-border bg-surface px-5 py-4 text-base outline-none focus:ring-2 focus:ring-accent"/>
    <div className="mt-5" aria-live="polite" aria-busy={loading}>{loading&&<p className="text-muted">Searching…</p>}{error&&<p role="alert" className="text-danger">Search is temporarily unavailable.</p>}{!loading&&!error&&query.trim().length>=2&&total===0&&<p className="text-muted">No results found.</p>}
      {!loading&&!error&&Object.entries(groups).map(([key,items])=>items.length>0&&<section key={key} className="mb-7" aria-labelledby={`search-${key}`}><h2 id={`search-${key}`} className="mb-2 text-xs font-black uppercase tracking-widest text-muted">{key}</h2><ul className="grid gap-2 sm:grid-cols-2">{items.map(item=><li key={`${key}-${item.id}`}><Link href={item.href} className="block rounded-xl border border-border p-4 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><strong className="block truncate">{item.title}</strong><span className="text-xs text-muted">{item.subtitle}</span></Link></li>)}</ul></section>)}
    </div></main>;
}
