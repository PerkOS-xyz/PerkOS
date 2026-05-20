// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {PerkosReceiptAnchor} from "../src/PerkosReceiptAnchor.sol";

/**
 * @title Deploy
 * @notice Deploys an implementation contract and an ERC1967Proxy in front
 *         of it, initialized with the supplied owner address.
 *
 * Usage:
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url $RPC_URL \
 *     --broadcast \
 *     --verify \
 *     --sig 'run(address)' $SAFE_OWNER
 *
 * The owner address SHOULD be a Gnosis Safe or timelock — granting it to
 * an EOA gives a single compromised key the ability to push malicious
 * implementations under existing users.
 */
contract Deploy is Script {
    function run(address owner) external returns (address proxy, address implementation) {
        require(owner != address(0), "Deploy: owner cannot be zero");

        vm.startBroadcast();

        PerkosReceiptAnchor impl = new PerkosReceiptAnchor();
        implementation = address(impl);

        bytes memory initCalldata = abi.encodeCall(
            PerkosReceiptAnchor.initialize,
            (owner)
        );
        ERC1967Proxy p = new ERC1967Proxy(implementation, initCalldata);
        proxy = address(p);

        vm.stopBroadcast();

        console2.log("PerkosReceiptAnchor implementation:", implementation);
        console2.log("PerkosReceiptAnchor proxy        :", proxy);
        console2.log("Owner                            :", owner);
        console2.log("Wire this PROXY address into the miniapp env:");
        console2.log("  NEXT_PUBLIC_RECEIPT_ANCHOR_ADDRESS=", proxy);
    }
}
