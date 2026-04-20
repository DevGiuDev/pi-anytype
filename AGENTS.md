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

### Headers requeridos

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

| Tool | Descripción |
|------|-------------|
| `anytype_search` | Búsqueda global o por espacio |
| `anytype_list_spaces` | Listar espacios |
| `anytype_create_space` | Crear espacio |
| `anytype_get_space` | Detalles de un espacio |
| `anytype_list_objects` | Listar objetos en un espacio |
| `anytype_get_object` | Contenido completo de un objeto |
| `anytype_create_object` | Crear objeto |
| `anytype_update_object` | Actualizar objeto |
| `anytype_delete_object` | Archivar objeto |
| `anytype_list_types` | Tipos disponibles en un espacio |
| `anytype_list_properties` | Propiedades de un espacio |
| `anytype_list_tags` | Tags de una propiedad |
| `anytype_create_tag` | Crear tag |
| `anytype_list_members` | Miembros de un espacio |
| `anytype_list_templates` | Templates de un tipo |
| `anytype_quick_note` | Nota rápida (auto-resuelve espacio y tipo) |

## Git

- Commits en conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- Remote: `https://github.com/DevGiuDev/pi-anytype.git`
