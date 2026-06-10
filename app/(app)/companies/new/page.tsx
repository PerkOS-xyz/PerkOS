"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection } from "wagmi";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  Briefcase,
  Check,
  Home,
  Link2,
  Loader2,
  Palette,
  Plus,
  Scissors,
  Store,
  Trash2,
  UtensilsCrossed,
  Users,
  X,
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
  deleteTeamTemplate,
  inviteAgent,
  launchAgent,
  listTeamTemplates,
  saveTeamTemplate,
  setProjectPm,
  type TeamTemplate,
} from "../../../lib/perkosApi";
import { useActiveOrg } from "../../../lib/useActiveOrg";
import { fetchActiveRuntimes } from "../../../lib/runtimeImages";

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

/** Ensure exactly one PM: if none is flagged, promote the first role. */
function withValidPm(roles: CompanyRole[]): CompanyRole[] {
  if (roles.length === 0) return roles;
  if (roles.some((r) => r.isPM)) return roles;
  return roles.map((r, i) => (i === 0 ? { ...r, isPM: true } : r));
}

const PROVIDERS = byokProviderOptions("OpenClaw");

export default function NewCompanyPage() {
  const router = useRouter();
  const { address } = useConnection();
  const { activeOrgId } = useActiveOrg();

  // Selection: a business-template id, "my:<id>", or "custom" / "empty".
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The EDITABLE team — seeded from the selection; templates are only the
  // recommended starting point, the user adds/removes roles freely.
  const [teamRoles, setTeamRoles] = useState<CompanyRole[]>([]);
  const [seedJson, setSeedJson] = useState("[]");
  const [projectName, setProjectName] = useState("");
  const [goal, setGoal] = useState("");
  // Who runs the team: launch managed PerkOS agents, or register the user's
  // own external agents (invite — no infra, they connect via onboarding prompt).
  const [agentSource, setAgentSource] = useState<"perkos" | "invite">("perkos");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [myTemplates, setMyTemplates] = useState<TeamTemplate[]>([]);
  const [llmMode, setLlmMode] = useState<"perkos" | "byok">("perkos");
  const [byokProvider, setByokProvider] = useState(PROVIDERS[0]?.id ?? "openai");
  const [byokModel, setByokModel] = useState(PROVIDERS[0]?.defaultModel ?? "");
  const [byokKey, setByokKey] = useState("");
  const [launching, setLaunching] = useState(false);
  const [progress, setProgress] = useState("");

  useEffect(() => {
    if (!address) return;
    listTeamTemplates(address)
      .then(setMyTemplates)
      .catch(() => {});
  }, [address]);

  const tmpl =
    selectedId && !selectedId.startsWith("my:") && selectedId !== "custom" && selectedId !== "empty"
      ? getCompanyTemplate(selectedId)
      : null;
  const myTmpl = selectedId?.startsWith("my:")
    ? myTemplates.find((t) => `my:${t.id}` === selectedId)
    : null;
  const mode: "template" | "my" | "custom" | "empty" | null = tmpl
    ? "template"
    : myTmpl
      ? "my"
      : selectedId === "custom"
        ? "custom"
        : selectedId === "empty"
          ? "empty"
          : null;
  const modified = JSON.stringify(teamRoles) !== seedJson;

  /** Enter the config step with a seeded team. */
  function select(id: string, roles: CompanyRole[]) {
    const seeded = withValidPm(roles.map((r) => ({ ...r })));
    setSelectedId(id);
    setTeamRoles(seeded);
    setSeedJson(JSON.stringify(seeded));
    setProjectName("");
    setGoal("");
    setAgentSource("perkos");
    setSaveAsTemplate(false);
    setTemplateName("");
  }

  function setPm(roleName: string) {
    setTeamRoles((prev) => prev.map((r) => ({ ...r, isPM: r.role === roleName })));
  }

  function removeRole(roleName: string) {
    setTeamRoles((prev) => withValidPm(prev.filter((r) => r.role !== roleName)));
  }

  function addPresetRole(presetId: string) {
    const p = AGENT_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    setTeamRoles((prev) =>
      withValidPm([
        ...prev,
        { role: p.name, runtime: "OpenClaw" as const, presetId: p.id, isPM: false },
      ]),
    );
  }

  const teamNames = new Set(teamRoles.map((r) => r.role.toLowerCase()));
  const addablePresets = AGENT_PRESETS.filter(
    (p) => p.id !== "custom" && !teamNames.has(p.name.toLowerCase()),
  );

  function onPickProvider(id: string) {
    setByokProvider(id);
    const opt = PROVIDERS.find((p) => p.id === id);
    if (opt) setByokModel(opt.defaultModel);
  }

  async function launchCompany() {
    if (!address || !mode || !projectName.trim()) return;
    const roles = teamRoles;
    if (mode !== "empty" && roles.length === 0) {
      toast.error("Pick at least one role for your team.");
      return;
    }
    if (
      roles.length > 0 &&
      agentSource === "perkos" &&
      llmMode === "byok" &&
      !byokKey.trim()
    ) {
      toast.error("Enter your model API key (or switch to PerkOS LLM).");
      return;
    }
    setLaunching(true);
    try {
      // Resolve the active runtime image per runtime FIRST — without an
      // imageTag the launch route registers the agent but never provisions an
      // ECS service ("no service"), so the whole team would be dead-on-arrival.
      let tagFor: (rt: "OpenClaw" | "Hermes") => string | null = () => null;
      if (roles.length > 0 && agentSource === "perkos") {
        setProgress("Resolving runtime images…");
        const runtimes = await fetchActiveRuntimes();
        tagFor = (rt) =>
          (rt === "Hermes" ? runtimes.hermes : runtimes.openclaw)[0]
            ?.primaryTag ?? null;
        for (const role of roles) {
          if (!tagFor(role.runtime)) {
            throw new Error(
              `No active ${role.runtime} runtime image is published — an admin needs to set one before launching.`,
            );
          }
        }
      }

      setProgress("Creating project…");
      const { project } = await createWalletProject({
        walletAddress: address,
        name: projectName.trim(),
        goal: goal.trim() || tmpl?.blurb || "",
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
      for (const role of roles) {
        i++;
        const reqName = `${slug}-${slugify(role.role)}`;
        if (agentSource === "invite") {
          setProgress(`Registering ${role.role} (${i}/${roles.length})…`);
          const res = await inviteAgent({
            name: reqName,
            runtimeKind: "custom",
            note: role.role,
          });
          launched.push({ name: res.agentName, isPM: role.isPM });
        } else {
          setProgress(`Launching ${role.role} (${i}/${roles.length})…`);
          const r = resolveRole(role, reqName);
          const res = await launchAgent({
            walletAddress: address,
            name: reqName,
            runtime: role.runtime,
            imageTag: tagFor(role.runtime),
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
      }

      if (launched.length > 0) {
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
      }

      // Persist the edited team as a personal template (best-effort — a save
      // hiccup must not fail a launch that already happened).
      if (saveAsTemplate && roles.length > 0) {
        setProgress("Saving your template…");
        await saveTeamTemplate({
          walletAddress: address,
          name:
            templateName.trim() ||
            `${projectName.trim()} team`,
          baseTemplateId: tmpl?.id ?? myTmpl?.baseTemplateId ?? null,
          roles,
        }).catch(() => {
          toast.warning("Team launched, but the template couldn't be saved.");
        });
      }

      toast.success(
        launched.length === 0
          ? "Project created"
          : agentSource === "invite"
            ? `Project created — ${launched.length} agent invite${launched.length === 1 ? "" : "s"} registered`
            : `${tmpl?.name ?? myTmpl?.name ?? "Your team"} launched`,
        {
          description:
            launched.length === 0
              ? "Add agents to it any time from the Agents tab."
              : agentSource === "invite"
                ? "Open each agent to copy its onboarding prompt and connect your own runtime."
                : "Your team is booting — they'll come online in a few minutes.",
        },
      );
      router.push(`/projects/${projectId}`);
    } catch (e) {
      toast.error("Couldn't create the project", {
        description: e instanceof Error ? e.message : String(e),
      });
      setLaunching(false);
      setProgress("");
    }
  }

  // ---- Config step ----------------------------------------------------------
  if (mode) {
    const Icon = tmpl
      ? (ICONS[tmpl.icon] ?? Bot)
      : mode === "my"
        ? Users
        : mode === "custom"
          ? Users
          : Briefcase;
    const teamSize = mode === "empty" ? 0 : teamRoles.length;
    const canSaveTemplate =
      teamSize > 0 && (mode === "custom" || modified);
    return (
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => !launching && setSelectedId(null)}
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Pick a different starting point
        </button>

        <header className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {tmpl
                ? tmpl.name
                : myTmpl
                  ? myTmpl.name
                  : mode === "custom"
                    ? "Custom team"
                    : "Empty project"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tmpl
                ? tmpl.blurb
                : myTmpl
                  ? "Your saved team — tweak it and launch."
                  : mode === "custom"
                    ? "Pick the roles your project needs and choose who leads."
                    : "Just the project — add agents any time later."}
            </p>
          </div>
        </header>

        {/* Team editor — recommended roles, fully editable */}
        {mode !== "empty" ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-foreground">
              Your team ({teamRoles.length} agent{teamRoles.length === 1 ? "" : "s"})
            </h2>
            <p className="text-xs text-muted-foreground">
              {mode === "template"
                ? "Recommended for this business — remove what you don't need, add more roles below, and pick who leads."
                : "Add or remove roles and pick who leads (the PM plans the work and coordinates the team)."}
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {teamRoles.map((role) => (
                <li
                  key={role.role}
                  className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <Bot className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 truncate text-foreground">{role.role}</span>
                  <label
                    className={cn(
                      "ml-auto flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      role.isPM
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                    title="The PM plans the work and coordinates the team"
                  >
                    <input
                      type="radio"
                      name="team-pm"
                      className="sr-only"
                      checked={role.isPM === true}
                      onChange={() => setPm(role.role)}
                      disabled={launching}
                    />
                    PM
                  </label>
                  <button
                    type="button"
                    onClick={() => removeRole(role.role)}
                    disabled={launching}
                    aria-label={`Remove ${role.role}`}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {teamRoles.length === 0 ? (
                <li className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                  No roles yet — add at least one below.
                </li>
              ) : null}
            </ul>

            {addablePresets.length > 0 ? (
              <div className="mt-1 flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Add a role</span>
                <div className="flex flex-wrap gap-1.5">
                  {addablePresets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addPresetRole(p.id)}
                      disabled={launching}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                      title={p.blurb}
                    >
                      <Plus className="h-3 w-3" />
                      <span>{p.emoji}</span>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Project name */}
        <section className="flex max-w-lg flex-col gap-2">
          <label htmlFor="company-name" className="text-sm font-medium text-foreground">
            Name your project
          </label>
          <Input
            id="company-name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g. Two-Table Cafe NY"
            disabled={launching}
            maxLength={48}
          />
        </section>

        {/* Goal — feeds the PM's planning */}
        <section className="flex max-w-lg flex-col gap-2">
          <label htmlFor="project-goal" className="text-sm font-medium text-foreground">
            What should this {teamSize > 0 ? "team" : "project"} achieve?
          </label>
          <textarea
            id="project-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={
              tmpl
                ? `Optional — defaults to: "${tmpl.blurb}"`
                : "e.g. Validate the concept: research the market, draft the launch plan, build a waitlist."
            }
            disabled={launching}
            rows={3}
            maxLength={500}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
          {teamSize > 0 ? (
            <p className="text-xs text-muted-foreground">
              The PM uses this goal to plan the board and brief the team.
            </p>
          ) : null}
        </section>

        {/* Agent source — managed PerkOS agents vs the user's own */}
        {teamSize > 0 ? (
          <section className="flex max-w-lg flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Who runs these agents?</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAgentSource("perkos")}
                disabled={launching}
                className={cn(
                  "flex flex-col gap-1 rounded-md border p-3 text-left text-sm transition-colors",
                  agentSource === "perkos"
                    ? "border-primary/60 bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  {agentSource === "perkos" ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : null}
                  PerkOS agents
                </span>
                <span className="text-xs text-muted-foreground">
                  We launch and host the team for you — online in minutes.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAgentSource("invite")}
                disabled={launching}
                className={cn(
                  "flex flex-col gap-1 rounded-md border p-3 text-left text-sm transition-colors",
                  agentSource === "invite"
                    ? "border-primary/60 bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  {agentSource === "invite" ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  Invite my own agents
                </span>
                <span className="text-xs text-muted-foreground">
                  Register each role and connect agents you already run, via an
                  onboarding prompt. No infra launched.
                </span>
              </button>
            </div>
          </section>
        ) : null}

        {/* LLM choice — only when WE host the agents */}
        {teamSize > 0 && agentSource === "perkos" ? (
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
        ) : null}

        {/* Save the edited team as a personal template */}
        {canSaveTemplate ? (
          <section className="flex max-w-lg flex-col gap-2 rounded-md border border-border bg-card p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={saveAsTemplate}
                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                disabled={launching}
                className="h-3.5 w-3.5"
              />
              Save this team as one of my templates
            </label>
            {saveAsTemplate ? (
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={`${projectName.trim() || "My"} team`}
                disabled={launching}
                maxLength={48}
                className="h-9"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                You changed the recommended team — save it to reuse on the next
                project.
              </p>
            )}
          </section>
        ) : null}

        <div className="flex max-w-lg items-center gap-3">
          <Button
            onClick={launchCompany}
            disabled={
              launching ||
              !projectName.trim() ||
              !address ||
              (mode !== "empty" && teamRoles.length === 0)
            }
            className="gap-2"
          >
            {launching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            {launching
              ? progress || "Launching…"
              : mode === "empty"
                ? "Create project"
                : agentSource === "invite"
                  ? `Create + invite ${teamRoles.length} agent${teamRoles.length === 1 ? "" : "s"}`
                  : `Launch team (${teamRoles.length})`}
          </Button>
          {launching ? (
            <span className="text-xs text-muted-foreground">
              Don&apos;t close this tab until it finishes.
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
        <h1 className="text-3xl font-medium text-foreground">New project</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Start from a business template, pick your own team of roles, or
          create an empty project. Prefer a single agent? {""}
          <button
            type="button"
            onClick={() => router.push("/agents/new")}
            className="text-primary underline-offset-2 hover:underline"
          >
            Create one here
          </button>
          .
        </p>
      </header>

      {/* Build-your-own starting points */}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <li>
          <button
            type="button"
            onClick={() => {
              const pm = AGENT_PRESETS.find((p) => p.id === "pm");
              select(
                "custom",
                pm
                  ? [{ role: pm.name, runtime: "OpenClaw", presetId: pm.id, isPM: true }]
                  : [],
              );
            }}
            className="glow-card flex h-full w-full flex-col gap-2 rounded-lg border border-primary/40 bg-card/60 p-4 text-left transition-colors hover:border-primary/70"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <Users className="h-5 w-5" />
              </span>
              <span className="text-base font-medium text-foreground">Custom team</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Define the project and pick exactly the roles it needs — PM,
              researcher, marketer, builder… you choose who leads.
            </p>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => select("empty", [])}
            className="glow-card flex h-full w-full flex-col gap-2 rounded-lg border border-border bg-card/60 p-4 text-left transition-colors hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                <Briefcase className="h-5 w-5" />
              </span>
              <span className="text-base font-medium text-foreground">Empty project</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Just the project — assign existing agents or add a team later.
            </p>
          </button>
        </li>
      </ul>

      {/* Personal templates */}
      {myTemplates.length > 0 ? (
        <>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            My templates
          </h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myTemplates.map((t) => {
              const roles = (t.roles as CompanyRole[]) ?? [];
              return (
                <li key={t.id} className="relative">
                  <button
                    type="button"
                    onClick={() => select(`my:${t.id}`, roles)}
                    className="glow-card flex h-full w-full flex-col gap-3 rounded-lg border border-primary/25 bg-card/60 p-4 text-left transition-colors hover:border-primary/60"
                  >
                    <div className="flex items-center gap-3 pr-7">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                        <Users className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 truncate text-base font-medium text-foreground">
                        {t.name}
                      </span>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                      {roles.map((r) => (
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
                  <button
                    type="button"
                    aria-label={`Delete template ${t.name}`}
                    title="Delete this template"
                    onClick={() => {
                      if (!address) return;
                      if (!window.confirm(`Delete the template "${t.name}"?`)) return;
                      deleteTeamTemplate({ walletAddress: address, templateId: t.id })
                        .then(() =>
                          setMyTemplates((prev) => prev.filter((x) => x.id !== t.id)),
                        )
                        .catch(() => toast.error("Couldn't delete the template"));
                    }}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        PerkOS business templates
      </h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COMPANY_TEMPLATES.map((t) => {
          const Icon = ICONS[t.icon] ?? Bot;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => select(t.id, t.roles)}
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
