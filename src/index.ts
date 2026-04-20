/**
 * Pi extension for Anytype — interact with your Anytype knowledge base.
 *
 * Setup:
 *   1. Run `/anytype-login` for interactive auth (or set ANYTYPE_API_KEY env var)
 *   2. Ensure Anytype desktop is running (API served at localhost:31009)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { AnytypeClient } from "./client.js";
import {
  fmtSpace, fmtObject, fmtType, fmtProperty, fmtTag, truncate,
} from "./format.js";

const COLORS = [
  "grey", "yellow", "orange", "red", "pink", "purple", "blue", "ice", "teal",
  "lime",
] as const;

export default function (pi: ExtensionAPI) {
  const client = new AnytypeClient();

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  pi.on("session_start", async () => {
    await client.init();
  });

  // ---------------------------------------------------------------------------
  // Command: /anytype-login
  // ---------------------------------------------------------------------------

  pi.registerCommand("anytype-login", {
    description: "Authenticate with Anytype (interactive challenge flow)",
    handler: async (_args, ctx) => {
      try {
        const challengeId = await client.createChallenge("pi-anytype");
        ctx.ui.notify(
          "Check Anytype desktop for a 4-digit code, then enter it below.",
          "info",
        );
        const code = await ctx.ui.input(
          "Anytype Auth Code",
          "Enter the 4-digit code shown in Anytype desktop:",
        );
        if (!code || code.length !== 4) {
          ctx.ui.notify("Invalid code — must be 4 digits.", "error");
          return;
        }
        const apiKey = await client.createApiKey(challengeId, code);
        ctx.ui.notify(`Authenticated! API key saved.`, "success");
      } catch (err: any) {
        ctx.ui.notify(`Auth failed: ${err.message}`, "error");
      }
    },
  });

  // ---------------------------------------------------------------------------
  // Command: /anytype-status
  // ---------------------------------------------------------------------------

  pi.registerCommand("anytype-status", {
    description: "Check Anytype connection status",
    handler: async (_args, ctx) => {
      if (!client.isAuthenticated) {
        ctx.ui.notify(
          "Not authenticated. Run /anytype-login or set ANYTYPE_API_KEY.",
          "warn",
        );
        return;
      }
      try {
        const spaces = await client.listSpaces({ limit: 1 });
        ctx.ui.notify(
          `Connected! Found ${spaces.total} space(s).`,
          "success",
        );
      } catch (err: any) {
        ctx.ui.notify(`Connection failed: ${err.message}`, "error");
      }
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_search
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_search",
    label: "Anytype Search",
    description:
      "Search objects across all Anytype spaces, or within a specific space. Returns matching objects with names, IDs, types, and snippets.",
    promptSnippet:
      "Search Anytype spaces and objects by name or content",
    promptGuidelines: [
      "Use anytype_search when the user wants to find notes, tasks, pages, or other objects in Anytype.",
      "If the user mentions a specific space, include the space_id parameter.",
      "Common type keys: page, note, task, project, bookmark, collection, set.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search text (matches name and snippet)" }),
      space_id: Type.Optional(
        Type.String({ description: "Limit search to this space ID" }),
      ),
      types: Type.Optional(
        Type.Array(Type.String(), {
          description: "Filter by object type keys (e.g. ['page', 'task'])",
        }),
      ),
      filters: Type.Optional(
        Type.Any({ description: "Advanced FilterExpression (API native). Example: {operator:'and', conditions:[{property_key:'proyecto', condition:'eq', objects:['<id>']}]}" }),
      ),
      sort: Type.Optional(
        Type.Any({ description: "Advanced sort options (API native)." }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Max results (default 20, max 100)", default: 20 }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      ensureAuth();
      const limit = Math.min(params.limit ?? 20, 100);
      let result: any;
      if (params.space_id) {
        result = await client.searchSpace(params.space_id, params.query, {
          types: params.types,
          filters: params.filters,
          sort: params.sort,
          limit,
        });
      } else {
        result = await client.searchGlobal(params.query, {
          types: params.types,
          filters: params.filters,
          sort: params.sort,
          limit,
        });
      }
      const lines = [
        `Found ${result.total} result(s)${result.has_more ? " (more available)" : ""}:`,
        "",
        ...result.results.map((o: any) => fmtObject(o)),
      ];
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { total: result.total, ids: result.results.map((o: any) => o.id) },
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_list_spaces
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_list_spaces",
    label: "List Anytype Spaces",
    description:
      "List all spaces the authenticated user has access to. Returns space names, IDs, and icons.",
    promptSnippet: "List available Anytype spaces",
    promptGuidelines: [
      "Use this first to discover space IDs needed for other Anytype operations.",
    ],
    parameters: Type.Object({
      limit: Type.Optional(
        Type.Number({ description: "Max results (default 50)", default: 50 }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      ensureAuth();
      const result = await client.listSpaces({ limit: params.limit ?? 50 });
      const lines = [
        `${result.total} space(s):`,
        "",
        ...result.results.map((s: any) => fmtSpace(s)),
      ];
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { total: result.total, ids: result.results.map((s: any) => s.id) },
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_create_space
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_create_space",
    label: "Create Anytype Space",
    description: "Create a new Anytype space.",
    promptSnippet: "Create new Anytype spaces",
    parameters: Type.Object({
      name: Type.String({ description: "Space name" }),
      description: Type.Optional(Type.String({ description: "Space description" })),
    }),
    async execute(_id, params) {
      ensureAuth();
      const space = await client.createSpace(params.name, params.description);
      return {
        content: [{ type: "text", text: `Created space: ${fmtSpace(space)}` }],
        details: { id: space.id, name: space.name },
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_get_space
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_get_space",
    label: "Get Anytype Space",
    description: "Get details of one Anytype space by ID.",
    promptSnippet: "Get detailed info for an Anytype space",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
    }),
    async execute(_id, params) {
      ensureAuth();
      const s = await client.getSpace(params.space_id);
      const lines = [
        fmtSpace(s),
        s.description ? `\n${s.description}` : "",
      ];
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: s,
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_update_space
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_update_space",
    label: "Update Anytype Space",
    description: "Update an existing Anytype space (name and/or description).",
    promptSnippet: "Update Anytype space metadata",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      name: Type.Optional(Type.String({ description: "New space name" })),
      description: Type.Optional(Type.String({ description: "New space description" })),
    }),
    async execute(_id, params) {
      ensureAuth();
      const space = await client.updateSpace(params.space_id, {
        name: params.name,
        description: params.description,
      });
      return {
        content: [{ type: "text", text: `Updated space: ${fmtSpace(space)}` }],
        details: space,
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_get_object
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_get_object",
    label: "Get Anytype Object",
    description:
      "Retrieve the full content of an Anytype object (note, page, task, etc.) including its body, properties, and blocks.",
    promptSnippet: "Read full content of an Anytype object",
    promptGuidelines: [
      "Requires space_id and object_id. Use anytype_search first to find these.",
    ],
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID containing the object" }),
      object_id: Type.String({ description: "Object ID to retrieve" }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      ensureAuth();
      const obj = await client.getObject(params.space_id, params.object_id);

      let typeDef: any = null;
      if (obj.type?.id) {
        try {
          typeDef = await client.getType(params.space_id, obj.type.id);
        } catch {
          typeDef = null;
        }
      }

      const lines = [
        fmtObject(obj),
        "",
        (obj.markdown ?? obj.body) ? truncate(obj.markdown ?? obj.body, 4000) : "(no body content)",
      ];

      const objectProps = Array.isArray(obj.properties) ? obj.properties : [];
      const byKey = new Map<string, any>();
      for (const p of objectProps) {
        if (p?.key) byKey.set(p.key, p);
      }

      lines.push("", "**Properties:**");
      const shownKeys = new Set<string>();

      if (Array.isArray(typeDef?.properties) && typeDef.properties.length > 0) {
        for (const tp of typeDef.properties) {
          const p = byKey.get(tp.key);
          const value = p ? formatPropertyValue(p) : defaultValueForFormat(tp.format);
          lines.push(`- ${tp.name} (\`${tp.key}\`): ${value}`);
          shownKeys.add(tp.key);
        }
      }

      for (const p of objectProps) {
        if (!p?.key || shownKeys.has(p.key)) continue;
        lines.push(`- ${p.name ?? p.key} (\`${p.key}\`): ${formatPropertyValue(p)}`);
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { ...obj, type_definition: typeDef ?? undefined },
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_create_object
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_create_object",
    label: "Create Anytype Object",
    description:
      "Create a new object (note, task, page, etc.) in an Anytype space. Supports setting name, body, type, and properties.",
    promptSnippet: "Create new notes, tasks, pages in Anytype",
    promptGuidelines: [
      "Requires space_id and type_key. Use anytype_list_types to discover available types in a space.",
      "Common type keys: page, note, task, project, bookmark.",
    ],
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID to create the object in" }),
      type_key: Type.String({
        description: "Object type key (e.g. 'page', 'note', 'task')",
      }),
      name: Type.Optional(Type.String({ description: "Object name/title" })),
      body: Type.Optional(
        Type.String({ description: "Object body content (markdown supported)" }),
      ),
      icon_emoji: Type.Optional(
        Type.String({ description: "Emoji icon for the object (e.g. '📝')" }),
      ),
      template_id: Type.Optional(
        Type.String({ description: "Template ID to apply" }),
      ),
      properties: Type.Optional(
        Type.Array(
          Type.Object({
            key: Type.String({ description: "Property key" }),
            text: Type.Optional(Type.String()),
            number: Type.Optional(Type.Number()),
            checkbox: Type.Optional(Type.Boolean()),
            date: Type.Optional(Type.String()),
          }),
        ),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      ensureAuth();
      const icon = params.icon_emoji
        ? { emoji: params.icon_emoji }
        : undefined;
      const obj = await client.createObject(params.space_id, {
        type_key: params.type_key,
        name: params.name,
        body: params.body,
        icon,
        template_id: params.template_id,
        properties: params.properties,
      });
      return {
        content: [
          {
            type: "text",
            text: `Created: ${fmtObject(obj)}`,
          },
        ],
        details: { id: obj.id, space_id: params.space_id },
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_update_object
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_update_object",
    label: "Update Anytype Object",
    description:
      "Update an existing Anytype object's name, body/content, icon, type, or properties. PATCH is partial at field level: only sent fields change, the rest stay intact. However, the 'body' field itself is always a FULL replacement — there is no line-level or block-level partial edit. To modify content, you must GET the full markdown first, modify it, then PATCH it back.",
    promptSnippet: "Update existing Anytype objects (partial patch — only sent fields change)",
    promptGuidelines: [
      "PATCH is partial at field level: only include fields you want to change. Omitting a field leaves it untouched.",
      "To update content/body, use the 'body' parameter (maps to 'markdown' in the API). IMPORTANT: the body field is always a FULL replacement — there is no partial/diff edit. You must GET the full object first, modify the markdown, then PATCH it back.",
      "To change the object type, use 'type_key'.",
    ],
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      object_id: Type.String({ description: "Object ID to update" }),
      name: Type.Optional(Type.String({ description: "New name" })),
      body: Type.Optional(Type.String({ description: "New body/content (markdown). Only this field is sent — existing content is replaced." })),
      type_key: Type.Optional(Type.String({ description: "Change the object type (e.g. 'page', 'note', 'task')" })),
      icon_emoji: Type.Optional(Type.String({ description: "New emoji icon" })),
      properties: Type.Optional(
        Type.Array(
          Type.Object({
            key: Type.String({ description: "Property key" }),
            text: Type.Optional(Type.String()),
            number: Type.Optional(Type.Number()),
            checkbox: Type.Optional(Type.Boolean()),
            date: Type.Optional(Type.String()),
          }),
        ),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      ensureAuth();
      const icon = params.icon_emoji
        ? { emoji: params.icon_emoji }
        : undefined;
      const obj = await client.updateObject(
        params.space_id,
        params.object_id,
        {
          name: params.name,
          body: params.body,
          type_key: params.type_key,
          icon,
          properties: params.properties,
        },
      );
      return {
        content: [
          {
            type: "text",
            text: `Updated: ${fmtObject(obj)}`,
          },
        ],
        details: { id: obj.id },
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_delete_object
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_delete_object",
    label: "Delete Anytype Object",
    description: "Archive (soft-delete) an Anytype object.",
    promptSnippet: "Delete/archive Anytype objects",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      object_id: Type.String({ description: "Object ID to delete" }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      ensureAuth();
      await client.deleteObject(params.space_id, params.object_id);
      return {
        content: [
          {
            type: "text",
            text: `Archived object \`${params.object_id}\` in space \`${params.space_id}\`.`,
          },
        ],
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_list_types
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_list_types",
    label: "List Anytype Types",
    description:
      "List available object types in a space (e.g. page, note, task, project). Essential before creating objects.",
    promptSnippet: "List object types available in an Anytype space",
    promptGuidelines: [
      "Always use this before anytype_create_object to discover valid type_key values for a space.",
    ],
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      ensureAuth();
      const result = await client.listTypes(params.space_id);
      const lines = [
        `${result.total} type(s):`,
        "",
        ...result.results.map((t: any) => fmtType(t)),
      ];
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { types: result.results.map((t: any) => ({ key: t.key, name: t.name, id: t.id })) },
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_get_type
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_get_type",
    label: "Get Anytype Type",
    description: "Get details of a specific type in a space.",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      type_id: Type.String({ description: "Type ID" }),
    }),
    async execute(_id, params) {
      ensureAuth();
      const t = await client.getType(params.space_id, params.type_id);
      return {
        content: [{ type: "text", text: fmtType(t) }],
        details: t,
      };
    },
  });

  pi.registerTool({
    name: "anytype_create_type",
    label: "Create Anytype Type",
    description: "Create a custom object type in a space.",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      name: Type.String({ description: "Type singular name" }),
      plural_name: Type.String({ description: "Type plural name" }),
      layout: Type.String({ description: "Type layout (e.g. basic, note, bookmark, set, collection)" }),
      key: Type.Optional(Type.String({ description: "Optional custom type key" })),
      icon_emoji: Type.Optional(Type.String({ description: "Optional emoji icon" })),
      properties: Type.Optional(Type.Array(Type.Object({
        key: Type.String({ description: "Property key" }),
      }))),
    }),
    async execute(_id, params) {
      ensureAuth();
      const t = await client.createType(params.space_id, {
        name: params.name,
        plural_name: params.plural_name,
        layout: params.layout,
        key: params.key,
        icon: params.icon_emoji ? { emoji: params.icon_emoji } : undefined,
        properties: params.properties,
      });
      return {
        content: [{ type: "text", text: `Created type: ${fmtType(t)}` }],
        details: t,
      };
    },
  });

  pi.registerTool({
    name: "anytype_update_type",
    label: "Update Anytype Type",
    description: "Update an existing custom type in a space.",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      type_id: Type.String({ description: "Type ID" }),
      name: Type.Optional(Type.String({ description: "New singular name" })),
      plural_name: Type.Optional(Type.String({ description: "New plural name" })),
      key: Type.Optional(Type.String({ description: "New key" })),
      layout: Type.Optional(Type.String({ description: "New layout" })),
      icon_emoji: Type.Optional(Type.String({ description: "New emoji icon" })),
      properties: Type.Optional(Type.Array(Type.Object({
        key: Type.String({ description: "Property key" }),
      }))),
    }),
    async execute(_id, params) {
      ensureAuth();
      const t = await client.updateType(params.space_id, params.type_id, {
        name: params.name,
        plural_name: params.plural_name,
        key: params.key,
        layout: params.layout,
        icon: params.icon_emoji ? { emoji: params.icon_emoji } : undefined,
        properties: params.properties,
      });
      return {
        content: [{ type: "text", text: `Updated type: ${fmtType(t)}` }],
        details: t,
      };
    },
  });

  pi.registerTool({
    name: "anytype_delete_type",
    label: "Delete Anytype Type",
    description: "Archive/delete a custom type from a space.",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      type_id: Type.String({ description: "Type ID" }),
    }),
    async execute(_id, params) {
      ensureAuth();
      await client.deleteType(params.space_id, params.type_id);
      return {
        content: [{ type: "text", text: `Deleted type \`${params.type_id}\`.` }],
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_list_objects
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_list_objects",
    label: "List Anytype Objects",
    description:
      "List objects in an Anytype space. Supports pagination.",
    promptSnippet: "List all objects in an Anytype space",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      limit: Type.Optional(
        Type.Number({ description: "Max results (default 20)", default: 20 }),
      ),
      offset: Type.Optional(
        Type.Number({ description: "Skip this many results", default: 0 }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      ensureAuth();
      const result = await client.listObjects(params.space_id, {
        limit: params.limit ?? 20,
        offset: params.offset,
      });
      const lines = [
        `${result.total} object(s) in space${result.has_more ? " (more available)" : ""}:`,
        "",
        ...result.results.map((o: any) => fmtObject(o)),
      ];
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { total: result.total, ids: result.results.map((o: any) => o.id) },
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_list_views
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_list_views",
    label: "List Anytype List Views",
    description: "List views configured for a collection/query (list).",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      list_id: Type.String({ description: "Collection/Set (list) object ID" }),
      limit: Type.Optional(Type.Number({ description: "Max results (default 20)", default: 20 })),
      offset: Type.Optional(Type.Number({ description: "Skip this many results", default: 0 })),
    }),
    async execute(_id, params) {
      ensureAuth();
      const result = await client.getListViews(params.space_id, params.list_id, {
        limit: params.limit ?? 20,
        offset: params.offset,
      });
      const lines = [
        `${result.total} view(s):`,
        "",
        ...result.results.map((v: any) => `🧩 **${v.name ?? "Untitled"}** (id: \`${v.id}\`, layout: ${v.layout ?? "?"})`),
      ];
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { views: result.results.map((v: any) => ({ id: v.id, name: v.name, layout: v.layout })) },
      };
    },
  });

  pi.registerTool({
    name: "anytype_list_list_objects",
    label: "List Objects in Collection/Set",
    description: "List objects contained in a specific collection/query view.",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      list_id: Type.String({ description: "Collection/Set (list) ID" }),
      view_id: Type.String({ description: "View ID" }),
      limit: Type.Optional(Type.Number({ description: "Max results (default 20)", default: 20 })),
      offset: Type.Optional(Type.Number({ description: "Skip this many results", default: 0 })),
    }),
    async execute(_id, params) {
      ensureAuth();
      const result = await client.getListObjects(params.space_id, params.list_id, params.view_id, {
        limit: params.limit ?? 20,
        offset: params.offset,
      });
      const lines = [
        `${result.total} object(s) in list/view${result.has_more ? " (more available)" : ""}:`,
        "",
        ...result.results.map((o: any) => fmtObject(o)),
      ];
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { total: result.total, ids: result.results.map((o: any) => o.id) },
      };
    },
  });

  pi.registerTool({
    name: "anytype_add_list_objects",
    label: "Add Objects to Collection/Set",
    description: "Add one or more objects to a collection/query list.",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      list_id: Type.String({ description: "List ID" }),
      object_ids: Type.Array(Type.String(), { description: "Object IDs to add" }),
    }),
    async execute(_id, params) {
      ensureAuth();
      await client.addListObjects(params.space_id, params.list_id, params.object_ids);
      return {
        content: [{ type: "text", text: `Added ${params.object_ids.length} object(s) to list \`${params.list_id}\`.` }],
      };
    },
  });

  pi.registerTool({
    name: "anytype_remove_list_object",
    label: "Remove Object from Collection/Set",
    description: "Remove an object from a collection/query list.",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      list_id: Type.String({ description: "List ID" }),
      object_id: Type.String({ description: "Object ID to remove" }),
    }),
    async execute(_id, params) {
      ensureAuth();
      await client.removeListObject(params.space_id, params.list_id, params.object_id);
      return {
        content: [{ type: "text", text: `Removed object \`${params.object_id}\` from list \`${params.list_id}\`.` }],
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_list_properties
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_list_properties",
    label: "List Anytype Properties",
    description:
      "List available properties in a space (useful for setting properties on objects).",
    promptSnippet: "List properties available in an Anytype space",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      ensureAuth();
      const result = await client.listProperties(params.space_id);
      const lines = [
        `${result.total} propertie(s):`,
        "",
        ...result.results.map((p: any) => fmtProperty(p)),
      ];
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { properties: result.results.map((p: any) => ({ key: p.key, name: p.name, format: p.format, id: p.id })) },
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_get_property / anytype_create_property / anytype_update_property / anytype_delete_property
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_get_property",
    label: "Get Anytype Property",
    description: "Get details of a property in a space.",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      property_id: Type.String({ description: "Property ID" }),
    }),
    async execute(_id, params) {
      ensureAuth();
      const p = await client.getProperty(params.space_id, params.property_id);
      return {
        content: [{ type: "text", text: fmtProperty(p) }],
        details: p,
      };
    },
  });

  pi.registerTool({
    name: "anytype_create_property",
    label: "Create Anytype Property",
    description: "Create a new property in a space.",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      name: Type.String({ description: "Property name" }),
      format: Type.String({ description: "Property format (text, number, date, checkbox, select, multi_select, objects, etc.)" }),
      key: Type.Optional(Type.String({ description: "Optional custom key" })),
      tags: Type.Optional(Type.Array(Type.Object({
        name: Type.String({ description: "Tag name" }),
        color: StringEnum(COLORS, { description: "Tag color" }),
        key: Type.Optional(Type.String({ description: "Optional custom key" })),
      }))),
    }),
    async execute(_id, params) {
      ensureAuth();
      const p = await client.createProperty(params.space_id, {
        name: params.name,
        format: params.format,
        key: params.key,
        tags: params.tags,
      });
      return {
        content: [{ type: "text", text: `Created property: ${fmtProperty(p)}` }],
        details: p,
      };
    },
  });

  pi.registerTool({
    name: "anytype_update_property",
    label: "Update Anytype Property",
    description: "Update a property's metadata (name/key).",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      property_id: Type.String({ description: "Property ID" }),
      name: Type.Optional(Type.String({ description: "New name" })),
      key: Type.Optional(Type.String({ description: "New key" })),
    }),
    async execute(_id, params) {
      ensureAuth();
      const p = await client.updateProperty(params.space_id, params.property_id, {
        name: params.name,
        key: params.key,
      });
      return {
        content: [{ type: "text", text: `Updated property: ${fmtProperty(p)}` }],
        details: p,
      };
    },
  });

  pi.registerTool({
    name: "anytype_delete_property",
    label: "Delete Anytype Property",
    description: "Delete/archive a property from a space.",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      property_id: Type.String({ description: "Property ID" }),
    }),
    async execute(_id, params) {
      ensureAuth();
      await client.deleteProperty(params.space_id, params.property_id);
      return {
        content: [{ type: "text", text: `Deleted property \`${params.property_id}\`.` }],
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_list_tags
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_list_tags",
    label: "List Anytype Tags",
    description:
      "List tags for a specific select/multi_select property in a space.",
    promptSnippet: "List tags for an Anytype property",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      property_id: Type.String({ description: "Property ID (select or multi_select type)" }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      ensureAuth();
      const result = await client.listTags(params.space_id, params.property_id);
      const lines = [
        `${result.total} tag(s):`,
        "",
        ...result.results.map((t: any) => fmtTag(t)),
      ];
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { tags: result.results.map((t: any) => ({ key: t.key, name: t.name, color: t.color })) },
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_create_tag
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_create_tag",
    label: "Create Anytype Tag",
    description:
      "Create a new tag option for a select/multi_select property.",
    promptSnippet: "Create tags for Anytype properties",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      property_id: Type.String({ description: "Property ID" }),
      name: Type.String({ description: "Tag name" }),
      color: StringEnum(COLORS, { description: "Tag color", default: "grey" }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      ensureAuth();
      const tag = await client.createTag(params.space_id, params.property_id, {
        name: params.name,
        color: params.color ?? "grey",
      });
      return {
        content: [
          {
            type: "text",
            text: `Created tag: ${fmtTag(tag)}`,
          },
        ],
        details: { key: tag.key, name: tag.name },
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_get_tag / anytype_update_tag / anytype_delete_tag
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_get_tag",
    label: "Get Anytype Tag",
    description: "Get details of a tag from a select/multi_select property.",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      property_id: Type.String({ description: "Property ID" }),
      tag_id: Type.String({ description: "Tag ID" }),
    }),
    async execute(_id, params) {
      ensureAuth();
      const tag = await client.getTag(params.space_id, params.property_id, params.tag_id);
      return {
        content: [{ type: "text", text: fmtTag(tag) }],
        details: tag,
      };
    },
  });

  pi.registerTool({
    name: "anytype_update_tag",
    label: "Update Anytype Tag",
    description: "Update a tag option for a select/multi_select property.",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      property_id: Type.String({ description: "Property ID" }),
      tag_id: Type.String({ description: "Tag ID" }),
      name: Type.Optional(Type.String({ description: "New tag name" })),
      color: Type.Optional(StringEnum(COLORS, { description: "New tag color" })),
      key: Type.Optional(Type.String({ description: "Optional custom key" })),
    }),
    async execute(_id, params) {
      ensureAuth();
      const tag = await client.updateTag(params.space_id, params.property_id, params.tag_id, {
        name: params.name,
        color: params.color,
        key: params.key,
      });
      return {
        content: [{ type: "text", text: `Updated tag: ${fmtTag(tag)}` }],
        details: tag,
      };
    },
  });

  pi.registerTool({
    name: "anytype_delete_tag",
    label: "Delete Anytype Tag",
    description: "Delete/archive a tag option from a property.",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      property_id: Type.String({ description: "Property ID" }),
      tag_id: Type.String({ description: "Tag ID" }),
    }),
    async execute(_id, params) {
      ensureAuth();
      await client.deleteTag(params.space_id, params.property_id, params.tag_id);
      return {
        content: [{ type: "text", text: `Deleted tag \`${params.tag_id}\` from property \`${params.property_id}\`.` }],
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_list_members
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_list_members",
    label: "List Anytype Members",
    description: "List members of a space with their roles and status.",
    promptSnippet: "List members of an Anytype space",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      ensureAuth();
      const result = await client.listMembers(params.space_id);
      const lines = [
        `${result.total} member(s):`,
        "",
        ...result.results.map((m: any) => {
          const icon = m.icon?.emoji ?? "👤";
          return `${icon} **${m.name ?? m.global_name ?? "Unknown"}** (role: ${m.role ?? "?"}, status: ${m.status ?? "?"})`;
        }),
      ];
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { members: result.results.map((m: any) => ({ id: m.id, name: m.name, role: m.role })) },
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_get_member
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_get_member",
    label: "Get Anytype Member",
    description: "Get details of a specific member in a space.",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      member_id: Type.String({ description: "Member ID" }),
    }),
    async execute(_id, params) {
      ensureAuth();
      const m = await client.getMember(params.space_id, params.member_id);
      const icon = m.icon?.emoji ?? "👤";
      const text = `${icon} **${m.name ?? m.global_name ?? "Unknown"}** (id: \`${m.id}\`, role: ${m.role ?? "?"}, status: ${m.status ?? "?"})`;
      return {
        content: [{ type: "text", text }],
        details: m,
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_list_templates
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_list_templates",
    label: "List Anytype Templates",
    description:
      "List templates available for a specific object type in a space.",
    promptSnippet: "List templates for an Anytype object type",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      type_id: Type.String({ description: "Type ID to list templates for" }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      ensureAuth();
      const result = await client.listTemplates(params.space_id, params.type_id);
      const lines = [
        `${result.total} template(s):`,
        "",
        ...result.results.map((t: any) => {
          const icon = t.icon?.emoji ?? "📋";
          return `${icon} **${t.name ?? "Untitled"}** (id: \`${t.id}\`)`;
        }),
      ];
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { templates: result.results.map((t: any) => ({ id: t.id, name: t.name })) },
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_get_template
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_get_template",
    label: "Get Anytype Template",
    description: "Get a specific template by ID for a given type.",
    parameters: Type.Object({
      space_id: Type.String({ description: "Space ID" }),
      type_id: Type.String({ description: "Type ID" }),
      template_id: Type.String({ description: "Template ID" }),
    }),
    async execute(_id, params) {
      ensureAuth();
      const t = await client.getTemplate(params.space_id, params.type_id, params.template_id);
      const lines = [
        `📋 **${t.name ?? "Untitled"}** (id: \`${t.id}\`)`,
        "",
        (t.markdown ?? t.body) ? truncate(t.markdown ?? t.body, 4000) : "(no body content)",
      ];
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: t,
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool: anytype_quick_note
  // ---------------------------------------------------------------------------

  pi.registerTool({
    name: "anytype_quick_note",
    label: "Quick Note to Anytype",
    description:
      "Create a quick note in Anytype. Finds or uses a space and creates a note object with the given content. If no space specified, uses the first available space.",
    promptSnippet:
      "Quickly create a note in Anytype without needing to know type keys or space IDs",
    promptGuidelines: [
      "Use this when the user just wants to jot something down quickly in Anytype.",
      "Automatically resolves the space and uses the 'note' or 'page' type.",
    ],
    parameters: Type.Object({
      name: Type.String({ description: "Note title" }),
      body: Type.String({ description: "Note content (markdown)" }),
      space_id: Type.Optional(
        Type.String({ description: "Space ID (auto-detects first space if omitted)" }),
      ),
      icon_emoji: Type.Optional(
        Type.String({ description: "Emoji icon (default: '📝')" }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      ensureAuth();

      // Resolve space
      let spaceId = params.space_id;
      if (!spaceId) {
        const spaces = await client.listSpaces({ limit: 1 });
        if (!spaces.results.length) {
          throw new Error("No spaces found. Create one first with anytype_create_space tool.");
        }
        spaceId = spaces.results[0].id;
      }

      // Try 'note' type, fallback to 'page'
      const types = await client.listTypes(spaceId);
      const typeKeys = new Set(types.results.map((t: any) => t.key));
      const typeKey = typeKeys.has("note") ? "note" : typeKeys.has("page") ? "page" : types.results[0]?.key;

      if (!typeKey) {
        throw new Error("No object types found in space.");
      }

      const obj = await client.createObject(spaceId, {
        type_key: typeKey,
        name: params.name,
        body: params.body,
        icon: { emoji: params.icon_emoji ?? "📝" },
      });

      return {
        content: [
          {
            type: "text",
            text: `Quick note created in space \`${spaceId}\`: ${fmtObject(obj)}`,
          },
        ],
        details: { id: obj.id, space_id: spaceId, type_key: typeKey },
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function formatPropertyValue(p: any): string {
    if (p.checkbox !== undefined && p.checkbox !== null) return String(Boolean(p.checkbox));
    if (p.text !== undefined && p.text !== null) return String(p.text);
    if (p.number !== undefined && p.number !== null) return String(p.number);
    if (p.date !== undefined && p.date !== null) return String(p.date);
    if (Array.isArray(p.tags) && p.tags.length > 0) {
      return p.tags.map((t: any) => t.name ?? t.key ?? t.id).join(", ");
    }
    if (p.select) {
      if (typeof p.select === "string") return p.select;
      return p.select.name ?? p.select.key ?? p.select.id ?? "(selected)";
    }
    if (Array.isArray(p.objects) && p.objects.length > 0) {
      return p.objects.join(", ");
    }
    if (p.url !== undefined && p.url !== null) return String(p.url);
    if (p.email !== undefined && p.email !== null) return String(p.email);
    if (p.phone !== undefined && p.phone !== null) return String(p.phone);
    if (Array.isArray(p.files) && p.files.length > 0) {
      return p.files.map((f: any) => f.name ?? f.id ?? "file").join(", ");
    }
    return "(unset)";
  }

  function defaultValueForFormat(format?: string): string {
    if (format === "checkbox") return "false (default)";
    return "(unset)";
  }

  function ensureAuth() {
    if (!client.isAuthenticated) {
      throw new Error(
        "Not authenticated. Run /anytype-login or set ANYTYPE_API_KEY env var.",
      );
    }
  }
}
