"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useConnection, useDisconnect } from "wagmi";
import {
  ArrowRight,
  Bot,
  Briefcase,
  Folder,
  Home,
  ListTodo,
  LogOut,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

import {
  getWalletAgents,
  getWalletProjects,
} from "../lib/perkosApi";
import { useChatbot } from "./ChatbotProvider";

export function CommandMenu() {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { address, isConnected } = useConnection();
  const { disconnect } = useDisconnect();
  const { setOpen: setChatbotOpen } = useChatbot();

  // ⌘K / Ctrl+K to toggle
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const projectsQuery = useQuery({
    queryKey: ["wallet-projects", address],
    queryFn: () => getWalletProjects(address!),
    enabled: open && isConnected && Boolean(address),
  });

  const agentsQuery = useQuery({
    queryKey: ["wallet-agents", address],
    queryFn: () => getWalletAgents(address!),
    enabled: open && isConnected && Boolean(address),
  });

  const projects = projectsQuery.data?.projects ?? [];
  const agents = agentsQuery.data ?? [];

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const navItems = useMemo(
    () => [
      { icon: Home, labelKey: "nav.dashboard", href: "/dashboard", shortcut: "g d" },
      { icon: Folder, labelKey: "nav.projects", href: "/projects", shortcut: "g p" },
      { icon: ListTodo, labelKey: "nav.tasks", href: "/tasks", shortcut: "g t" },
      { icon: Bot, labelKey: "nav.agents", href: "/agents", shortcut: "g a" },
      { icon: MessageSquare, labelKey: "nav.chat", href: "/chat", shortcut: "g c" },
      { icon: Settings, labelKey: "nav.settings", href: "/settings", shortcut: "g s" },
    ],
    []
  );

  const createItems = useMemo(
    () => [
      { icon: Folder, labelKey: "chrome.commandMenu.createProject", href: "/projects/new", shortcut: "c p" },
      { icon: ListTodo, labelKey: "chrome.commandMenu.createTask", href: "/tasks/new", shortcut: "c t" },
      { icon: Bot, labelKey: "chrome.commandMenu.registerAgent", href: "/agents/new", shortcut: "c a" },
      { icon: Briefcase, labelKey: "chrome.commandMenu.createOrganization", href: "/organizations/new", shortcut: "c o" },
    ],
    []
  );

  // Plain letter shortcuts (without modifier) — Linear-style
  useEffect(() => {
    let buffer = "";
    let timer: number | null = null;

    function reset() {
      buffer = "";
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (open) return; // don't interfere with the menu's own input

      const key = e.key.toLowerCase();
      if (!/^[a-z]$/.test(key)) {
        reset();
        return;
      }

      buffer += key;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(reset, 700);

      const match = [...navItems, ...createItems].find(
        (i) => i.shortcut.replace(/\s+/g, "") === buffer
      );
      if (match) {
        e.preventDefault();
        reset();
        router.push(match.href);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      reset();
    };
  }, [router, open, navItems, createItems]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t("chrome.commandMenu.title")}
      description={t("chrome.commandMenu.description")}
    >
      <CommandInput placeholder={t("chrome.commandMenu.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("chrome.commandMenu.noResults")}</CommandEmpty>

        <CommandGroup heading={t("chrome.commandMenu.navigation")}>
          {navItems.map(({ icon: Icon, labelKey, href, shortcut }) => (
            <CommandItem
              key={href}
              value={`nav ${t(labelKey)}`}
              onSelect={() => go(href)}
            >
              <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{t(labelKey)}</span>
              <ShortcutHint hint={shortcut} />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("chrome.commandMenu.createNew")}>
          {createItems.map(({ icon: Icon, labelKey, href, shortcut }) => (
            <CommandItem
              key={href}
              value={`create ${t(labelKey)}`}
              onSelect={() => go(href)}
            >
              <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
              <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{t(labelKey)}</span>
              <ShortcutHint hint={shortcut} />
            </CommandItem>
          ))}
        </CommandGroup>

        {projects.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("nav.projects")}>
              {projects.slice(0, 8).map((p) => (
                <CommandItem
                  key={p.id ?? p.name}
                  value={`project ${p.name}`}
                  onSelect={() =>
                    p.id && go(`/projects/${encodeURIComponent(p.id)}`)
                  }
                >
                  <Folder className="mr-2 h-4 w-4 text-primary" />
                  <span className="truncate">{p.name}</span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {agents.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("nav.agents")}>
              {agents.slice(0, 8).map((a) => (
                <CommandItem
                  key={a.id}
                  value={`agent ${a.name}`}
                  onSelect={() => go(`/agents/${encodeURIComponent(a.id)}`)}
                >
                  <Bot className="mr-2 h-4 w-4 text-primary" />
                  <span className="truncate">{a.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {a.runtime}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        <CommandSeparator />

        <CommandGroup heading={t("chrome.commandMenu.actions")}>
          <CommandItem
            value="open perkos agent"
            onSelect={() => {
              setOpen(false);
              setChatbotOpen(true);
            }}
          >
            <Sparkles className="mr-2 h-4 w-4 text-primary" />
            {t("chrome.commandMenu.openPerkosAgent")}
          </CommandItem>
          <CommandItem
            value="disconnect wallet"
            onSelect={() => {
              setOpen(false);
              disconnect();
              router.replace("/sign-in");
            }}
          >
            <LogOut className="mr-2 h-4 w-4 text-destructive" />
            {t("chrome.commandMenu.disconnectWallet")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function ShortcutHint({ hint }: { hint: string }) {
  return (
    <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
      {hint.split(/\s+/).map((k, i) => (
        <kbd
          key={i}
          className="rounded border border-border bg-muted px-1 py-0.5 font-mono uppercase"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
