/**
 * The tools any visitor gets, signed in or not.
 *
 * Declared as data rather than as functions because two runtimes build them:
 * the React component, once hydrated, and a small inline script that runs
 * before hydration so the tools exist from the first paint. One definition
 * means the two cannot describe different tools under the same names.
 *
 * Every entry reads a document this site already serves anonymously, so
 * nothing here exposes anything a visitor could not fetch directly.
 */
export type PublicToolSpec = {
  name: string;
  description: string;
  /** Same-origin path whose body is the tool's answer. */
  path: string;
};

export const PUBLIC_TOOL_SPECS: readonly PublicToolSpec[] = [
  {
    name: "perkos_how_to_connect",
    description:
      "Explain how an agent registers with PerkOS and authenticates: the wallet-signature " +
      "flow, how to fund an unknown address, and which endpoints to call. Returns auth.md.",
    path: "/auth.md",
  },
  {
    name: "perkos_list_agent_skills",
    description:
      "List the PerkOS agent skills published on this site, with the URL of each SKILL.md " +
      "describing what it does and how to invoke it.",
    path: "/.well-known/agent-skills/index.json",
  },
];

/** No arguments: each of these answers one fixed question. */
export const NO_ARGUMENTS = { type: "object", properties: {} } as const;

/**
 * The inline script that registers the public tools before React hydrates.
 *
 * It is deliberately tiny and dependency-free. A visitor checking for tools at
 * the load event found none, because the React effect had not run yet — from
 * outside that is indistinguishable from a site with no tools at all.
 *
 * It publishes through whichever API the host exposes, and does nothing at all
 * where WebMCP is absent, which is most browsers.
 */
export function publicToolsBootstrapScript(): string {
  const specs = JSON.stringify(PUBLIC_TOOL_SPECS);
  return `(function(){try{
var c=navigator.modelContext;if(!c)return;
var s=${specs};
var t=s.map(function(x){return{name:x.name,description:x.description,inputSchema:${JSON.stringify(NO_ARGUMENTS)},
execute:function(){return fetch(x.path,{headers:{accept:"*/*"}}).then(function(r){
if(!r.ok)throw new Error(r.status+" fetching "+x.path);return r.text()}).then(function(b){
return{content:[{type:"text",text:b}]}})}}});
if(typeof c.provideContext==="function"){c.provideContext({tools:t});}
else if(typeof c.registerTool==="function"){t.forEach(function(x){c.registerTool(x)});}
}catch(e){}})();`;
}
