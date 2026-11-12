import { normalizeWalletAddress } from "@perkos/shared-types";
import { doc, getDoc } from "firebase/firestore";

import { firebaseDb } from "./firebase";
import { isActiveMembershipStatus } from "./perkosApi";

/**
 * What the signed-in person may do in a project that belongs to someone else.
 *
 * "write": the owner, a co-owner or an editor. They can talk to the
 * project's agents.
 * "read": a Read only member. They follow the project and its chat, and do
 * not write: a message there puts the owner's agents to work.
 *
 * The role comes from the project or from its organization, and the higher of
 * the two wins. This is the same rule the chat server enforces, so the app
 * can leave out a box whose message would be refused. The server is the one
 * that decides; this only keeps the screen honest.
 */
export type ProjectStanding = "write" | "read";

type Membership = { role?: unknown; status?: unknown } | null | undefined;

// The same roles the database rules and the chat server let write. A
// co-owner ("coowner") is an invited wallet with more than an editor.
const WRITERS = ["owner", "coowner", "editor"];

function writes(member: Membership): boolean {
  return Boolean(member) && isActiveMembershipStatus(member?.status) && WRITERS.includes(String(member?.role ?? ""));
}

/**
 * @param me - the signed-in wallet.
 * @param owner - the wallet the project belongs to.
 * @param project - the person's entry in the project's members, if any.
 * @param organization - their entry in the members of the project's organization, if any.
 */
export function projectStanding(input: { me: string; owner: string; project?: Membership; organization?: Membership }): ProjectStanding {
  if (normalizeWalletAddress(input.me) === normalizeWalletAddress(input.owner)) return "write";
  return writes(input.project) || writes(input.organization) ? "write" : "read";
}

/** Read the person's two memberships and say what they may do in the project. */
export async function getProjectStanding(input: { me: string; owner: string; projectId: string; orgId?: string | null }): Promise<ProjectStanding> {
  const me = normalizeWalletAddress(input.me);
  const owner = normalizeWalletAddress(input.owner);
  if (me === owner) return "write";
  const read = async (...path: string[]): Promise<Membership> => {
    // A document the rules do not let this person read is not a role they hold.
    const snap = await getDoc(doc(firebaseDb(), "wallets", owner, ...path, "members", me)).catch(() => null);
    return snap?.exists() ? (snap.data() as Membership) : null;
  };
  const project = await read("projects", input.projectId);
  if (writes(project)) return "write";
  const organization = input.orgId ? await read("organizations", input.orgId) : null;
  return projectStanding({ me, owner, project, organization });
}
