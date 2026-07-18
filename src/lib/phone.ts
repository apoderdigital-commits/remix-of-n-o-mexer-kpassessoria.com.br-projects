// Normaliza para o formato exigido pela API (n8n): 55 + DDD + número
// Ex.: "(81) 98504-8696" -> "5581985048696"
export function normalizeBrPhone(input: string): string {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return "";
  // remove zeros à esquerda e prefixo internacional "00"
  let d = digits.replace(/^0+/, "");
  if (d.startsWith("55") && d.length >= 12) return d;
  return `55${d}`;
}

export function isValidBrPhone(input: string): boolean {
  const d = normalizeBrPhone(input);
  // 55 + DDD(2) + 8 ou 9 dígitos = 12 ou 13
  return /^55\d{2}9?\d{8}$/.test(d);
}
