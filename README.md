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

## Notas

- La API key también se guarda en: `~/.config/anytype-pi/config.json`
- Versión de API usada por defecto: `2025-11-08`

## Edición de contenido

El PATCH es parcial a nivel de campo (solo mandas lo que cambias), pero el **body/markdown es siempre reemplazo completo**. No hay diff ni edición por línea.

Para modificar el contenido de una nota:
1. `GET` el objeto completo → obtener markdown actual
2. Modificar en memoria (añadir, quitar, reemplazar líneas)
3. `PATCH` con `{body: "contenido modificado completo"}`
