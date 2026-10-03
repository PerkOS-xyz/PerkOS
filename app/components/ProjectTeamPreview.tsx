import { deriveAgentAvatarIdentity } from "../lib/agentAvatarIdentity";
import { templateText, type TemplateTeamRole } from "../lib/projectTemplateTypes";
import { AgentIdentityAvatar } from "./AgentIdentityAvatar";
import { RoleAccessSummary } from "./RoleAccessSummary";

export function ProjectTeamPreview({
  team,
  language,
  title,
}: {
  team: TemplateTeamRole[];
  language: string;
  title?: string;
}) {
  const sorted = [...team].sort((a, b) => a.order - b.order);
  return (
    <section aria-label={title} className="space-y-3">
      {title ? <h2 className="font-semibold">{title}</h2> : null}
      <div className="grid gap-3">
        {sorted.map((role) => (
          <article key={role.roleId} className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
            <div className="flex items-start gap-3">
              <AgentIdentityAvatar identity={deriveAgentAvatarIdentity(role.avatarSeed)} size={52} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{templateText(role.name, language)}</h3>
                  {role.isLead ? (
                    <span className="rounded-full border border-primary/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                      {language.startsWith("es") ? "Líder" : "Lead"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {templateText(role.responsibility, language)}
                </p>
              </div>
            </div>
            <div className="mt-4 border-t border-border/70 pt-3">
              <RoleAccessSummary policy={role.policy} language={language} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
