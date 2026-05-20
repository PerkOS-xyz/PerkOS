// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {PerkosReceiptAnchor} from "../src/PerkosReceiptAnchor.sol";

/**
 * @title PerkosReceiptAnchorV2
 * @notice Test-only successor implementation used to exercise the upgrade
 *         path. Adds a single new view function. NOT for production.
 */
contract PerkosReceiptAnchorV2 is PerkosReceiptAnchor {
    function v2Pong() external pure returns (string memory) {
        return "v2";
    }
}

contract PerkosReceiptAnchorTest is Test {
    PerkosReceiptAnchor anchor;
    address owner = address(0xA11CE);
    address alice = address(0xB0B1);
    address bob = address(0xC0DE);

    bytes32 constant HASH_A = bytes32(uint256(0xAAAA));
    bytes32 constant HASH_B = bytes32(uint256(0xBBBB));

    event ReceiptAnchored(
        bytes32 indexed receiptId,
        address indexed wallet,
        bytes32 indexed transcriptHash,
        uint64 anchoredAt
    );

    function setUp() public {
        PerkosReceiptAnchor impl = new PerkosReceiptAnchor();
        bytes memory initData = abi.encodeCall(
            PerkosReceiptAnchor.initialize,
            (owner)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        anchor = PerkosReceiptAnchor(address(proxy));
    }

    function test_InitializedWithOwner() public view {
        assertEq(anchor.owner(), owner);
        assertEq(anchor.paused(), false);
        assertEq(anchor.version(), "1.0.0");
    }

    function test_CannotReinitialize() public {
        vm.expectRevert();
        anchor.initialize(alice);
    }

    function test_AnchorEmitsEventAndStoresRecord() public {
        bytes32 receiptId = keccak256("receipt-1");
        vm.prank(alice);
        vm.expectEmit(true, true, true, true, address(anchor));
        emit ReceiptAnchored(receiptId, alice, HASH_A, uint64(block.timestamp));
        anchor.anchor(receiptId, HASH_A);

        (address wallet, bytes32 hash, uint64 ts) = anchor.getAnchor(receiptId);
        assertEq(wallet, alice);
        assertEq(hash, HASH_A);
        assertEq(ts, uint64(block.timestamp));
    }

    function test_VerifyMatchesAndMismatches() public {
        bytes32 receiptId = keccak256("receipt-2");
        vm.prank(alice);
        anchor.anchor(receiptId, HASH_A);
        assertTrue(anchor.verify(receiptId, HASH_A));
        assertFalse(anchor.verify(receiptId, HASH_B));
        assertFalse(anchor.verify(keccak256("unanchored"), HASH_A));
    }

    function test_RejectsZeroHash() public {
        vm.prank(alice);
        vm.expectRevert(PerkosReceiptAnchor.EmptyHash.selector);
        anchor.anchor(keccak256("r"), bytes32(0));
    }

    function test_RejectsDuplicateReceiptId() public {
        bytes32 receiptId = keccak256("dup");
        vm.prank(alice);
        anchor.anchor(receiptId, HASH_A);
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(
                PerkosReceiptAnchor.AlreadyAnchored.selector,
                receiptId
            )
        );
        anchor.anchor(receiptId, HASH_B);
    }

    function test_PauseBlocksAnchoringButNotReads() public {
        vm.prank(owner);
        anchor.pause();

        vm.prank(alice);
        vm.expectRevert();
        anchor.anchor(keccak256("after-pause"), HASH_A);

        // Existing reads still work.
        assertFalse(anchor.verify(keccak256("none"), HASH_A));

        vm.prank(owner);
        anchor.unpause();
        vm.prank(alice);
        anchor.anchor(keccak256("after-unpause"), HASH_A);
    }

    function test_OnlyOwnerCanPause() public {
        vm.prank(alice);
        vm.expectRevert();
        anchor.pause();
    }

    function test_UpgradeFlow_StoragePreservedAndV2Available() public {
        bytes32 receiptId = keccak256("pre-upgrade");
        vm.prank(alice);
        anchor.anchor(receiptId, HASH_A);

        // Pre-upgrade state.
        (address wallet, bytes32 hash, ) = anchor.getAnchor(receiptId);
        assertEq(wallet, alice);
        assertEq(hash, HASH_A);

        PerkosReceiptAnchorV2 v2Impl = new PerkosReceiptAnchorV2();
        vm.prank(owner);
        anchor.upgradeToAndCall(address(v2Impl), "");

        // Storage survives the upgrade.
        (address walletAfter, bytes32 hashAfter, ) = anchor.getAnchor(receiptId);
        assertEq(walletAfter, alice);
        assertEq(hashAfter, HASH_A);

        // The new function on V2 is reachable through the same proxy address.
        assertEq(PerkosReceiptAnchorV2(address(anchor)).v2Pong(), "v2");
    }

    function test_OnlyOwnerCanUpgrade() public {
        PerkosReceiptAnchorV2 v2Impl = new PerkosReceiptAnchorV2();
        vm.prank(alice);
        vm.expectRevert();
        anchor.upgradeToAndCall(address(v2Impl), "");
    }

    function test_TwoPartiesCanAnchorSameTranscriptUnderDifferentIds() public {
        bytes32 idA = keccak256("party-a");
        bytes32 idB = keccak256("party-b");

        vm.prank(alice);
        anchor.anchor(idA, HASH_A);
        vm.prank(bob);
        anchor.anchor(idB, HASH_A);

        (address wA, , ) = anchor.getAnchor(idA);
        (address wB, , ) = anchor.getAnchor(idB);
        assertEq(wA, alice);
        assertEq(wB, bob);
    }
}
