// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PerkosReceiptAnchor
 * @notice Minimal on-chain anchor for PerkOS conversation receipts.
 *
 *         A PerkOS "receipt" is a wallet-signed attestation of the
 *         sha256 hash of an off-chain conversation transcript. The
 *         signed manifest plus the transcript itself live off-chain
 *         (Firestore + the host agent's JSONL). Anchoring on Base
 *         publishes a tiny commitment so anyone can prove a conversation
 *         existed at a given block timestamp without the contract
 *         storing — or being able to read — any conversation content.
 *
 *         Anyone may anchor. The contract intentionally does **not**
 *         validate the signed receipt: that's an off-chain check
 *         (ecrecover against the signed manifest). The on-chain record
 *         only commits to (msg.sender, transcriptHash, blockTimestamp).
 *
 *         Re-anchoring the same receiptId reverts; a transcript hash
 *         can however be anchored under different receiptIds (e.g. by
 *         two parties to the same conversation independently). That's
 *         allowed by design: each anchor commits the wallet that issued
 *         that particular receipt.
 *
 *         Gas posture: one SSTORE per anchor (cold), one event emit.
 *         No admin, no upgradeability, no fees. Deploy and forget.
 */
contract PerkosReceiptAnchor {
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

    event ReceiptAnchored(
        bytes32 indexed receiptId,
        address indexed wallet,
        bytes32 indexed transcriptHash,
        uint64 anchoredAt
    );

    error AlreadyAnchored(bytes32 receiptId);
    error EmptyHash();

    /**
     * @notice Publish an on-chain commitment for a PerkOS receipt.
     * @param receiptId       Caller-chosen identifier. Re-using one reverts.
     *                        Typically: keccak256(abi.encodePacked(walletAddress, convId, generatedAt))
     *                        or any 32-byte value the caller picks.
     * @param transcriptHash  sha256 of the host agent's local jsonl + metadata,
     *                        copied verbatim from the off-chain signed manifest.
     *                        Cannot be the zero hash (catches forgotten args).
     */
    function anchor(bytes32 receiptId, bytes32 transcriptHash) external {
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
    function verify(bytes32 receiptId, bytes32 transcriptHash) external view returns (bool) {
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
}
