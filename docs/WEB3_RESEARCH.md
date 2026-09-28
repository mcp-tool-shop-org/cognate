# Web3 primitives for Cognate

Study-swarm, 28 September 2026. Cognate already has the pieces these proposals are often asked to replace: a human approve-or-revoke grant, a pure policy function, three hashes per model version, encrypted prompts, and Attestia as the attestation layer. This note ranks what to adopt. A chain, a credential, or a content id does not become the authority.

The numbered findings are the ones with a resolvable arXiv id or DOI. W3C recommendations and living drafts are listed after them. They were retrieved. They are not the citation gate's object, because that gate resolves papers, not specifications.

## Research grounding

1. **When an LLM alone runs the DID and verifiable-credential ceremony, integrity fails.** Rodriguez Garzon, Vaziry, Kuzu, Gehrmann, Varkan, Gaballa, and Küpper 2025, *AI Agents with Decentralized Identifiers and Verifiable Credentials* (arXiv:2511.02841). Their prototype can exchange ledger-anchored DIDs and third-party VCs, and the evaluation shows the procedure breaks once the model is the only thing controlling it. Keep approve and revoke in the identity registry. A credential may witness a grant that a person already approved. The model does not hold the key and does not assemble the proof.

2. **Scoped delegation for agents is being specified as an extension of OAuth 2.0 and OpenID Connect, not as a replacement identity stack.** South, Marro, Hardjono, Mahari, Whitney, Greenwood, Chan, and Pentland 2025, *Authenticated Delegation and Authorized AI Agents* (arXiv:2501.09674). A person delegates a bounded permission and keeps the chain of accountability. Cognate's grant is that permission. A portable token can carry it. The token does not vote the permission into existence.

3. **Under-constrained zero-knowledge circuits accept invalid witnesses, and fuzzing finds them in real Circom code.** Takahashi, Kim, Jana, and Yang 2025, *zkFuzz* (arXiv:2504.11961). On 452 Circom circuits the fuzzer reported 85 bugs, 59 of them previously unknown. A proof that a prompt matched a policy is a proof about a circuit. Do not put that proof on the request path until the circuit has been fuzzed, and do not treat it as a substitute for `evaluatePolicy`.

4. **On-chain DAO voting power is highly concentrated.** Feichtinger, Fritsch, Vonlanthen, and Wattenhofer 2023, *The Hidden Shortcomings of (D)AOs* (arXiv:2302.12125). Across 21 on-chain governance systems they measure concentration of voting rights and a large amount of pointless governance activity. Snapshot or Tally may collect a request. They do not pass a policy that the engine denied.

5. **Many DAO losses come from the human governance layer, which code audits do not cover.** Feichtinger, Fritsch, Heimbach, Vonlanthen, and Wattenhofer 2024, *SoK: Attacks on DAOs* (arXiv:2406.15071). The systematization separates attacks that use governance behavior from attacks on code, and notes that audits mostly look at code. An invariant that fails closed does not wait for a ballot.

6. **A chosen IPFS object can be made unretrievable by poisoning DHT resolution, at low cost.** Sridhar, Ascigil, Keizer, Genon, Pierre, Psaras, Rivière, and Król 2023, *Content Censorship in the InterPlanetary File System* (arXiv:2307.12212). The CID still names the bytes. Downloaders are steered away from the providers. Model weights and prompts do not go on public IPFS as the store of record.

7. **IPFS is a public content-addressed delivery network whose delays are acceptable for many public reads.** Trautwein, Raman, Tyson, Castro, Scott, Schubotz, Gipp, and Psaras 2022, *Design and Evaluation of IPFS* (arXiv:2208.05877). That result is about retrieval of public objects. It is not a result about private, deletable, tenant-keyed blobs. Cognate keeps the three hashes. It does not publish the plaintext, and it does not treat a CID as a delete switch.

8. **DePIN is a survey of blockchain-managed devices, and the open problems are still the system's own.** Lin, Wang, Shi, Zhang, and Cao 2024, *Decentralized Physical Infrastructure Network (DePIN): Challenges and Opportunities* (arXiv:2406.02239). A device network that uploads measurements is an oracle with a token. It does not attest that a policy was followed.

9. **A practical digital time-stamp publishes a hash, not the document, and links stamps so a time-stamping service cannot back-date the commitment.** Haber and Stornetta 1991, *How to Time-Stamp a Digital Document* (DOI 10.1007/BF00196791). Anchor the policy hash and the three model hashes. Do not anchor the prompt.

10. **Finalized checkpoints are the safety point in Gasper, not the moment a transaction is first included.** Buterin, Hernandez, Kamphefner, Pham, Qiao, Ryan, Sin, Wang, and Zhang 2020, *Combining GHOST and Casper* (arXiv:2003.03052). A hash receipt counts after the ledger Cognate trusts has finalized it. Inclusion in a block that can still be reorged is not an attestation.

11. **A chain cannot observe an off-chain fact. An oracle reintroduces a trusted reporter.** Caldarelli and Ellul 2021, *The Blockchain Oracle Problem in Decentralized Finance — A Multivocal Approach* (DOI 10.3390/app11167572). A contract that stores a model hash records that someone submitted a digest. It does not record that those weights were the ones served.

