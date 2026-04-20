/**
 * Formatting helpers for Anytype API responses.
 */

/** Format a space for display */
export function fmtSpace(s: any): string {
  const icon = s.icon?.emoji ?? s.icon?.image?.url ?? "📁";
  return `${icon} **${s.name}** (id: \`${s.id}\`)`;
}

/** Format an object for display */
export function fmtObject(o: any): string {
  const icon = o.icon?.emoji ?? o.icon?.image?.url ?? "📄";
  const snippet = o.snippet ? `\n  > ${o.snippet}` : "";
  const typeName = o.type?.name ?? o.type?.key ?? o.type_key ?? "";
  return `${icon} **${o.name ?? "Untitled"}** (id: \`${o.id}\`)` +
    (typeName ? ` type: \`${typeName}\`` : "") +
    snippet;
}

/** Format a type for display */
export function fmtType(t: any): string {
  const icon = t.icon?.emoji ?? "📎";
  return `${icon} **${t.name}** (key: \`${t.key}\`, id: \`${t.id}\`)` +
    (t.layout ? ` layout: ${t.layout}` : "");
}

/** Format a property for display */
export function fmtProperty(p: any): string {
  return `**${p.name}** (key: \`${p.key}\`, format: \`${p.format}\`)`;
}

/** Format a tag for display */
export function fmtTag(t: any): string {
  return `${t.color ?? ""} **${t.name}** (key: \`${t.key}\`)`;
}

/** Truncate a string */
export function truncate(s: string, max = 2000): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}
