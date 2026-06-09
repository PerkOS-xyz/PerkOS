"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection } from "wagmi";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  Briefcase,
  Check,
  Home,
  Loader2,
  Palette,
  Scissors,
  Store,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  COMPANY_TEMPLATES,
  getCompanyTemplate,
  type CompanyRole,
} from "../../../lib/companyTemplates";
import { AGENT_PRESETS, renderSoulMd } from "../../../lib/agentPresets";
import { byokBaseUrl, byokProviderOptions } from "../../../lib/agentConfigPreview";
import {
  assignAgentsToProject,
  createWalletProject,
  launchAgent,
  setProjectPm,
} from "../../../lib/perkosApi";
import { useActiveOrg } from "../../../lib/useActiveOrg";

const ICONS: Record<string, LucideIcon> = {
  Store,
  Scissors,
  Briefcase,
  UtensilsCrossed,
  Palette,
  Home,
};

// Resolve a role to the launch payload: reused presets pull their soul +
// recommended skills/plugins; authored roles render their inline soul.
function resolveRole(role: CompanyRole, agentName: string) {
  if (role.presetId) {
    const p = AGENT_PRESETS.find((x) => x.id === role.presetId);
    return {
      soul: p ? renderSoulMd(agentName, p.soul) : "",
      plugins: role.plugins ?? p?.recommendedPlugins ?? [],
      skills: role.skills ?? p?.recommendedSkills ?? [],
    };
  }
  return {
    soul: role.soul ? renderSoulMd(agentName, role.soul) : "",
    plugins: role.plugins ?? [],
    skills: role.skills ?? [],
  };
}

function slugify(s: string): string {
  return (
    s
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "agent"
  );
}

const PROVIDERS = byokProviderOptions("OpenClaw");

