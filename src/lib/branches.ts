export const BRANCHES = [
  { id: "bogado", name: "Sucursal Bogado", address: "Coronel Bogado 1678, Gran Bourg" },
  { id: "peron", name: "Sucursal Perón", address: "Av. Eva Duarte de Perón 1103, Local 2, Gran Bourg" },
] as const;

export type BranchId = (typeof BRANCHES)[number]["id"];
export const BRANCH_IDS = ["bogado", "peron"] as const;

export function branchLabel(id: string | null | undefined): string | null {
  const b = BRANCHES.find((x) => x.id === id);
  return b ? `${b.name} — ${b.address}` : null;
}
