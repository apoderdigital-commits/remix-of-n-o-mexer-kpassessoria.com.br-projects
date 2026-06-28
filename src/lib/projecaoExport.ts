// Exporta a projeção do funil (Atual / Desejado / Projetado) como imagem PNG.
// Sem dependências: gera um SVG e converte para PNG via canvas.

export interface ProjCalc {
  investimento: number; cpl: number; leads: number; preAtendimento: number;
  qualificados: number; vendas: number; ticketMedio: number;
  taxaPre: number; taxaQual: number; taxaVendas: number;
  custoPorPre: number; custoPorQual: number; custoPorVenda: number; faturamento: number;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const brl = (n: number) => "R$ " + (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intf = (n: number) => Math.round(n || 0).toLocaleString("pt-BR");
const pctf = (n: number) => (n || 0).toFixed(1) + "%";

const W = 1240;
const H = 880;

function column(x: number, title: string, accent: string, c: ProjCalc): string {
  const cw = 360;
  const rows: [string, string, string?][] = [
    ["Investimento", brl(c.investimento)],
    ["CPL", brl(c.cpl)],
    ["Leads", intf(c.leads)],
    ["Pré-Atendimento", intf(c.preAtendimento), pctf(c.taxaPre)],
    ["Qualificados", intf(c.qualificados), pctf(c.taxaQual)],
    ["Vendas", intf(c.vendas), pctf(c.taxaVendas)],
    ["Ticket Médio", brl(c.ticketMedio)],
  ];
  const totals: [string, string][] = [
    ["Faturamento", brl(c.faturamento)],
    ["Custo / Venda", brl(c.custoPorVenda)],
    ["Custo / Qualificado", brl(c.custoPorQual)],
    ["Custo / Pré-Atend.", brl(c.custoPorPre)],
  ];
  let y = 150;
  let body = "";
  rows.forEach(([label, val, extra]) => {
    body += `<text x="${x + 20}" y="${y}" fill="#9aa3b2" font-size="15">${esc(label)}</text>`;
    body += `<text x="${x + cw - 20}" y="${y}" fill="#f3f4f6" font-size="17" font-weight="700" text-anchor="end">${esc(val)}${extra ? `  <tspan fill="${accent}" font-size="13">(${esc(extra)})</tspan>` : ""}</text>`;
    y += 36;
  });
  y += 6;
  body += `<line x1="${x + 18}" y1="${y - 18}" x2="${x + cw - 18}" y2="${y - 18}" stroke="#27272f" stroke-width="1"/>`;
  totals.forEach(([label, val]) => {
    body += `<text x="${x + 20}" y="${y}" fill="#9aa3b2" font-size="14">${esc(label)}</text>`;
    body += `<text x="${x + cw - 20}" y="${y}" fill="#34d399" font-size="15" font-weight="700" text-anchor="end">${esc(val)}</text>`;
    y += 32;
  });
  return `
    <rect x="${x}" y="100" width="${cw}" height="${H - 160}" rx="16" fill="#13131b" stroke="#26262f"/>
    <rect x="${x}" y="100" width="${cw}" height="6" rx="3" fill="${accent}"/>
    <text x="${x + 20}" y="135" fill="#ffffff" font-size="20" font-weight="800">${esc(title)}</text>
    ${body}`;
}

export function buildProjecaoSvg(clientName: string, periodo: string, atual: ProjCalc, desejado: ProjCalc, projetado: ProjCalc): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">
    <rect width="${W}" height="${H}" fill="#0a0a12"/>
    <text x="40" y="48" fill="#a855f7" font-size="13" font-weight="700" letter-spacing="2">KP ASSESSORIA · PROJEÇÃO DE VENDAS</text>
    <text x="40" y="80" fill="#ffffff" font-size="26" font-weight="800">${esc(clientName)}</text>
    <text x="${W - 40}" y="80" fill="#9aa3b2" font-size="16" text-anchor="end">${esc(periodo)}</text>
    ${column(40, "Funil Atual", "#94a3b8", atual)}
    ${column(440, "Funil Desejado", "#fbbf24", desejado)}
    ${column(840, "Funil Projetado", "#a855f7", projetado)}
    <text x="40" y="${H - 24}" fill="#52525b" font-size="12">Gerado em ${new Date().toLocaleDateString("pt-BR")} · KP Assessoria</text>
  </svg>`;
}

// Converte o SVG em um Blob PNG
export function svgToPngBlob(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return reject(new Error("canvas")); }
      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("blob"))), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img")); };
    img.src = url;
  });
}

export async function downloadProjecaoPng(filename: string, svg: string) {
  const blob = await svgToPngBlob(svg);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
