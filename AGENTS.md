# Pi Anytype Extension

## Qué es

Extensión de pi que permite interactuar con **Anytype** a través de su API REST directamente, sin pasar por MCP. Registra tools nativas que el LLM puede llamar para gestionar espacios, objetos, tareas, propiedades y más.

## Stack

- **Lenguaje**: TypeScript
- **Runtime**: Node.js (cargado via jiti en pi)
- **API**: Anytype REST API v2025-11-08 (`http://127.0.0.1:31009`)
- **Auth**: Bearer token (API key generada desde Anytype Desktop o challenge flow)

## Estructura

```
~/.pi/agent/extensions/anytype/
├── index.ts          # Entry point — reexporta src/index.ts
├── package.json
├── README.md
└── src/
    ├── index.ts      # Extension principal: tools, comandos, lifecycle
    ├── client.ts     # Cliente HTTP para la API REST de Anytype
    ├── config.ts     # Persistencia de API key (~/.config/anytype-pi/)
    └── format.ts     # Helpers de formato para respuestas
```

## Reglas clave

### Formato de respuestas de Anytype

La API responde con shape `{ data, pagination }` para listados y `{ data: {...} }` para recursos individuales. El método `authed()` en `client.ts` normaliza esto automáticamente a:

- Listados → `{ results, total, has_more }`
- Recursos individuales → el objeto directamente

**Nunca** asumir que la respuesta viene en formato plano. Siempre pasar por `authed()`.

### Auth

- La API key se obtiene de 3 fuentes (orden de prioridad):
  1. Env var `ANYTYPE_API_KEY`
  2. Config guardada en `~/.config/anytype-pi/config.json`
  3. Challenge flow interactivo (`/anytype-login`)

- Todas las tools deben llamar `ensureAuth()` al inicio.
- Si no hay API key, el error debe indicar claramente: `/anytype-login` o `ANYTYPE_API_KEY`.

### Tools

- Cada tool debe tener `promptSnippet` (una línea) y opcionalmente `promptGuidelines` (bullets).
- Los IDs de Anytype son strings largos tipo `bafyreic7ib7...`. Siempre mostrarlos en backticks.
- `anytype_quick_note` es la tool de conveniencia: resuelve espacio y tipo automáticamente.
- `anytype_search` soporta tanto búsqueda global como por espacio (parámetro `space_id`).

### PATCH es parcial a nivel de campo, NO a nivel de contenido

El endpoint `PATCH /v1/spaces/{space_id}/objects/{object_id}` es un merge parcial:
- Enviar solo `{name}` → cambia nombre, todo lo demás intacto
- Enviar solo `{properties}` → cambia propiedades, nombre y body intactos

**Pero el campo `markdown` (body) es SIEMPRE un reemplazo completo.** No existe diff, append ni edición por línea/bloque. Para modificar el contenido de una nota:

1. `GET` el objeto completo para obtener el markdown actual
2. Modificar en memoria lo que se necesite (añadir, quitar, reemplazar líneas)
3. `PATCH` con `{markdown: "contenido modificado completo"}`

Esto es importante para que el LLM no asuma que puede mandar solo un fragmento del markdown.

Todas las peticiones a la API llevan:
- `Authorization: Bearer <api_key>`
- `Anytype-Version: 2025-11-08`
- `Content-Type: application/json`

### URL base

- Desktop app: `http://127.0.0.1:31009` (default)
- Anytype CLI: `http://127.0.0.1:31012` (via `ANYTYPE_API_BASE_URL`)

## Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `/anytype-login` | Auth interactiva con challenge de 4 dígitos |
| `/anytype-status` | Verificar conexión con Anytype |

## Tools registradas

### Search
- `anytype_search`

### Spaces
- `anytype_list_spaces`
- `anytype_create_space`
- `anytype_get_space`
- `anytype_update_space`

### Objects
- `anytype_list_objects`
- `anytype_get_object`
- `anytype_create_object`
- `anytype_update_object`
- `anytype_delete_object`
- `anytype_quick_note`

### Lists (collections/sets)
- `anytype_list_views`
- `anytype_list_list_objects`
- `anytype_add_list_objects`
- `anytype_remove_list_object`

### Types
- `anytype_list_types`
- `anytype_get_type`
- `anytype_create_type`
- `anytype_update_type`
- `anytype_delete_type`

### Properties
- `anytype_list_properties`
- `anytype_get_property`
- `anytype_create_property`
- `anytype_update_property`
- `anytype_delete_property`

### Tags
- `anytype_list_tags`
- `anytype_get_tag`
- `anytype_create_tag`
- `anytype_update_tag`
- `anytype_delete_tag`

### Members
- `anytype_list_members`
- `anytype_get_member`

### Templates
- `anytype_list_templates`
- `anytype_get_template`

## Git

- Commits en conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- Remote: `https://github.com/DevGiuDev/pi-anytype.git`
