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
      { icon: Home, label: "Dashboard", href: "/dashboard", shortcut: "g d" },
      { icon: Folder, label: "Projects", href: "/projects", shortcut: "g p" },
      { icon: ListTodo, label: "Tasks", href: "/tasks", shortcut: "g t" },
      { icon: Bot, label: "Agents", href: "/agents", shortcut: "g a" },
      { icon: MessageSquare, label: "Chat", href: "/chat", shortcut: "g c" },
      { icon: Settings, label: "Settings", href: "/settings", shortcut: "g s" },
    ],
    []
  );

  const createItems = useMemo(
    () => [
      { icon: Folder, label: "Create project", href: "/projects/new", shortcut: "c p" },
      { icon: ListTodo, label: "Create task", href: "/tasks/new", shortcut: "c t" },
      { icon: Bot, label: "Register agent", href: "/agents/new", shortcut: "c a" },
      { icon: Briefcase, label: "Create organization", href: "/organizations/new", shortcut: "c o" },
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
      title="Command menu"
      description="Search and jump to any project, task, agent, or screen."
    >
      <CommandInput placeholder="Type a command, project, or agent…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {navItems.map(({ icon: Icon, label, href, shortcut }) => (
            <CommandItem
              key={href}
              value={`nav ${label}`}
              onSelect={() => go(href)}
            >
              <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{label}</span>
              <ShortcutHint hint={shortcut} />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Create new">
          {createItems.map(({ icon: Icon, label, href, shortcut }) => (
            <CommandItem
              key={href}
              value={`create ${label}`}
              onSelect={() => go(href)}
            >
              <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
              <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{label}</span>
              <ShortcutHint hint={shortcut} />
            </CommandItem>
          ))}
        </CommandGroup>

        {projects.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
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
            <CommandGroup heading="Agents">
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

        <CommandGroup heading="Actions">
          <CommandItem
            value="open perkos agent"
            onSelect={() => {
              setOpen(false);
              setChatbotOpen(true);
            }}
          >
            <Sparkles className="mr-2 h-4 w-4 text-primary" />
            Open PerkOS Agent
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
            Disconnect wallet
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
