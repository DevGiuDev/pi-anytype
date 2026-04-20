# Anytype extension for pi

Interacción nativa con la API REST de Anytype desde pi (sin MCP intermedio).

## Requisitos

- Anytype Desktop abierto (API local en `http://127.0.0.1:31009`)
- O Anytype CLI/headless (`ANYTYPE_API_BASE_URL`, por ejemplo `http://127.0.0.1:31012`)

## Instalación

La extensión ya está en:

- `~/.pi/agent/extensions/anytype/`

Recarga en pi:

```bash
/reload
```

## Autenticación

### Opción 1: interactiva (recomendada)

```bash
/anytype-login
```

Te pedirá el código de 4 dígitos mostrado en Anytype Desktop.

### Opción 2: por variable de entorno

```bash
export ANYTYPE_API_KEY="<tu_api_key>"
```

## Configuración opcional

Cambiar URL base (por ejemplo Anytype CLI):

```bash
export ANYTYPE_API_BASE_URL="http://127.0.0.1:31012"
```

## Comandos

- `/anytype-login` — autenticación challenge/code
- `/anytype-status` — verifica conexión

## Tools disponibles

- `anytype_list_spaces`
- `anytype_create_space`
- `anytype_get_space`
- `anytype_search`
- `anytype_list_objects`
- `anytype_get_object`
- `anytype_create_object`
- `anytype_update_object`
- `anytype_delete_object`
- `anytype_list_types`
- `anytype_list_properties`
- `anytype_list_tags`
- `anytype_create_tag`
- `anytype_list_members`
- `anytype_list_templates`
- `anytype_quick_note`

## Notas

- La API key también se guarda en: `~/.config/anytype-pi/config.json`
- Versión de API usada por defecto: `2025-11-08`
