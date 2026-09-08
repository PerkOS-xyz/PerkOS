import { beforeEach, expect, it, vi } from "vitest";
const mock=vi.hoisted(()=>({ getDoc:vi.fn(),getDocs:vi.fn(),updateDoc:vi.fn() }));
vi.mock("../app/lib/firebase",()=>({firebaseDb:()=>({})}));
vi.mock("../app/lib/activityEvents",()=>({logActivity:vi.fn()}));
vi.mock("../app/lib/edges",()=>({entityKey:vi.fn(),writeEdge:vi.fn()}));
vi.mock("firebase/firestore",async importOriginal=>{
  const actual=await importOriginal<typeof import("firebase/firestore")>();
  const ref=(_db:unknown,...parts:string[])=>({path:parts.join("/"),withConverter(){return this;}});
  return {...actual,doc:ref,collection:ref,query:(r:unknown)=>r,getDoc:mock.getDoc,getDocs:mock.getDocs,updateDoc:mock.updateDoc};
});
import {getWalletProject} from "../app/lib/perkosApi";
const owner="fixture-owner",projectId="fixture-project";
const name="fixture-agent";
const agent={name,displayName:"Creator Update",runtime:"Hermes",managed:true,executionMode:"artizen-on-demand",executionState:"resting",privateField:"must-not-return"};
const snap=(data:unknown[])=>({size:data.length,docs:data.map(value=>({data:()=>value}))});
beforeEach(()=>{
  vi.clearAllMocks();
  mock.getDoc.mockResolvedValue({exists:()=>true,data:()=>({id:projectId,name:"Example",tasks:1,agents:1,agentIds:[name]})});
  mock.getDocs.mockImplementation(async(ref:{path:string})=>ref.path.endsWith("/tasks")?snap([{agent:name,status:"Review"}]):ref.path.endsWith("/agents")?snap([agent,{...agent,name:"unassigned"}]):snap([]));
});
it("reuses existing roster read and returns only assigned agent display fields",async()=>{
  const detail=await getWalletProject({walletAddress:owner,projectId});
  expect(detail.taskAgents).toEqual([{name,displayName:"Creator Update",runtime:"Hermes",executionMode:"artizen-on-demand",executionState:"resting"}]);
  expect(mock.getDocs).toHaveBeenCalledTimes(3);
  expect(mock.updateDoc).not.toHaveBeenCalled();
  expect(JSON.stringify(detail.taskAgents)).not.toContain("privateField");
});
it("roster permission denial leaves task content readable with no guessed state",async()=>{
  mock.getDocs.mockImplementation(async(ref:{path:string})=>{if(ref.path.endsWith("/agents"))throw Error("denied");return ref.path.endsWith("/tasks")?snap([{agent:name,status:"Review"}]):snap([]);});
  const detail=await getWalletProject({walletAddress:owner,projectId});
  expect(detail.tasks).toHaveLength(1);
  expect(detail.taskAgents).toBeUndefined();
  expect(mock.getDocs).toHaveBeenCalledTimes(3);
  expect(mock.updateDoc).not.toHaveBeenCalled();
});
