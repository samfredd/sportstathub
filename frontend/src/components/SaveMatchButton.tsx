"use client";

import { useEffect, useState } from "react";
import { communityApi } from "@/lib/communityApi";
import { isAuthed } from "@/lib/session";

interface SaveMatchButtonProps {
  fixtureId: string;
  sport: string;
  startsAt: string;
  homeTeam: string;
  awayTeam: string;
  league?: string;
}

export function SaveMatchButton({ fixtureId, sport, startsAt, homeTeam, awayTeam, league }: SaveMatchButtonProps) {
  const [saved,setSaved]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const authenticated=isAuthed();

  useEffect(()=>{
    if(!authenticated)return;
    let mounted=true;
    communityApi.getSavedMatches().then((items)=>{
      if(mounted)setSaved(Array.isArray(items)&&items.some(item=>String(item.fixture_id)===fixtureId&&item.sport===sport));
    }).catch(()=>{});
    return()=>{mounted=false};
  },[authenticated,fixtureId,sport]);

  async function toggleSaved(){
    if(!authenticated){window.location.assign(`/auth/login?next=${encodeURIComponent(window.location.pathname)}`);return;}
    setBusy(true);setMessage("");
    try{
      if(saved)await communityApi.deleteSavedMatch(fixtureId,sport);
      else await communityApi.saveMatch(fixtureId,{sport,startsAt,homeTeam,awayTeam,league});
      setSaved(!saved);setMessage(saved?"Reminder removed":"Reminder set");
    }catch(error){setMessage(error instanceof Error?error.message:"Could not update reminder");}
    finally{setBusy(false);}
  }

  return <div className="flex items-center gap-2">
    <button type="button" onClick={toggleSaved} disabled={busy} aria-pressed={saved}
      className="rounded-lg border border-border/50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50">
      {busy?"Saving…":saved?"Saved":"Save match"}
    </button>
    <span role="status" aria-live="polite" className="sr-only">{message}</span>
  </div>;
}
