function isValidPtBrDate(dateStr: string): boolean {
  const match = dateStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const parsed = new Date(year, month, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month &&
    parsed.getDate() === day
  );
}

function isLowStock(quantity: number, minQuantity?: number | null): boolean {
  if (typeof minQuantity !== "number" || Number.isNaN(minQuantity)) {
    return false;
  }
  return quantity <= minQuantity;
}

describe("Testes automatizados - Atelier", () => {
  it("1. Valida corretamente datas no formato DD/MM/AAAA", () => {
    expect(isValidPtBrDate("26/11/2026")).toBe(true);
    expect(isValidPtBrDate("31/02/2026")).toBe(false);
    expect(isValidPtBrDate("2026-11-26")).toBe(false);
  });

  it("2. Identifica corretamente itens com estoque baixo ou no limite mínimo", () => {
    expect(isLowStock(2, 5)).toBe(true);
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(8, 5)).toBe(false);
    expect(isLowStock(1, null)).toBe(false);
  });
});