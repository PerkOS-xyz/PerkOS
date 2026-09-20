import {describe,expect,it} from "vitest";
import {INITIAL_WIZARD_STATE} from "../app/(app)/agents/new/wizard/types";
import en from "../app/i18n/locales/en.json";
import es from "../app/i18n/locales/es.json";
describe("paid access defaults",()=>{
  it("starts with the user's own model key, never PerkOS-LLM",()=>{
    expect(INITIAL_WIZARD_STATE.llmSource).toBe("byok");
    expect(INITIAL_WIZARD_STATE.byokApiKey).toBe("");
  });
  it("explains that funding is not an infrastructure approval in both primary locales",()=>{
    expect(en.companyNew.config.infraPaymentPolicy).toContain("does not grant approval");
    expect(es.companyNew.config.infraPaymentPolicy).toContain("no concede aprobación");
  });
});