export default function NewCompanyPage() {
  const router = useRouter();
  const { address } = useConnection();
  const { activeOrgId } = useActiveOrg();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [llmMode, setLlmMode] = useState<"perkos" | "byok">("perkos");
  const [byokProvider, setByokProvider] = useState(PROVIDERS[0]?.id ?? "openai");
  const [byokModel, setByokModel] = useState(PROVIDERS[0]?.defaultModel ?? "");
  const [byokKey, setByokKey] = useState("");
  const [launching, setLaunching] = useState(false);
  const [progress, setProgress] = useState("");

  const tmpl = selectedId ? getCompanyTemplate(selectedId) : null;

  function onPickProvider(id: string) {
    setByokProvider(id);
    const opt = PROVIDERS.find((p) => p.id === id);
    if (opt) setByokModel(opt.defaultModel);
  }

  async function launchCompany() {
    if (!address || !tmpl || !projectName.trim()) return;
    if (llmMode === "byok" && !byokKey.trim()) {
      toast.error("Enter your model API key (or switch to PerkOS LLM).");
      return;
    }
    setLaunching(true);
    try {
      setProgress("Creating project…");
      const { project } = await createWalletProject({
        walletAddress: address,
        name: projectName.trim(),
        goal: tmpl.blurb,
        orgId: activeOrgId ?? undefined,
      });
      const projectId = project.id;
      if (!projectId) throw new Error("Project was created without an id.");

      const llm =
        llmMode === "byok"
          ? {
              modelKey: byokKey.trim(),
              llmBaseUrl: byokBaseUrl(byokProvider),
              llmModel: byokModel.trim(),
            }
          : {};

      const slug = slugify(projectName);
      const launched: { name: string; isPM?: boolean }[] = [];
      let i = 0;
      for (const role of tmpl.roles) {
        i++;
        setProgress(`Launching ${role.role} (${i}/${tmpl.roles.length})…`);
        const reqName = `${slug}-${slugify(role.role)}`;
        const r = resolveRole(role, reqName);
        const res = await launchAgent({
          walletAddress: address,
          name: reqName,
          runtime: role.runtime,
          soul: r.soul,
          plugins: r.plugins,
          skills: r.skills,
          ...llm,
        });
        launched.push({
          name: res.result?.agent?.name ?? reqName,
          isPM: role.isPM,
        });
      }

      setProgress("Assigning the team…");
      await assignAgentsToProject({
        walletAddress: address,
        projectId,
        agentNames: launched.map((l) => l.name),
      });
      const pm = launched.find((l) => l.isPM);
      if (pm) {
        await setProjectPm({
          walletAddress: address,
          projectId,
          pmAgent: pm.name,
        });
      }

      toast.success(`${tmpl.name} launched`, {
        description: "Your team is booting — they'll come online in a few minutes.",
      });
      router.push(`/projects/${projectId}`);
    } catch (e) {
      toast.error("Couldn't launch the company", {
        description: e instanceof Error ? e.message : String(e),
      });
      setLaunching(false);
      setProgress("");
    }
  }

  // ---- Config step ----------------------------------------------------------
  if (tmpl) {
    const Icon = ICONS[tmpl.icon] ?? Bot;
    return (
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => !launching && setSelectedId(null)}
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Pick a different template
        </button>

        <header className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{tmpl.name}</h1>
            <p className="text-sm text-muted-foreground">{tmpl.blurb}</p>
          </div>
        </header>

        {/* Team preview */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-foreground">
            Your team ({tmpl.roles.length} agents)
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {tmpl.roles.map((role) => (
              <li
                key={role.role}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <Bot className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-foreground">{role.role}</span>
                {role.isPM ? (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    PM
                  </span>
                ) : (
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                    {role.runtime}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Project name */}
        <section className="flex max-w-lg flex-col gap-2">
          <label htmlFor="company-name" className="text-sm font-medium text-foreground">
            Name your company / project
          </label>
          <Input
            id="company-name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g. Mi Tienda"
            disabled={launching}
            maxLength={48}
          />
        </section>

        {/* LLM choice — always asked */}
        <section className="flex max-w-lg flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Where does the AI run?</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setLlmMode("perkos")}
              disabled={launching}
              className={cn(
                "flex flex-col gap-1 rounded-md border p-3 text-left text-sm transition-colors",
                llmMode === "perkos"
                  ? "border-primary/60 bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                {llmMode === "perkos" ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                PerkOS LLM
              </span>
              <span className="text-xs text-muted-foreground">
                Runs on PerkOS infrastructure — no API key needed.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setLlmMode("byok")}
              disabled={launching}
              className={cn(
                "flex flex-col gap-1 rounded-md border p-3 text-left text-sm transition-colors",
                llmMode === "byok"
                  ? "border-primary/60 bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                {llmMode === "byok" ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                Bring your own model
              </span>
              <span className="text-xs text-muted-foreground">
                Use your own OpenAI-compatible key. Deployed on PerkOS infra.
              </span>
            </button>
          </div>

          {llmMode === "byok" ? (
            <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
              <div className="flex flex-wrap gap-2">
                <select
                  value={byokProvider}
                  onChange={(e) => onPickProvider(e.target.value)}
                  disabled={launching}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <Input
                  value={byokModel}
                  onChange={(e) => setByokModel(e.target.value)}
                  placeholder="model id"
                  disabled={launching}
                  className="h-9 min-w-0 flex-1 font-mono text-xs"
                />
              </div>
              <Input
                value={byokKey}
                onChange={(e) => setByokKey(e.target.value)}
                placeholder="sk-… (your API key — stored encrypted, never in the job)"
                disabled={launching}
                type="password"
                className="h-9 font-mono text-xs"
              />
            </div>
          ) : null}
        </section>

        <div className="flex max-w-lg items-center gap-3">
          <Button
            onClick={launchCompany}
            disabled={launching || !projectName.trim() || !address}
            className="gap-2"
          >
            {launching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            {launching ? progress || "Launching…" : "Launch company"}
          </Button>
          {launching ? (
            <span className="text-xs text-muted-foreground">
              Don't close this tab until it finishes.
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  // ---- Gallery step ---------------------------------------------------------
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium text-foreground">Start a company</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Pick a template and launch a ready-made team in one click. Prefer to
          build it yourself? {""}
          <button
            type="button"
            onClick={() => router.push("/agents/new")}
            className="text-primary underline-offset-2 hover:underline"
          >
            Create a single agent
          </button>{" "}
          and add it to a project instead.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COMPANY_TEMPLATES.map((t) => {
          const Icon = ICONS[t.icon] ?? Bot;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(t.id);
                  setProjectName("");
                }}
                className="glow-card flex h-full w-full flex-col gap-3 rounded-lg border border-primary/25 bg-card/60 p-4 text-left transition-colors hover:border-primary/60"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-base font-medium text-foreground">{t.name}</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{t.blurb}</p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  {t.roles.map((r) => (
                    <span
                      key={r.role}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px]",
                        r.isPM
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {r.role}
                    </span>
                  ))}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
