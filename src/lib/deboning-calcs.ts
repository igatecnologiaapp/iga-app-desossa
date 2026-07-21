export interface Piece {
  peso: number;
  quantidade: number;
}

export interface Losses {
  ossos: number;
  gordura: number;
  retalhos: number;
  descarte: number;
  outros: number;
}

export function totalPieces(pieces: Piece[]): number {
  return pieces.reduce((sum, p) => sum + Number(p.peso) * Number(p.quantidade || 1), 0);
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

export function reconcile(pesoInicial: number, pieces: Piece[], losses: Losses) {
  const aproveitado = totalPieces(pieces);
  const perdas = totalLosses(losses);
  const saldo = Number(pesoInicial) - aproveitado - perdas;
  const rendimento = pesoInicial > 0 ? (aproveitado / pesoInicial) * 100 : 0;
  const perdaPct = pesoInicial > 0 ? (perdas / pesoInicial) * 100 : 0;
  const divergenciaPct = pesoInicial > 0 ? Math.abs(saldo / pesoInicial) * 100 : 0;
  return { aproveitado, perdas, saldo, rendimento, perdaPct, divergenciaPct };
}

/** Custo por Kg aproveitado, dado o valor da compra e o peso aproveitado. */
export function custoPorKg(valorCompra: number, pesoAproveitado: number): number {
  if (!pesoAproveitado || pesoAproveitado <= 0) return 0;
  return valorCompra / pesoAproveitado;
}

/** Preço sugerido de venda dada margem em % sobre o custo. */
export function precoSugerido(custo: number, margemPct: number): number {
  return custo * (1 + margemPct / 100);
}
