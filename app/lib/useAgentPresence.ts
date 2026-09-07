"use client";

import {useQuery} from "@tanstack/react-query";
import {authedFetch} from "./apiClient";

export type PresencePatch={
  status?:"ready";
  presenceUnavailable?:boolean;
  presenceSource:"redis"; presenceExpiresAt:number; bridgeConnected:boolean;
  lastBridgeSeenAt?:string; runtimeHealthCheckedAt:string|null;
  runtimeStatus:"healthy"|"unreachable"|"unknown"; runtimeHealthy:boolean;
};
export const unavailablePresence:PresencePatch={presenceSource:"redis",presenceExpiresAt:0,
  presenceUnavailable:true,
  bridgeConnected:false,lastBridgeSeenAt:undefined,runtimeHealthCheckedAt:null,runtimeStatus:"unknown",runtimeHealthy:false};

/** One bounded bulk Redis read per visible roster, never a Firestore poll per agent. */
export function useAgentPresence(wallet:string|null|undefined,requestedIds:string[]){
  const ids=[...new Set(requestedIds)].sort();
  const query=useQuery({
    queryKey:["agent-presence",wallet?.toLowerCase(),ids.join(",")],
    enabled:Boolean(wallet)&&ids.length>0,
    queryFn:async()=>{
      let enabled=false;const presence:Record<string,PresencePatch>={};
      for(let start=0;start<ids.length;start+=250){
        const response=await authedFetch("/api/agents/presence",{method:"POST",body:JSON.stringify({ids:ids.slice(start,start+250)})});
        const body=await response.json() as {enabled?:boolean;serverTime?:number;presence?:Record<string,PresencePatch>};
        if(!response.ok)throw new Error("Presence unavailable");
        enabled ||=body.enabled===true;
        for(const [id,value] of Object.entries(body.presence??{}))presence[id]={...value,
          lastBridgeSeenAt:value.lastBridgeSeenAt??undefined,
          presenceExpiresAt:typeof body.serverTime==="number"?Date.now()+Math.max(0,value.presenceExpiresAt-body.serverTime):value.presenceExpiresAt};
      }
      return {enabled,presence};
    },
    staleTime:10_000,refetchInterval:15_000,retry:false,refetchIntervalInBackground:false,
  });
  if(!query.data?.enabled)return {} as Record<string,PresencePatch>;
  if(query.isError)return Object.fromEntries(ids.map(id=>[id,unavailablePresence]));
  return query.data.presence;
}
