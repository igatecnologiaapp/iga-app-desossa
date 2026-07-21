export interface Piece {
  peso: number;
  quantidade: number;
  corte_id?: string | null;
  observacoes?: string | null;
}

export interface Losses {
  ossos: number;
  gordura: number;
  retalhos: number;
  descarte: number;
  outros: number;
}

export const EMPTY_LOSSES: Losses = {
  ossos: 0,
  gordura: 0,
  retalhos: 0,
  descarte: 0,
  outros: 0,
};

export function totalPieces(pieces: Piece[]): number {
  return pieces.reduce((sum, p) => sum + Number(p.peso || 0) * Number(p.quantidade || 1), 0);
}

export function totalLosses(l: Losses): number {
  return (
    Number(l.ossos || 0) +
    Number(l.gordura || 0) +
    Number(l.retalhos || 0) +
    Number(l.descarte || 0) +
    Number(l.outros || 0)
  );
}

export interface Reconciliation {
  aproveitado: number;
  perdas: number;
  totalInformado: number;
  diferenca: number;
  diferencaAbs: number;
  rendimento: number;
  perdaPct: number;
  divergenciaPct: number;
}

export function reconcile(pesoInicial: number, pieces: Piece[], losses: Losses): Reconciliation {
  const inicial = Number(pesoInicial || 0);
  const aproveitado = totalPieces(pieces);
  const perdas = totalLosses(losses);
  const totalInformado = aproveitado + perdas;
  const diferenca = inicial - totalInformado;
  const diferencaAbs = Math.abs(diferenca);
  const rendimento = inicial > 0 ? (aproveitado / inicial) * 100 : 0;
  const perdaPct = inicial > 0 ? (perdas / inicial) * 100 : 0;
  const divergenciaPct = inicial > 0 ? (diferencaAbs / inicial) * 100 : 0;
  return {
    aproveitado,
    perdas,
    totalInformado,
    diferenca,
    diferencaAbs,
    rendimento,
    perdaPct,
    divergenciaPct,
  };
}

export type ReconStatus = "ok" | "atencao" | "critico";

export interface ToleranceConfig {
  divergenciaMaximaKg: number;
  atencaoPct: number;
  criticoPct: number;
}

export const DEFAULT_TOLERANCE: ToleranceConfig = {
  divergenciaMaximaKg: 0.5,
  atencaoPct: 2,
  criticoPct: 5,
};

export function reconStatus(rec: Reconciliation, tol: ToleranceConfig): ReconStatus {
  if (rec.diferencaAbs <= tol.divergenciaMaximaKg && rec.divergenciaPct < tol.atencaoPct) return "ok";
  if (rec.divergenciaPct < tol.criticoPct) return "atencao";
  return "critico";
}

export function statusColors(s: ReconStatus): { dot: string; ring: string; text: string; label: string } {
  if (s === "ok") return { dot: "bg-success", ring: "ring-success/40", text: "text-emerald-700", label: "Dentro da tolerância" };
  if (s === "atencao") return { dot: "bg-warning", ring: "ring-warning/40", text: "text-amber-700", label: "Atenção" };
  return { dot: "bg-destructive", ring: "ring-destructive/40", text: "text-destructive", label: "Divergência crítica" };
}

/** Custo por Kg aproveitado */
export function custoPorKg(valorCompra: number, pesoAproveitado: number): number {
  if (!pesoAproveitado || pesoAproveitado <= 0) return 0;
  return valorCompra / pesoAproveitado;
}

/** Preço sugerido com margem em % sobre o custo */
export function precoSugerido(custo: number, margemPct: number): number {
  return custo * (1 + margemPct / 100);
}
