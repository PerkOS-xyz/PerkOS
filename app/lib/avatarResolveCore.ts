/**
 * On-chain avatar resolution (ENS + Basename), pure viem — no Firebase, no
 * "server-only", so it runs on BOTH the server (login hook) and the client
 * (Settings "refresh"). Uses the existing NEXT_PUBLIC_ALCHEMY_API_KEY for
 * reliable RPC (OnchainKit's default public RPC was flaky, and its server
 * import breaks with our wagmi version).
 *
 *   ENS      — mainnet reverse (getEnsName) + avatar text record (getEnsAvatar),
 *              which normalizes ipfs:// and eip155 NFT avatars to https URLs.
 *   Basename — Base L2 Resolver reverse `name(node)` under the base reverse
 *              namespace (0x80002105.reverse), then the avatar text record via
 *              getEnsAvatar with the L2 resolver as universalResolverAddress
 *              (reverts when no avatar is set → null).
 */
import {
  createPublicClient,
  encodePacked,
  http,
  keccak256,
  namehash,
  type Address,
} from "viem";
import { base, mainnet } from "viem/chains";
import { normalize } from "viem/ens";

const BASE_L2_RESOLVER: Address = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD";
const BASE_REVERSE_NODE = namehash("80002105.reverse");
const L2_NAME_ABI = [
  {
    inputs: [{ name: "node", type: "bytes32" }],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export type ResolvedAvatars = {
  ensName: string | null;
  ensAvatarUrl: string | null;
  basename: string | null;
  basenameAvatarUrl: string | null;
};

function rpc(network: string, key?: string): string | undefined {
  return key ? `https://${network}.g.alchemy.com/v2/${key}` : undefined;
}

/** The reverse-registrar node for an address under the Base reverse namespace. */
function baseReverseNode(address: string) {
  const label = keccak256(
    encodePacked(["string"], [address.toLowerCase().slice(2)])
  );
  return keccak256(
    encodePacked(["bytes32", "bytes32"], [BASE_REVERSE_NODE, label])
  );
}

export async function resolveOnchainAvatars(
  address: string,
  alchemyKey?: string
): Promise<ResolvedAvatars> {
  const addr = address as Address;
  const mainnetClient = createPublicClient({
    chain: mainnet,
    transport: http(rpc("eth-mainnet", alchemyKey)),
  });
  const baseClient = createPublicClient({
    chain: base,
    transport: http(rpc("base-mainnet", alchemyKey)),
  });

  // ENS (mainnet)
  const ensName = await mainnetClient
    .getEnsName({ address: addr })
    .catch(() => null);
  const ensAvatarUrl = ensName
    ? await mainnetClient
        .getEnsAvatar({ name: normalize(ensName) })
        .catch(() => null)
    : null;

  // Basename (Base L2)
  const basenameRaw = await baseClient
    .readContract({
      address: BASE_L2_RESOLVER,
      abi: L2_NAME_ABI,
      functionName: "name",
      args: [baseReverseNode(addr)],
    })
    .catch(() => "");
  const basename =
    basenameRaw && basenameRaw.endsWith(".base.eth") ? basenameRaw : null;
  const basenameAvatarUrl = basename
    ? await baseClient
        .getEnsAvatar({
          name: normalize(basename),
          universalResolverAddress: BASE_L2_RESOLVER,
        })
        .catch(() => null)
    : null;

  return {
    ensName: ensName ?? null,
    ensAvatarUrl: ensAvatarUrl ?? null,
    basename,
    basenameAvatarUrl: basenameAvatarUrl ?? null,
  };
}

/** The auto-default display source given a resolution: ENS → Basename → default. */
export function defaultSourceFor(r: ResolvedAvatars): "ens" | "basename" | "default" {
  if (r.ensAvatarUrl) return "ens";
  if (r.basenameAvatarUrl) return "basename";
  return "default";
}
