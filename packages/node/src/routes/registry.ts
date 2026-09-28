import {
  createRegistry,
  registerModel,
  registerVersion,
  transitionVersion,
} from "@cognate/model-registry";
import { RegistryError } from "@cognate/model-registry";
import type { Model, ModelVersion } from "@cognate/types";
import type { ServerState } from "../server.js";

interface RouteResult <T> {
  ok: boolean;
  value?: T;
  error?: { code: string; message: string; hint: string };
  state?: ReturnType<typeof createRegistry>;
}

export function handleRegistry(
  mutableState: ServerState,
  pathname: string,
  method: string,
  body: unknown
): RouteResult<unknown> {
  if (pathname === "/registry/models" && method === "POST") {
    const req = body as { model?: Model };
    if (!req.model) {
      return { ok: false, error: { code: "registry.missing-model", message: "Missing model", hint: "Provide a model object" } };
    }
    try {
      const newState = registerModel(mutableState.registry, req.model);
      return { ok: true, value: { id: req.model.id }, state: newState };
    } catch (err) {
      const e = err as RegistryError;
      return { ok: false, error: { code: e.code, message: e.message, hint: e.hint } };
    }
  }

  if (pathname.startsWith("/registry/versions/") && method === "POST") {
    const parts = pathname.split("/");
    const versionId = parts[3];
    const req = body as {
      version?: ModelVersion;
      from?: string;
      to?: string;
      actorId?: string;
      reason?: string;
    };

    if (parts.length === 4 && req.version) {
      try {
        const newState = registerVersion(mutableState.registry, req.version);
        return { ok: true, value: { id: req.version.id }, state: newState };
      } catch (err) {
        const e = err as RegistryError;
        return { ok: false, error: { code: e.code, message: e.message, hint: e.hint } };
      }
    }

    if (parts.length === 4 && req.from && req.to && req.actorId && req.reason) {
      try {
        const newState = transitionVersion(
          mutableState.registry,
          versionId,
          req.from as import("@cognate/types").ModelVersionStatus,
          req.to as import("@cognate/types").ModelVersionStatus,
          req.actorId,
          req.reason
        );
        return { ok: true, value: { versionId, to: req.to }, state: newState };
      } catch (err) {
        const e = err as RegistryError;
        return { ok: false, error: { code: e.code, message: e.message, hint: e.hint } };
      }
    }

    return { ok: false, error: { code: "registry.invalid-request", message: "Invalid registry request", hint: "Check path and body" } };
  }

  return { ok: false, error: { code: "registry.not-found", message: "Route not found", hint: "Check URL" } };
}
