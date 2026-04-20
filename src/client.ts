/**
 * Anytype API client — thin wrapper over the REST API.
 *
 * Docs:  https://developers.anytype.io/docs/reference/2025-11-08/anytype-api
 * Spec:  https://raw.githubusercontent.com/anyproto/anytype-api/main/docs/reference/openapi-2025-11-08.yaml
 */

import { loadConfig, saveConfig } from "./config.js";

const API_VERSION = "2025-11-08";
const DEFAULT_BASE_URL = "http://127.0.0.1:31009";

export class AnytypeClient {
  private baseUrl: string;
  private apiKey: string | null = null;

  constructor() {
    this.baseUrl = process.env.ANYTYPE_API_BASE_URL ?? DEFAULT_BASE_URL;
  }

  // ---------------------------------------------------------------------------
  // Auth helpers
  // ---------------------------------------------------------------------------

  async init() {
    const cfg = await loadConfig();
    this.apiKey = process.env.ANYTYPE_API_KEY ?? cfg.apiKey ?? null;
  }

  get isAuthenticated(): boolean {
    return this.apiKey !== null;
  }

  /** Start the challenge flow — returns challenge_id */
  async createChallenge(appName = "pi-anytype"): Promise<string> {
    const res = await this.raw("POST", "/v1/auth/challenges", {
      app_name: appName,
    });
    const body = await res.json();
    return body.challenge_id ?? body.data?.challenge_id;
  }

  /** Exchange challenge + 4-digit code for an API key */
  async createApiKey(challengeId: string, code: string): Promise<string> {
    const res = await this.raw("POST", "/v1/auth/api_keys", {
      challenge_id: challengeId,
      code,
    });
    const body = await res.json();
    const apiKey: string | undefined = body.api_key ?? body.data?.api_key;
    if (!apiKey) {
      throw new Error("Anytype auth succeeded but no api_key returned.");
    }
    this.apiKey = apiKey;
    await saveConfig({ apiKey });
    return apiKey;
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  /** Global search across all spaces */
  async searchGlobal(
    query: string,
    opts?: { types?: string[]; limit?: number; offset?: number },
  ) {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.offset) params.set("offset", String(opts.offset));

    return this.authed<{
      results: any[];
      total: number;
      has_more: boolean;
    }>("POST", `/v1/search?${params}`, {
      query,
      types: opts?.types,
    });
  }

  /** Search within a specific space */
  async searchSpace(
    spaceId: string,
    query: string,
    opts?: { types?: string[]; limit?: number; offset?: number },
  ) {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.offset) params.set("offset", String(opts.offset));

