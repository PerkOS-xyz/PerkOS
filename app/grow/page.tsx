import { redirect } from "next/navigation";

const DEFAULT_GROW_DIAGNOSTIC_URL = "https://grow.perkos.xyz/diagnostic";

export default function GrowEntryPage() {
  redirect(process.env.NEXT_PUBLIC_GROW_URL ?? DEFAULT_GROW_DIAGNOSTIC_URL);
}
