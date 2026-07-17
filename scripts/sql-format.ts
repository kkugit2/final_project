export function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function sqlTextArray(values: string[]): string {
  if (values.length === 0) return "ARRAY[]::text[]";
  return `ARRAY[${values.map(sqlString).join(",")}]::text[]`;
}

export function sqlUuidArray(values: string[]): string {
  if (values.length === 0) return "ARRAY[]::uuid[]";
  return `ARRAY[${values.map(sqlString).join(",")}]::uuid[]`;
}

export function sqlJsonb(value: unknown): string {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

export function sqlNullableString(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "NULL";
  return sqlString(value);
}

export function sqlNullableNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "NULL";
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? String(num) : "NULL";
}

export function sqlBoolean(value: boolean): string {
  return value ? "true" : "false";
}