    return this.authed<{
      results: any[];
      total: number;
      has_more: boolean;
    }>("POST", `/v1/spaces/${spaceId}/search?${params}`, {
      query,
      types: opts?.types,
    });
  }

  // ---------------------------------------------------------------------------
  // Spaces
  // ---------------------------------------------------------------------------

  async listSpaces(opts?: { limit?: number; offset?: number }) {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.offset) params.set("offset", String(opts.offset));
    return this.authed<{
      results: any[];
      total: number;
      has_more: boolean;
    }>("GET", `/v1/spaces?${params}`);
  }

  async getSpace(spaceId: string) {
    return this.authed<any>("GET", `/v1/spaces/${spaceId}`);
  }

  async createSpace(name: string, description?: string) {
    return this.authed<any>("POST", "/v1/spaces", {
      name,
      description,
    });
  }

  async updateSpace(
    spaceId: string,
    data: { name?: string; description?: string },
  ) {
    return this.authed<any>("PATCH", `/v1/spaces/${spaceId}`, data);
  }

  // ---------------------------------------------------------------------------
  // Objects
  // ---------------------------------------------------------------------------

  async listObjects(
    spaceId: string,
    opts?: { limit?: number; offset?: number },
  ) {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.offset) params.set("offset", String(opts.offset));
    return this.authed<{
      results: any[];
      total: number;
      has_more: boolean;
    }>("GET", `/v1/spaces/${spaceId}/objects?${params}`);
  }

  async getObject(spaceId: string, objectId: string) {
    return this.authed<any>(
      "GET",
      `/v1/spaces/${spaceId}/objects/${objectId}`,
    );
  }

  async createObject(
    spaceId: string,
    data: {
      type_key: string;
      name?: string;
      body?: string;
      icon?: any;
      properties?: any[];
      template_id?: string;
    },
  ) {
    return this.authed<any>("POST", `/v1/spaces/${spaceId}/objects`, data);
  }

  async updateObject(
    spaceId: string,
    objectId: string,
    data: {
      name?: string;
      /** Body content — only for create. For updates use `markdown`. */
      body?: string;
      /** Markdown body — used by PATCH to update content. */
      markdown?: string;
      icon?: any;
      properties?: any[];
      type_key?: string;
    },
  ) {
    // Build the PATCH payload: omit undefined fields for true partial update.
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.markdown !== undefined) payload.markdown = data.markdown;
    else if (data.body !== undefined) payload.markdown = data.body; // convenience alias
    if (data.icon !== undefined) payload.icon = data.icon;
    if (data.properties !== undefined) payload.properties = data.properties;
    if (data.type_key !== undefined) payload.type_key = data.type_key;
    return this.authed<any>(
      "PATCH",
      `/v1/spaces/${spaceId}/objects/${objectId}`,
      payload,
    );
  }

  async deleteObject(spaceId: string, objectId: string) {
    return this.authed<any>(
      "DELETE",
      `/v1/spaces/${spaceId}/objects/${objectId}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Lists (collections)
  // ---------------------------------------------------------------------------

  async addListObjects(
    spaceId: string,
    listId: string,
    objectIds: string[],
  ) {
    return this.authed<string>(
      "POST",
      `/v1/spaces/${spaceId}/lists/${listId}/objects`,
      { objects: objectIds },
    );
  }

  async removeListObject(
    spaceId: string,
    listId: string,
    objectId: string,
  ) {
    return this.authed<string>(
      "DELETE",
      `/v1/spaces/${spaceId}/lists/${listId}/objects/${objectId}`,
    );
  }

  async getListObjects(
    spaceId: string,
    listId: string,
    viewId: string,
    opts?: { limit?: number; offset?: number },
  ) {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.offset) params.set("offset", String(opts.offset));
    return this.authed<{
      results: any[];
      total: number;
      has_more: boolean;
    }>(
      "GET",
      `/v1/spaces/${spaceId}/lists/${listId}/views/${viewId}/objects?${params}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  async listTypes(spaceId: string) {
    const params = new URLSearchParams();
    params.set("limit", "100");
    return this.authed<{
      results: any[];
      total: number;
      has_more: boolean;
    }>("GET", `/v1/spaces/${spaceId}/types?${params}`);
  }

  async getType(spaceId: string, typeId: string) {
    return this.authed<any>("GET", `/v1/spaces/${spaceId}/types/${typeId}`);
  }

  // ---------------------------------------------------------------------------
  // Properties
  // ---------------------------------------------------------------------------

  async listProperties(spaceId: string) {
    const params = new URLSearchParams();
    params.set("limit", "100");
    return this.authed<{
      results: any[];
      total: number;
      has_more: boolean;
    }>(
      "GET",
      `/v1/spaces/${spaceId}/properties?${params}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Tags
  // ---------------------------------------------------------------------------

  async listTags(spaceId: string, propertyId: string) {
    const params = new URLSearchParams();
    params.set("limit", "100");
    return this.authed<{
      results: any[];
      total: number;
      has_more: boolean;
    }>(
      "GET",
      `/v1/spaces/${spaceId}/properties/${propertyId}/tags?${params}`,
    );
  }

  async createTag(
    spaceId: string,
    propertyId: string,
    data: { name: string; color: string; key?: string },
  ) {
    return this.authed<any>(
      "POST",
      `/v1/spaces/${spaceId}/properties/${propertyId}/tags`,
      data,
    );
  }

  // ---------------------------------------------------------------------------
  // Members
  // ---------------------------------------------------------------------------

  async listMembers(spaceId: string) {
    return this.authed<{
      results: any[];
      total: number;
      has_more: boolean;
    }>("GET", `/v1/spaces/${spaceId}/members`);
  }

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------

  async listTemplates(spaceId: string, typeId: string) {
    return this.authed<{
      results: any[];
      total: number;
      has_more: boolean;
    }>(
      "GET",
      `/v1/spaces/${spaceId}/types/${typeId}/templates`,
    );
  }

  // ---------------------------------------------------------------------------
  // Internal request helpers
  // ---------------------------------------------------------------------------

  private async authed<T>(method: string, path: string, body?: any): Promise<T> {
    if (!this.apiKey) {
      throw new Error(
        "Not authenticated. Run /anytype-login or set ANYTYPE_API_KEY env var.",
      );
    }
    const res = await this.raw(method, path, body);
    const json = await res.json();

    // Anytype wraps most responses as { data, pagination }
    // Normalize to shapes expected by the extension tools.
    if (json && Array.isArray(json.data) && json.pagination) {
      return {
        results: json.data,
        total: json.pagination.total ?? json.data.length,
        has_more: Boolean(json.pagination.has_more),
      } as T;
    }

    // Single resource responses are usually { data: {...} }
    if (json && Object.prototype.hasOwnProperty.call(json, "data")) {
      return json.data as T;
    }

    // Fallback: raw JSON as-is
    return json as T;
  }

  private async raw(
    method: string,
    path: string,
    body?: any,
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Anytype-Version": API_VERSION,
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let errMsg = `Anytype API ${res.status}`;
      try {
        const errBody = await res.json();
        errMsg += `: ${JSON.stringify(errBody)}`;
      } catch {
        errMsg += `: ${await res.text()}`;
      }
      throw new Error(errMsg);
    }

    return res;
  }
}
