"use client";
import type { AgentAvatarIdentity } from "../lib/agentAvatarIdentity";

export type AgentIdentityState = "available"|"listening"|"thinking"|"working"|"using_tool"|"handoff"|"waiting"|"waiting_approval"|"success"|"warning"|"error"|"resting";
const COLORS:Partial<Record<AgentIdentityState,string>>={available:"#35e08a",success:"#35e08a",listening:"#38bdf8",thinking:"#a78bfa",working:"#38bdf8",using_tool:"#38bdf8",handoff:"#c084fc",waiting:"#94a3b8",waiting_approval:"#fbbf24",warning:"#fbbf24",error:"#fb7185",resting:"#64748b"};

export function AgentIdentityAvatar({identity,size=40,state,className=""}:{identity:AgentAvatarIdentity;size?:number;state?:AgentIdentityState|null;className?:string}){
  const active=state==="working"||state==="using_tool"||state==="thinking"; const color=COLORS[state??"available"]??`hsl(${identity.accentHue} 90% 58%)`; const muted=state==="resting";
  return <span aria-hidden="true" data-avatar-kit="companion-v3" data-avatar-version={identity.version} data-avatar-seed={identity.seed} data-avatar-role={identity.roleKey} data-avatar-archetype={identity.archetypeId} data-avatar-palette={identity.palette} data-avatar-expression={identity.expression} data-avatar-signature={identity.visualSignature} data-avatar-state={state??"identity"} className={`relative inline-grid shrink-0 place-items-center overflow-visible ${className}`} style={{width:size,height:size,opacity:muted?.62:1}}>
    <span className={`absolute inset-[5%] rounded-full motion-reduce:animate-none ${active?"motion-safe:animate-pulse":""}`} style={{background:color,opacity:active?.2:.11,boxShadow:`0 0 ${Math.max(10,size*.28)}px ${color}`}}/>
    <img src={identity.assetPath} alt="" draggable={false} loading="lazy" decoding="async" className={`relative z-[1] h-[118%] w-[118%] select-none object-contain drop-shadow-[0_5px_10px_rgba(0,0,0,0.45)] motion-reduce:transform-none ${active?"motion-safe:animate-[agent-float_2.8s_ease-in-out_infinite]":""}`} style={{filter:`${muted?"grayscale(.7) saturate(.55) ":""}hue-rotate(${identity.accentHue-identity.baseHue}deg)`}}/>
    {state&&<span className={`absolute bottom-[2%] right-[1%] z-[2] rounded-full border-2 border-[#0b0712] ${active?"motion-safe:animate-pulse":""}`} style={{width:Math.max(7,size*.18),height:Math.max(7,size*.18),background:color,boxShadow:`0 0 8px ${color}`}}/>}
    <style jsx>{`@keyframes agent-float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3%) scale(1.015)}}`}</style>
  </span>;
}
