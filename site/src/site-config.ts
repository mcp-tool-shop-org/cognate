import type { SiteConfig } from '@mcptoolshop/site-theme';

export const config: SiteConfig = {
  title: 'Cognate',
  description: 'AI governance attestation layer — structural truth for autonomous systems',
  logoBadge: 'C',
  brandName: 'Cognate',
  repoUrl: 'https://github.com/mcp-tool-shop-org/cognate',
  footerText: 'MIT Licensed — built by <a href="https://mcp-tool-shop.github.io/" style="color:var(--color-muted);text-decoration:underline">mcp-tool-shop</a>',

  hero: {
    badge: 'v1.0.0',
    headline: 'Structural governance',
    headlineAccent: 'for autonomous intelligence.',
    description: 'Every model version, prompt, output, and policy decision — attested, immutable, and human-governed. Built on Attestia.',
    primaryCta: { href: 'https://github.com/mcp-tool-shop-org/cognate', label: 'View on GitHub' },
    secondaryCta: { href: 'handbook/', label: 'Read the Handbook' },
    previews: [
      { label: 'Install', code: 'npm install @mcptoolshop/cognate' },
      { label: 'Policy', code: "import { evaluatePolicy } from '@mcptoolshop/cognate/policy';\n\nconst result = evaluatePolicy(policy, context);" },
      { label: 'Health', code: 'curl http://localhost:4000/health' },
    ],
  },

  sections: [
    {
      kind: 'features',
      id: 'features',
      title: 'What holds',
      subtitle: 'Pure functions. Callers supply the clock, the keys, and the store.',
      features: [
        { title: 'Fail closed', desc: 'A policy disagreement stops the call. The engine does not rewrite the rule to let it through.' },
        { title: 'Human approval', desc: 'Models do not deploy themselves. Agents do not grant themselves capabilities. Approval is a separate act.' },
        { title: 'Append-only', desc: 'Prompts and outputs are logged, encrypted with a tenant key, and hashed. Nothing in the store updates or deletes.' },
        { title: 'Hashed models', desc: 'A version records weights, config, and manifest hashes. A swapped file is a different version.' },
        { title: 'Signed requests', desc: "Every write to the HTTP server is signed with the caller's Ed25519 key, and every route acts in the signer's own tenant." },
      ],
    },
    {
      kind: 'data-table',
      id: 'packages',
      title: 'Packages',
      subtitle: 'Six libraries, bundled into @mcptoolshop/cognate on npm, and an HTTP server that runs from the repository or the Docker image.',
      columns: ['Package', 'Role'],
      rows: [
        ['@cognate/types', 'Domain types. Zero dependencies.'],
        ['@cognate/policy', 'evaluatePolicy. Pure. No I/O.'],
        ['@cognate/model-registry', 'Lifecycle from registered to deployed.'],
        ['@cognate/agent-identity', 'Grants, approvals, revocations.'],
        ['@cognate/prompt-store', 'Encrypted append-only prompt log.'],
        ['@cognate/repomesh-bridge', 'RepoMesh release checks: verifyRelease before a deploy.'],
        ['@cognate/node', "HTTP API server on port 4000. Appends governance acts to Attestia's log."],
      ],
    },
    {
      kind: 'code-cards',
      id: 'usage',
      title: 'Usage',
      cards: [
        { title: 'Run the server', code: "pnpm install && pnpm -r build\nnode scripts/make-tenant-root.mjs my-tenant\nCOGNATE_TENANT_ROOTS_PATH=\"$PWD/tenant-roots.json\" node packages/node/dist/index.js" },
        {
          title: 'Evaluate',
          code: "import { evaluatePolicy } from '@mcptoolshop/cognate/policy';\n\nif (evaluatePolicy(policy, context).overall === 'deny') {\n  // block the request\n}",
        },
      ],
    },
  ],
};
