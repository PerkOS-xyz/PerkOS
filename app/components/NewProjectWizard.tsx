"use client";

/** Canonical new-project wizard. Routed at /projects/new. */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchLlmAccess } from "../lib/llmAccess";
import { fetchEcsAccess } from "../lib/ecsAccess";
import { useRouter } from "next/navigation";
import { useAppAccount } from "../lib/useAppAccount";
import { teamAgentName, teamAgentNames } from "../lib/teamAgentName";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ProjectTemplateGallery } from "./ProjectTemplateWizard";
import { AgentOrb } from "./AgentOrb";
import {
  ArrowLeft,
  Bot,
  Briefcase,
  Calculator,
  Check,
  ChevronDown,
  GraduationCap,
  Hammer,
  HeartPulse,
  Home,
  Link2,
  Loader2,
  Palette,
  Plus,
  Rocket,
  ShoppingCart,
  Sparkles,
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
} from "../lib/companyTemplates";
import { AGENT_PRESETS, renderSoulMd } from "../lib/agentPresets";
import { byokBaseUrl, byokProviderOptions } from "../lib/agentConfigPreview";
import {
  assignAgentsToProject,
  createWalletProject,
  deleteTeamTemplate,
  getWalletAgents,
  inviteAgent,
  launchAgent,
  listTeamTemplates,
  saveTeamTemplate,
  setProjectPm,
  type AgentRow,
  type TeamTemplate,
} from "../lib/perkosApi";
import { useActiveOrg } from "../lib/useActiveOrg";
import { buildExistingTeamRoster } from "../lib/existingAgentTeam";
import { fetchActiveRuntimes } from "../lib/runtimeImages";
import { launchTeam, newTeamLaunchRequestId } from "../lib/teamLaunch";
import {
  BRAND_ACCENT,
  INDUSTRY_LABELS,
  StarterCard,
  TEMPLATE_ACCENTS,
  TeamTemplateCard,
} from "./TeamTemplateCard";
import { trackEvent } from "../lib/analytics";
import type { AgentRuntime } from "@/app/lib/perkosApi";

