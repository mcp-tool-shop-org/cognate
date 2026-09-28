/**
 * Minimal type declarations for @mcptoolshop/repomesh programmatic API.
 */

declare module "@mcptoolshop/repomesh" {
  export function computeVerifyResult(args: {
    repo: string;
    version: string;
    anchored?: boolean;
    anchoredOrLocal?: boolean;
    ledgerUrl?: string;
    nodesUrl?: string;
    manifestsUrl?: string;
    local?: boolean;
    localDir?: string;
    human?: boolean;
    preloadedEvents?: any[] | null;
  }): Promise<{ status: string; result: any }>;

  export function verifyAll(args?: {
    anchored?: boolean;
    ledgerUrl?: string;
    local?: boolean;
    localDir?: string;
    human?: boolean;
  }): Promise<{ results: any[] }>;

  export function exitCodeForStatus(status: string, failOn?: string): number;

  export function verifyAnchorTx(args: {
    tx?: any;
    network?: string;
    [key: string]: any;
  }): Promise<any>;
}
