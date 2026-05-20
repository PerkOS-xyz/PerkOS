// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title PerkosReceiptAnchor
 * @notice Upgradeable on-chain anchor for PerkOS conversation receipts.
 *
 *         A PerkOS "receipt" is a wallet-signed attestation of the
 *         sha256 hash of an off-chain conversation transcript. The
 *         signed manifest and the transcript itself live off-chain
 *         (Firestore + the host agent's JSONL). Anchoring on Base
 *         publishes a tiny commitment so anyone can prove a conversation
 *         existed at a given block timestamp without the contract
 *         storing — or being able to read — any conversation content.
 *
 *         The contract intentionally does **not** validate the signed
 *         receipt: that's an off-chain check (ecrecover against the
 *         signed manifest). The on-chain record only commits to
 *         (msg.sender, transcriptHash, blockTimestamp).
 *
 *         Re-anchoring the same receiptId reverts; a transcript hash
 *         can however be anchored under different receiptIds (e.g. by
 *         two parties to the same conversation independently). That's
 *         allowed by design: each anchor commits the wallet that issued
 *         that particular receipt.
 *
 * @dev Upgradeable via UUPS. The owner is the only address authorized
 *      to push a new implementation. Choose the owner with care —
 *      ideally a Gnosis Safe (multisig) or a timelock, not an EOA.
 *
 *      Storage layout (do not reorder existing slots on upgrade):
 *        slot N+0   anchors mapping
 *      Trailing __gap reserves 49 slots for future fields.
 */
contract PerkosReceiptAnchor is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    struct Anchor {
        /// @dev The wallet that called anchor() — typically the conversation participant
        ///      who issued the off-chain signed receipt. ecrecover the manifest's
        ///      signature off-chain and confirm it matches this address.
        address wallet;
        /// @dev sha256 of the host agent's transcript jsonl + metadata, copied
        ///      verbatim from the off-chain ReceiptManifest.transcriptHash.
        bytes32 transcriptHash;
        /// @dev block.timestamp at the time of anchoring. Acts as the
        ///      authoritative existence proof — the receipt's signed
        ///      generatedAt is wallet-claimed; this is consensus-claimed.
        uint64 anchoredAt;
    }

    /// @notice receiptId (caller-chosen, typically a uuid hashed into bytes32)
    ///         → Anchor record. Reading returns a zero struct for unanchored ids.
    mapping(bytes32 => Anchor) public anchors;

    /// @dev Reserved storage to allow future fields to be appended without
    ///      shifting the existing layout in derived implementations.
    uint256[49] private __gap;

    event ReceiptAnchored(
        bytes32 indexed receiptId,
        address indexed wallet,
        bytes32 indexed transcriptHash,
        uint64 anchoredAt
    );

    /// @notice Emitted when an upgrade is authorized so off-chain indexers
    ///         can correlate code changes with the on-chain implementation.
    event UpgradeAuthorized(address indexed newImplementation, address indexed by);

    error AlreadyAnchored(bytes32 receiptId);
    error EmptyHash();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice One-shot initializer called by the proxy on deploy.
     * @param initialOwner Address that can pause/unpause and authorize upgrades.
     *                     Strongly recommended: a Gnosis Safe or timelock.
     */
    function initialize(address initialOwner) external initializer {
        __Ownable_init(initialOwner);
        __Pausable_init();
        __UUPSUpgradeable_init();
    }

    /**
     * @notice Publish an on-chain commitment for a PerkOS receipt.
     * @param receiptId       Caller-chosen identifier. Re-using one reverts.
     *                        Typically: keccak256(abi.encodePacked(walletAddress, convId, generatedAt))
     *                        or any 32-byte value the caller picks.
     * @param transcriptHash  sha256 of the host agent's local jsonl + metadata,
     *                        copied verbatim from the off-chain signed manifest.
     *                        Cannot be the zero hash (catches forgotten args).
     */
    function anchor(bytes32 receiptId, bytes32 transcriptHash) external whenNotPaused {
        if (transcriptHash == bytes32(0)) revert EmptyHash();
        Anchor storage existing = anchors[receiptId];
        if (existing.wallet != address(0)) revert AlreadyAnchored(receiptId);

        uint64 ts = uint64(block.timestamp);
        anchors[receiptId] = Anchor({
            wallet: msg.sender,
            transcriptHash: transcriptHash,
            anchoredAt: ts
        });

        emit ReceiptAnchored(receiptId, msg.sender, transcriptHash, ts);
    }

    /**
     * @notice Returns true iff `transcriptHash` matches the previously-anchored
     *         record for `receiptId`. Off-chain code SHOULD also verify the
     *         signed manifest with ecrecover before trusting the anchor.
     */
    function verify(bytes32 receiptId, bytes32 transcriptHash)
        external
        view
        returns (bool)
    {
        Anchor storage a = anchors[receiptId];
        return a.transcriptHash != bytes32(0) && a.transcriptHash == transcriptHash;
    }

    /**
     * @notice Read shorthand: returns the anchor record for `receiptId`, or
     *         a zero struct if the id hasn't been anchored.
     */
    function getAnchor(bytes32 receiptId)
        external
        view
        returns (address wallet, bytes32 transcriptHash, uint64 anchoredAt)
    {
        Anchor storage a = anchors[receiptId];
        return (a.wallet, a.transcriptHash, a.anchoredAt);
    }

    // -------------------------------------------------------------------
    // Admin (owner-only)
    // -------------------------------------------------------------------

    /// @notice Halt new anchor() calls. Existing records are unaffected.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume anchor() calls.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Returns the on-chain implementation version. Bump in each
    ///         deployed implementation so off-chain code can correlate.
    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    // -------------------------------------------------------------------
    // UUPS upgrade authorization
    // -------------------------------------------------------------------

    /**
     * @dev Restricts upgrades to the contract owner. The owner SHOULD be
     *      a multisig or timelock — granting it to an EOA would let a
     *      single key compromise rewrite the contract under users.
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {
        emit UpgradeAuthorized(newImplementation, msg.sender);
    }
}
