export const ROLES = ["buyer", "supplier", "admin"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

export function canActAs(actual: Role, required: Role): boolean {
  return actual === required || actual === "admin";
}
