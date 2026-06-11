import Link from "next/link";

import { AgentOrb } from "./components/AgentOrb";

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-5"
      style={{
        backgroundColor: "#0e0716",
        backgroundImage:
          "radial-gradient(ellipse 60% 35% at 50% 110%, rgba(236,27,105,0.55) 0%, rgba(236,27,105,0.18) 45%, transparent 75%)",
      }}
    >
      <div className="flex max-w-md flex-col items-center gap-6 rounded-lg border border-[#530922] bg-[#0e0716] p-8 text-center shadow-[0_0_5px_rgba(236,27,105,0.3)]">
        <AgentOrb name="PerkOS Assistant" presetId="assistant" size={72} />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-medium text-[#ececff]">
            This page slipped past the swarm
          </h1>
          <p className="text-sm text-[#7975a8]">
            The URL you tried doesn&apos;t match anything PerkOS knows about.
            Pick a place to go below.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <Link
            href="/dashboard"
            className="flex w-full items-center justify-center rounded-md bg-[#ec1b69] px-4 py-3 text-sm font-medium text-[#ececff] transition-opacity hover:opacity-90"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/chat"
            className="flex w-full items-center justify-center rounded-md border border-[#1b1833] px-4 py-3 text-sm text-[#ececff] transition-colors hover:border-[#530922]"
          >
            Open Chat
          </Link>
        </div>
      </div>
    </div>
  );
}