const ICONS: Record<string, LucideIcon> = {
  Briefcase,
  Calculator,
  GraduationCap,
  Hammer,
  HeartPulse,
  Home,
  Palette,
  Rocket,
  ShoppingCart,
  Sparkles,
  UtensilsCrossed,
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

/** Roles offered first when building a team; the rest sit behind More roles. */
const SUGGESTED_ROLE_IDS = ["researcher", "analyst", "marketing", "support", "sales", "builder"];

export default function NewProjectWizard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { address } = useAppAccount();
  const { activeOrgId } = useActiveOrg();

  // Selection: a business-template id, "my:<id>", or "custom" / "empty".
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The EDITABLE team — seeded from the selection; templates are only the
  // recommended starting point, the user adds/removes roles freely.
  const [teamRoles, setTeamRoles] = useState<CompanyRole[]>([]);
  const [seedJson, setSeedJson] = useState("[]");
  const [projectName, setProjectName] = useState("");
  const [goal, setGoal] = useState("");
  // Who runs the team: launch managed agents, register a new external agent,
  // or reuse agents that are already registered to this wallet.
  const [agentSource, setAgentSource] = useState<"perkos" | "invite" | "existing">("perkos");
  const [walletAgents, setWalletAgents] = useState<AgentRow[]>([]);
  const [loadingWalletAgents, setLoadingWalletAgents] = useState(false);
  const [existingAgentNames, setExistingAgentNames] = useState<string[]>([]);
  const [existingPm, setExistingPm] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [myTemplates, setMyTemplates] = useState<TeamTemplate[]>([]);
  // Until the person picks, the model follows their access: PerkOS LLM when
  // the wallet is approved for it, otherwise their own key.
  const [llmChoice, setLlmMode] = useState<"perkos" | "byok" | null>(null);
  const llmAccess = useQuery({
    queryKey: ["llm-access", address],
    queryFn: fetchLlmAccess,
    enabled: Boolean(address),
  });
  const ecsAccess = useQuery({
    queryKey: ["ecs-access", address],
    queryFn: fetchEcsAccess,
    enabled: Boolean(address),
  });
  const llmAllowed = llmAccess.data?.allowed === true;
  const llmMode = llmChoice ?? (llmAllowed ? "perkos" : "byok");
  const [byokProvider, setByokProvider] = useState(PROVIDERS[0]?.id ?? "openai");
  const [byokModel, setByokModel] = useState(PROVIDERS[0]?.defaultModel ?? "");
  const [byokKey, setByokKey] = useState("");
  const [launching, setLaunching] = useState(false);
  const [progress, setProgress] = useState("");
  // One id per team being configured: a retry after a lost answer returns the
  // project the server already created instead of launching the team twice.
  const launchRequestId = useRef<string | null>(null);
  // Only the browser-driven fallback (older API) needs this tab kept open.
  const [launchingInBrowser, setLaunchingInBrowser] = useState(false);
  const [showAllRoles, setShowAllRoles] = useState(false);
  const [runsOpen, setRunsOpen] = useState(false);

  useEffect(() => {
    if (!address) return;
    listTeamTemplates(address)
      .then(setMyTemplates)
      .catch(() => {});
  }, [address]);

  useEffect(() => {
    if (!address || agentSource !== "existing") return;
    let cancelled = false;
    getWalletAgents(address)
      .then((agents) => {
        if (!cancelled) setWalletAgents(agents);
      })
      .catch((error) => {
        if (!cancelled) {
          setWalletAgents([]);
          toast.error(t("companyNew.config.existingLoadError"), {
            description: error instanceof Error ? error.message : String(error),
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingWalletAgents(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, agentSource, t]);

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
    launchRequestId.current = null;
    setSelectedId(id);
    setTeamRoles(seeded);
    setSeedJson(JSON.stringify(seeded));
    setProjectName("");
    setGoal("");
    setAgentSource("perkos");
    setExistingAgentNames([]);
    setExistingPm("");
    setSaveAsTemplate(false);
    setTemplateName("");
  }

  function removeRole(roleName: string) {
    setTeamRoles((prev) => withValidPm(prev.filter((r) => r.role !== roleName)));
  }

  function setLeadRole(roleName: string) {
    setTeamRoles((prev) => prev.map((r) => ({ ...r, isPM: r.role === roleName })));
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

  function toggleExistingAgent(name: string) {
    setExistingAgentNames((current) => {
      if (current.includes(name)) {
        const next = current.filter((item) => item !== name);
        if (existingPm === name) setExistingPm(next[0] ?? "");
        return next;
      }
      const next = [...current, name];
      if (!existingPm) setExistingPm(name);
      return next;
    });
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
    if (roles.length > 0 && agentSource === "perkos") {
      if (ecsAccess.data?.allowed !== true) {
        toast.error(t("companyNew.config.infraApprovalRequired"));
        return;
      }
      if (llmMode === "perkos" && !llmAllowed) {
        toast.error(t("companyNew.launch.enterKey"));
        return;
      }
    }
    if (mode !== "empty" && agentSource !== "existing" && roles.length === 0) {
      toast.error(t("companyNew.launch.pickRole"));
      return;
    }
    if (mode !== "empty" && agentSource === "existing" && existingAgentNames.length === 0) {
      toast.error(t("companyNew.launch.pickExistingAgent"));
      return;
    }
    if (
      roles.length > 0 &&
      agentSource === "perkos" &&
      llmMode === "byok" &&
      !byokKey.trim()
    ) {
      toast.error(t("companyNew.launch.enterKey"));
      return;
    }
    setLaunching(true);
    try {
      // The server launches the whole team, so the owner can leave right after
      // this call. An API without the endpoint answers null: the browser then
      // launches the team below, as it always did.
      if (agentSource !== "existing" && roles.length > 0) {
        setProgress(t("companyNew.launch.creatingProject"));
        launchRequestId.current ??= newTeamLaunchRequestId();
        const names = teamAgentNames(slugify(projectName), roles.map((r) => slugify(r.role)));
        const started = await launchTeam({
          requestId: launchRequestId.current,
          name: projectName.trim(),
          goal: goal.trim() || tmpl?.blurb || "",
          orgId: activeOrgId ?? undefined,
          templateId: tmpl?.id ?? myTmpl?.baseTemplateId ?? undefined,
          llm:
            agentSource === "perkos" && llmMode === "byok"
              ? { modelKey: byokKey.trim(), llmBaseUrl: byokBaseUrl(byokProvider), llmModel: byokModel.trim() }
              : undefined,
          roles: roles.map((role, i) => {
            const name = names[i] ?? teamAgentName(slugify(projectName), slugify(role.role));
            const base = { name, role: role.role, runtime: role.runtime, lead: Boolean(role.isPM) };
            if (agentSource === "invite") {
              return { ...base, external: { runtimeKind: "custom" as const, note: role.role } };
            }
            const r = resolveRole(role, name);
            return { ...base, soul: r.soul || undefined, plugins: r.plugins, skills: r.skills };
          }),
        });
        if (started) {
          if (saveAsTemplate) {
            await saveTeamTemplate({
              walletAddress: address,
              name:
                templateName.trim() ||
                t("companyNew.launch.defaultTemplateName", { name: projectName.trim() }),
              baseTemplateId: tmpl?.id ?? myTmpl?.baseTemplateId ?? null,
              roles,
            }).catch(() => {
              toast.warning(t("companyNew.launch.templateSaveFailed"));
            });
          }
          toast.success(
            agentSource === "invite"
              ? t("companyNew.launch.invitesRegistered", { count: roles.length })
              : t("companyNew.launch.teamLaunching", {
                  name: tmpl?.name ?? myTmpl?.name ?? t("companyNew.launch.yourTeamFallback"),
                }),
            {
              description:
                agentSource === "invite"
                  ? t("companyNew.launch.descInvite")
                  : t("companyNew.launch.descServer"),
            },
          );
          const templateId = tmpl?.id ?? (myTmpl ? "saved_template" : mode);
          trackEvent("project_created", { creation_flow: "company_wizard", template_id: templateId });
          trackEvent("team_created", {
            creation_flow: "company_wizard",
            agent_source: agentSource,
            team_size: roles.length,
            template_id: templateId,
          });
          router.push(`/projects/${started.projectId}`);
          return;
        }
        setLaunchingInBrowser(true);
      }

      // Resolve the active runtime image per runtime FIRST — without an
      // imageTag the launch route registers the agent but never provisions an
      // ECS service ("no service"), so the whole team would be dead-on-arrival.
      let tagFor: (rt: AgentRuntime) => string | null = () => null;
      if (roles.length > 0 && agentSource === "perkos") {
        setProgress(t("companyNew.launch.resolvingImages"));
        const runtimes = await fetchActiveRuntimes();
        tagFor = (rt) => runtimes[rt]?.[0]?.primaryTag ?? null;
        for (const role of roles) {
          if (!tagFor(role.runtime)) {
            throw new Error(
              t("companyNew.launch.noRuntimeImage", { runtime: role.runtime }),
            );
          }
        }
      }

      setProgress(t("companyNew.launch.creatingProject"));
      const { project } = await createWalletProject({
        walletAddress: address,
        name: projectName.trim(),
        goal: goal.trim() || tmpl?.blurb || "",
        orgId: activeOrgId ?? undefined,
      });
      const projectId = project.id;
      if (!projectId) throw new Error(t("companyNew.launch.projectNoId"));

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
      if (agentSource === "existing") {
        launched.push(...buildExistingTeamRoster(existingAgentNames, existingPm));
      } else {
        let i = 0;
        // One shared project prefix for the whole team.
        const names = teamAgentNames(slug, roles.map((r) => slugify(r.role)));
        for (const role of roles) {
          i++;
          const reqName = names[i - 1] ?? teamAgentName(slug, slugify(role.role));
          if (agentSource === "invite") {
            setProgress(
              t("companyNew.launch.registering", {
                role: role.role,
                current: i,
                total: roles.length,
              }),
            );
            const res = await inviteAgent({
              name: reqName,
              runtimeKind: "custom",
              note: role.role,
            });
            launched.push({ name: res.agentName, isPM: role.isPM });
          } else {
            setProgress(
              t("companyNew.launch.launchingRole", {
                role: role.role,
                current: i,
                total: roles.length,
              }),
            );
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
      }

      if (launched.length > 0) {
        setProgress(t("companyNew.launch.assigningTeam"));
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
      if (agentSource !== "existing" && saveAsTemplate && roles.length > 0) {
        setProgress(t("companyNew.launch.savingTemplate"));
        await saveTeamTemplate({
          walletAddress: address,
          name:
            templateName.trim() ||
            t("companyNew.launch.defaultTemplateName", { name: projectName.trim() }),
          baseTemplateId: tmpl?.id ?? myTmpl?.baseTemplateId ?? null,
          roles,
        }).catch(() => {
          toast.warning(t("companyNew.launch.templateSaveFailed"));
        });
      }

      toast.success(
        launched.length === 0
          ? t("companyNew.launch.projectCreated")
          : agentSource === "existing"
            ? t("companyNew.launch.existingAssigned", { count: launched.length })
            : agentSource === "invite"
              ? t("companyNew.launch.invitesRegistered", { count: launched.length })
              : t("companyNew.launch.teamLaunched", {
                  name: tmpl?.name ?? myTmpl?.name ?? t("companyNew.launch.yourTeamFallback"),
                }),
        {
          description:
            launched.length === 0
              ? t("companyNew.launch.descNoAgents")
              : agentSource === "existing"
                ? t("companyNew.launch.descExisting")
                : agentSource === "invite"
                  ? t("companyNew.launch.descInvite")
                  : t("companyNew.launch.descPerkos"),
        },
      );
      trackEvent("project_created", {
        creation_flow: "company_wizard",
        template_id: tmpl?.id ?? (myTmpl ? "saved_template" : mode),
      });
      if (launched.length > 0) {
        trackEvent("team_created", {
          creation_flow: "company_wizard",
          agent_source: agentSource,
          team_size: launched.length,
          template_id: tmpl?.id ?? (myTmpl ? "saved_template" : mode),
        });
      }
      router.push(`/projects/${projectId}`);
    } catch (e) {
      toast.error(t("companyNew.launch.createError"), {
        description: e instanceof Error ? e.message : String(e),
      });
      setLaunching(false);
      setLaunchingInBrowser(false);
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
    const configuredTeamSize =
      agentSource === "existing" ? existingAgentNames.length : teamSize;
    const canSaveTemplate =
      agentSource !== "existing" && teamSize > 0 && (mode === "custom" || modified);
    // What the summary lists: picked agents, or the roles about to start.
    const summaryNames = agentSource === "existing" ? existingAgentNames : teamRoles.map((r) => r.role);
    const runsSummary = [
      agentSource === "existing"
        ? t("companyNew.config.sourceExisting")
        : agentSource === "invite"
          ? t("companyNew.config.sourceInvite")
          : t("companyNew.config.sourcePerkos"),
      agentSource === "perkos" && teamSize > 0
        ? llmMode === "byok" ? t("companyNew.config.llmByok") : t("companyNew.config.llmPerkos")
        : null,
    ].filter(Boolean).join(" · ");
    // Open the setup on its own when it is not the default one.
    const runsNeedAttention = agentSource !== "perkos" || (teamSize > 0 && llmMode === "byok");
    return (
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => !launching && setSelectedId(null)}
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("companyNew.config.back")}
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
                    ? t("companyNew.config.customTeamTitle")
                    : t("companyNew.config.emptyProjectTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tmpl
                ? tmpl.blurb
                : myTmpl
                  ? t("companyNew.config.myTeamSubtitle")
                  : mode === "custom"
                    ? t("companyNew.config.customTeamSubtitle")
                    : t("companyNew.config.emptyProjectSubtitle")}
            </p>
          </div>
        </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        {/* Project name */}
        <section className="flex flex-col gap-2">
          <label htmlFor="company-name" className="text-sm font-medium text-foreground">
            {t("companyNew.config.nameLabel")}
          </label>
          <Input
            id="company-name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder={t("companyNew.config.namePlaceholder")}
            disabled={launching}
            maxLength={48}
          />
        </section>

        {/* Goal — feeds the PM's planning */}
        <section className="flex flex-col gap-2">
          <label htmlFor="project-goal" className="text-sm font-medium text-foreground">
            {configuredTeamSize > 0
              ? t("companyNew.config.goalLabelTeam")
              : t("companyNew.config.goalLabelProject")}
          </label>
          <textarea
            id="project-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={
              tmpl
                ? t("companyNew.config.goalPlaceholderDefault", { blurb: tmpl.blurb })
                : t("companyNew.config.goalPlaceholder")
            }
            disabled={launching}
            rows={3}
            maxLength={500}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
          {configuredTeamSize > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("companyNew.config.goalHint")}
            </p>
          ) : null}
        </section>

        {/* Team editor — recommended roles, fully editable */}
        {mode !== "empty" && agentSource !== "existing" ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-foreground">
              {t("companyNew.config.teamHeading", { count: teamRoles.length })}
            </h2>
            <p className="text-xs text-muted-foreground">
              {mode === "template"
                ? t("companyNew.config.teamHintTemplate")
                : t("companyNew.config.teamHintCustom")}
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {teamRoles.map((role) => (
                <li
                  key={role.role}
                  className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <AgentOrb name={role.role} size={24} />
                  <span className="min-w-0 truncate text-foreground">{role.role}</span>
                  {/* The lead is always visible and can be changed, so removing
                      the template's lead never promotes someone silently. */}
                  <button
                    type="button"
                    onClick={() => setLeadRole(role.role)}
                    disabled={launching}
                    aria-pressed={Boolean(role.isPM)}
                    title={t("companyNew.config.leadTitle")}
                    className={cn(
                      "ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                      role.isPM
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {t("companyNew.config.lead")}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRole(role.role)}
                    disabled={launching}
                    aria-label={t("companyNew.config.removeRoleAria", { role: role.role })}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {teamRoles.length === 0 ? (
                <li className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                  {t("companyNew.config.noRoles")}
                </li>
              ) : null}
            </ul>

            {addablePresets.length > 0 ? (
              <div className="mt-1 flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{showAllRoles ? t("companyNew.config.addRole") : t("companyNew.config.suggestedRoles")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {(showAllRoles ? addablePresets : addablePresets.filter((p) => SUGGESTED_ROLE_IDS.includes(p.id))).map((p) => (
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
                  {addablePresets.some((p) => !SUGGESTED_ROLE_IDS.includes(p.id)) ? (
                    <button
                      type="button"
                      onClick={() => setShowAllRoles((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-primary hover:underline"
                    >
                      {showAllRoles ? t("companyNew.config.fewerRoles") : t("companyNew.config.moreRoles")}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {mode !== "empty" ? (
          <details
            open={runsOpen || runsNeedAttention}
            onToggle={(e) => setRunsOpen(e.currentTarget.open)}
            className="group rounded-xl border border-border bg-card/40"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="font-medium text-foreground">{t("companyNew.config.runsHeading")}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {runsSummary}
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="flex flex-col gap-5 border-t border-border px-4 py-4">
        {/* Agent source — managed PerkOS agents vs the user's own */}
        {(
          <section className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">{t("companyNew.config.sourceHeading")}</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                  {t("companyNew.config.sourcePerkos")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("companyNew.config.sourcePerkosDesc")}
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
                  {t("companyNew.config.sourceInvite")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("companyNew.config.sourceInviteDesc")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (agentSource !== "existing") setLoadingWalletAgents(true);
                  setAgentSource("existing");
                }}
                disabled={launching}
                className={cn(
                  "flex flex-col gap-1 rounded-md border p-3 text-left text-sm transition-colors",
                  agentSource === "existing"
                    ? "border-primary/60 bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  {agentSource === "existing" ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Users className="h-3.5 w-3.5" />
                  )}
                  {t("companyNew.config.sourceExisting")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("companyNew.config.sourceExistingDesc")}
                </span>
              </button>
            </div>

            {agentSource === "existing" ? (
              <div className="mt-1 flex flex-col gap-2 rounded-md border border-border bg-card p-3">
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    {t("companyNew.config.existingHeading", {
                      count: existingAgentNames.length,
                    })}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t("companyNew.config.existingHint")}
                  </p>
                </div>

                {loadingWalletAgents ? (
                  <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("companyNew.config.existingLoading")}
                  </p>
                ) : walletAgents.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                    {t("companyNew.config.existingEmpty")}
                  </p>
                ) : (
                  <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
                    {walletAgents.map((agent) => {
                      const selected = existingAgentNames.includes(agent.name);
                      return (
                        <li
                          key={agent.id}
                          className={cn(
                            "flex items-center gap-3 rounded-md border px-3 py-2",
                            selected
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-background",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleExistingAgent(agent.name)}
                            disabled={launching}
                            aria-label={t("companyNew.config.selectExistingAria", {
                              name: agent.name,
                            })}
                            className="h-4 w-4 accent-primary"
                          />
                          <Bot className="h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {agent.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {agent.runtime}
                              {agent.external
                                ? ` · ${t("companyNew.config.externalAgent")}`
                                : ""}
                            </p>
                          </div>
                          {selected ? (
                            <label
                              className={cn(
                                "flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                existingPm === agent.name
                                  ? "border-primary/40 bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/40",
                              )}
                              title={t("companyNew.config.leadTitle")}
                            >
                              <input
                                type="radio"
                                name="existing-pm"
                                checked={existingPm === agent.name}
                                onChange={() => setExistingPm(agent.name)}
                                disabled={launching}
                                className="sr-only"
                              />
                              {t("companyNew.config.lead")}
                            </label>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </section>
        )}

        {/* LLM choice — only when WE host the agents */}
        {teamSize > 0 && agentSource === "perkos" ? (
        <section className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">{t("companyNew.config.llmHeading")}</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setLlmMode("perkos")}
              disabled={launching || !llmAllowed}
              className={cn(
                "flex flex-col gap-1 rounded-md border p-3 text-left text-sm transition-colors",
                llmMode === "perkos"
                  ? "border-primary/60 bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                {llmMode === "perkos" ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                {t("companyNew.config.llmPerkos")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("companyNew.config.llmPerkosDesc")}
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
                {t("companyNew.config.llmByok")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("companyNew.config.llmByokDesc")}
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
                  placeholder={t("companyNew.config.modelPlaceholder")}
                  disabled={launching}
                  className="h-9 min-w-0 flex-1 font-mono text-xs"
                />
              </div>
              <Input
                value={byokKey}
                onChange={(e) => setByokKey(e.target.value)}
                placeholder={t("companyNew.config.keyPlaceholder")}
                disabled={launching}
                type="password"
                className="h-9 font-mono text-xs"
              />
            </div>
          ) : null}
        </section>
        ) : null}

            </div>
          </details>
        ) : null}
      </div>
      <aside className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-card/70 p-4 shadow-[0_0_40px_-24px_rgba(236,27,105,.6)] lg:sticky lg:top-4">
        <div className="flex items-center gap-3">
          <Image src="/runtime/sparky-head.webp" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t("companyNew.config.sparkyCoordinates")}</p>
            <p className="text-xs text-muted-foreground">{t("companyNew.config.readyHint")}</p>
          </div>
        </div>
        {mode !== "empty" ? (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t("companyNew.config.summaryTitle")}</span>
            {summaryNames.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {summaryNames.map((name) => (
                  <li key={name} className="flex items-center gap-2 text-sm text-foreground">
                    <AgentOrb name={name} size={22} />
                    <span className="min-w-0 truncate">{name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{t("companyNew.config.noTeamYet")}</p>
            )}
          </div>
        ) : null}
        {/* Save the edited team as a personal template */}
        {canSaveTemplate ? (
          <section className="flex flex-col gap-2 rounded-md border border-border bg-background/60 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={saveAsTemplate}
                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                disabled={launching}
                className="h-3.5 w-3.5"
              />
              {t("companyNew.config.saveTemplateLabel")}
            </label>
            {saveAsTemplate ? (
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={t("companyNew.config.saveTemplatePlaceholder", {
                  name: projectName.trim() || t("companyNew.config.saveTemplatePlaceholderFallback"),
                })}
                disabled={launching}
                maxLength={48}
                className="h-9"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("companyNew.config.saveTemplateHint")}
              </p>
            )}
          </section>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button
            onClick={launchCompany}
            disabled={
              launching ||
              !projectName.trim() ||
              !address ||
              (mode !== "empty" &&
                (agentSource === "existing"
                  ? existingAgentNames.length === 0 || !existingPm
                  : teamRoles.length === 0))
            }
            className="w-full gap-2"
          >
            {launching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            {launching
              ? progress || t("companyNew.config.launching")
              : mode === "empty"
                ? t("companyNew.config.createProject")
                : agentSource === "existing"
                  ? t("companyNew.config.existingButton", {
                      count: existingAgentNames.length,
                    })
                  : agentSource === "invite"
                    ? t("companyNew.config.inviteButton", { count: teamRoles.length })
                    : t("companyNew.config.startTeam", { count: teamRoles.length })}
          </Button>
          {launching && launchingInBrowser ? (
            <span className="text-xs text-muted-foreground">
              {t("companyNew.config.dontClose")}
            </span>
          ) : null}
        </div>
      </aside>
      </div>
      </div>
    );
  }

  // ---- Gallery step ---------------------------------------------------------
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium text-foreground">{t("companyNew.gallery.title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("companyNew.gallery.intro")}
          <button
            type="button"
            onClick={() => router.push("/agents/new")}
            className="text-primary underline-offset-2 hover:underline"
          >
            {t("companyNew.gallery.introLink")}
          </button>
          {t("companyNew.gallery.introAfter")}
        </p>
      </header>

      <ProjectTemplateGallery />

      {/* Build-your-own starting points */}
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <li>
          <StarterCard
            title={t("companyNew.gallery.customCard.title")}
            kicker={t("companyNew.gallery.customCard.kicker")}
            blurb={t("companyNew.gallery.customCard.blurb")}
            cta={t("companyNew.gallery.customCard.cta")}
            icon={Users}
            accent={BRAND_ACCENT}
            emphasized
            // Sparky coordinates every team, so a custom team starts with no
            // lead role: the owner adds the specialists the project needs.
            onSelect={() => select("custom", [])}
          />
        </li>
        <li>
          <StarterCard
            title={t("companyNew.gallery.emptyCard.title")}
            kicker={t("companyNew.gallery.emptyCard.kicker")}
            blurb={t("companyNew.gallery.emptyCard.blurb")}
            cta={t("companyNew.gallery.emptyCard.cta")}
            icon={Briefcase}
            accent="#8b87a8"
            onSelect={() => select("empty", [])}
          />
        </li>
      </ul>

      {/* Personal templates */}
      {myTemplates.length > 0 ? (
        <>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {t("companyNew.gallery.myTemplates")}
          </h2>
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {myTemplates.map((t2) => {
              const roles = (t2.roles as CompanyRole[]) ?? [];
              return (
                <li key={t2.id} className="relative">
                  <TeamTemplateCard
                    name={t2.name}
                    kicker={t("companyNew.gallery.myTemplateKicker")}
                    blurb={t("companyNew.gallery.myTemplateBlurb")}
                    icon={Users}
                    accent={BRAND_ACCENT}
                    roles={roles}
                    onSelect={() => select(`my:${t2.id}`, roles)}
                    titlePadding
                  />
                  <button
                    type="button"
                    aria-label={t("companyNew.gallery.deleteTemplateAria", { name: t2.name })}
                    title={t("companyNew.gallery.deleteTemplateTitle")}
                    onClick={() => {
                      if (!address) return;
                      if (!window.confirm(t("companyNew.gallery.deleteTemplateConfirm", { name: t2.name }))) return;
                      deleteTeamTemplate({ walletAddress: address, templateId: t2.id })
                        .then(() =>
                          setMyTemplates((prev) => prev.filter((x) => x.id !== t2.id)),
                        )
                        .catch(() => toast.error(t("companyNew.gallery.deleteTemplateError")));
                    }}
                    className="absolute right-3 top-3 p-1 text-muted-foreground hover:text-destructive"
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
        {t("companyNew.gallery.businessTemplates")}
      </h2>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {COMPANY_TEMPLATES.map((t2) => (
          <li key={t2.id}>
            <TeamTemplateCard
              name={t2.name}
              kicker={INDUSTRY_LABELS[t2.industry] ?? t2.industry}
              blurb={t2.blurb}
              icon={ICONS[t2.icon] ?? Bot}
              accent={TEMPLATE_ACCENTS[t2.industry] ?? BRAND_ACCENT}
              roles={t2.roles}
              onSelect={() => select(t2.id, t2.roles)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
