import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({fetch:vi.fn(),query:vi.fn()}));
vi.mock("@tanstack/react-query",()=>({useQuery:mocks.query}));
vi.mock("../app/lib/apiClient",()=>({authedFetch:mocks.fetch}));
import {useAgentPresence} from "../app/lib/useAgentPresence";
beforeEach(()=>{vi.resetAllMocks();mocks.query.mockReturnValue({data:undefined,isError:false});});
describe("bulk live presence adapter",()=>{
  it("deduplicates IDs and batches at 250",async()=>{
    useAgentPresence("owner",[...Array.from({length:251},(_,i)=>`agent-${i}`),"agent-0"]);
    mocks.fetch.mockImplementation(async()=>new Response(JSON.stringify({enabled:true,presence:{}})));
    await mocks.query.mock.calls[0][0].queryFn();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).ids).toHaveLength(250);
    expect(JSON.parse(mocks.fetch.mock.calls[1][1].body).ids).toHaveLength(1);
  });
  it("converts server expiry to local remaining lease time",async()=>{
    useAgentPresence("owner",["agent"]);
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({enabled:true,serverTime:100,presence:{agent:{presenceExpiresAt:1100,lastBridgeSeenAt:null}}})));
    const before=Date.now();const result=await mocks.query.mock.calls[0][0].queryFn();
    expect(result.presence.agent.presenceExpiresAt).toBeGreaterThanOrEqual(before+1000);
    expect(result.presence.agent.lastBridgeSeenAt).toBeUndefined();
  });
  it("marks a failed live snapshot unknown instead of preserving a green stale state",()=>{
    mocks.query.mockReturnValue({data:{enabled:true,presence:{agent:{bridgeConnected:true}}},isError:true});
    expect(useAgentPresence("owner",["agent"]).agent).toMatchObject({presenceUnavailable:true,bridgeConnected:false});
  });
  it("preserves legacy behavior while the backend feature is off",()=>{
    mocks.query.mockReturnValue({data:{enabled:false,presence:{}},isError:false});
    expect(useAgentPresence("owner",["agent"])).toEqual({});
  });
  it("does not poll an anonymous or empty roster",()=>{
    useAgentPresence(null,["agent"]);expect(mocks.query.mock.calls[0][0].enabled).toBe(false);
    useAgentPresence("owner",[]);expect(mocks.query.mock.calls[1][0].enabled).toBe(false);
  });
});
