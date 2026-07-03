import { getName, getAvatar, isBasename } from "@coinbase/onchainkit/identity";
import { base, mainnet } from "viem/chains";
const address = "0xc2564e41B7F5Cb66d2d99466450CfebcE9e8228f";
const ensName = await getName({ address, chain: mainnet }).catch((e) => "ERR: " + (e?.message||e));
console.log("ENS_NAME=" + ensName);
const baseName = await getName({ address, chain: base }).catch((e) => "ERR: " + (e?.message||e));
console.log("BASE_GETNAME=" + baseName + " | isBasename=" + isBasename(baseName || ""));
if (ensName && !String(ensName).startsWith("ERR")) {
  const a = await getAvatar({ ensName, chain: mainnet }).catch((e) => "ERR: " + (e?.message||e));
  console.log("ENS_AVATAR=" + a);
}
const basename = baseName && isBasename(baseName) ? baseName : null;
if (basename) {
  const a = await getAvatar({ ensName: basename, chain: base }).catch((e) => "ERR: " + (e?.message||e));
  console.log("BASENAME_AVATAR=" + a);
}
console.log("DONE");