12. **Erasure of a CID across IPFS is not something the network can force.** Politou, Alepis, Patsakis, Casino, and Alazab 2020, *Delegated content erasure in IPFS* (DOI 10.1016/j.future.2020.06.037). Any peer that cached the bytes can keep serving that id. Unpinning is local. Encrypted or not, a published prompt CID cannot be revoked.

## Proposed rank

This rank is not locked. The retrieval oracle resolved all twelve papers. The groundedness lens did not run: Ollama was not reachable, and `roleos verify-citations` returned `escalate` (prism receipt `prism-01m3n2rcb77jdmkftqgq7zgy8e`, verdict escalate). Nothing below is fabricated on existence. Nothing below has a different-family check that the finding matches the paper. Re-run the gate when Ollama is up before treating the rank as canon.

The rank is what Cognate should do with the primitive. It is not a rank of how interesting the primitive is.

| Rank | Primitive | Decision | Why |
|------|-----------|----------|-----|
| 1 | Hash anchor after finality | Adopt as a witness, through Attestia | Findings 9, 10, 11. The bytes stay off the chain. The receipt waits for finality. |
| 2 | W3C VC 2.0 as an export of an approved grant | Adopt later, beside the registry | Findings 1 and 2. The registry remains the authority. The credential is a portable witness. The model does not sign it. |
| 3 | `did:web` as the agent's name | Do not adopt | No retrieved measurement shows that a website DID survives DNS or server takeover with a history a later verifier can check. Finding 1 already shows the ceremony fails when the model runs it. |
| 4 | Snapshot or Tally as the approval path | Do not adopt | Findings 4 and 5. A vote is a request. Denial still stops the call. |
| 5 | Zero-knowledge proof of a keyword or regex over a committed prompt | Defer | Finding 3. Demonstrated objects in the literature are small fixed circuits, not Cognate's full policy result. Circuit bugs accept false statements. |
| 6 | Zero-knowledge proof of the model itself | Do not adopt for this layer | The policy function is the predicate. Proving a network's inference is a different, heavier system, and finding 3 applies to its circuit too. |
| 7 | Public IPFS for prompts or weights | Do not adopt | Findings 6, 7, and 12. A CID is public metadata, can be hidden from downloaders, and cannot be erased. |
| 8 | Filecoin for paid possession of an artifact | Defer, and only for bytes someone must retrieve | A deal can pay a provider to show they hold bytes. It is not a private disk and it is not a delete. No network-wide retrieval study was solid enough to rank this above the hash. |
| 9 | DePIN attestation nodes | Do not adopt | Finding 8. A sensor claim is an oracle. It does not show the policy result. |
| 10 | Federated-learning receipt on a chain | Do not adopt as approval | A proof that a declared training step ran does not show that the data were fit, that the update was clean, or that a person accepted the model. Registration still needs the human gate and the three hashes. |

## What this means in the packages

**Identity.** `requestGrant` then `approveGrant` stays the sequence. A later export can wrap an approved grant as a VC 2.0 credential whose status the verifier fetches. `did:web` is not that export. (Findings 1 and 2.)

**Policy.** `evaluatePolicy` stays the decision. A zero-knowledge wrapper, if it is ever added, proves a small public predicate over a commitment and returns the same four outcomes. It does not replace the function, and it does not ship until the circuit has a fuzzing result. (Finding 3.)

**Registry and chains.** Attestia already attests events and can observe chains. The thing to anchor is a Merkle root of policy and model hashes, after finality, not a blob that expires and not the prompt. (Findings 9, 10, and 11.)

**Prompt store.** Encryption stays tenant-keyed. The store does not gain an IPFS pin. (Findings 6, 7, and 12.)

## Retrieved, not used as numbered findings

These were opened or reported by the research pass. They do not carry an arXiv id or a DOI that this note relies on, so they do not justify a row in the table.

- W3C Verifiable Credentials Data Model v2.0 became a Recommendation on 15 May 2025. That is the credential shape for rank 2. It does not decide who may approve a grant.
- `did:web` remains a community-group draft. Resolution is an HTTPS fetch of `did.json`. The draft does not give the DID a history that survives a replaced file.
- Bitstring Status List v1.0 is a Recommendation as of 15 May 2025. A verifier that skips status, or caches it, will treat a revoked grant as live.
- EIP-4844 blob sidecars are short-lived. They are the wrong place for a hash that must verify years later.
- XRPL and Solana inclusion is not the same as finality. A memo or a processed slot is not the receipt in rank 1.
- Filecoin operator reports of retrieval success were not a peer-reviewed series. They stay out of the rank.

## Verification

`roleos verify-citations` on this file, with `PRISM_DEV=1` because this machine has no prism signing key:

- Existence: 12 of 12 resolved. None were missing from arXiv or Crossref.
- Groundedness: halted. The detail on every item is `groundedness verifier unavailable: Ollama API not reachable`. Two items (Haber and Stornetta; Politou and colleagues) also came back with no abstract, so the oracle said to retrieve the full text.
- Verdict: `escalate`. That is a closed gate, not a pass.

The first run, without `PRISM_DEV`, stopped earlier: no receipt signing key. That is the same halt, one step sooner.
