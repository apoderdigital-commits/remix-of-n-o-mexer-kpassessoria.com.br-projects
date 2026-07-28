// Exporta a projeção do funil como imagem PNG — a TELA COMPLETA:
// os 3 funis + "Atual vs Desejado" + "Comparativo Geral" + "Plano de Ação".
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

// ── Paleta por tema ──────────────────────────────────────────────────────────
// O PNG segue o tema em que a dash está (claro/escuro). Os tons do modo claro
// são versões mais escuras dos acentos, para manter contraste sobre fundo claro.
export type TemaExport = "light" | "dark";

interface Paleta {
  bg: string; card: string; borda: string; titulo: string;
  label: string; valor: string; positivo: string; rodape: string;
  atual: string; desejado: string; projetado: string; caixa: string;
  marca: string; vazio: string;
}

const PALETAS: Record<TemaExport, Paleta> = {
  dark: {
    bg: "#0a0a12", card: "#13131b", borda: "#26262f", titulo: "#ffffff",
    label: "#9aa3b2", valor: "#f3f4f6", positivo: "#34d399", rodape: "#6b6b78",
    atual: "#94a3b8", desejado: "#fbbf24", projetado: "#a855f7", caixa: "#0f0f16",
    marca: "#a855f7", vazio: "#6b6b78",
  },
  light: {
    bg: "#f4f5f7", card: "#ffffff", borda: "#e2e5ea", titulo: "#0f172a",
    label: "#64748b", valor: "#0f172a", positivo: "#047857", rodape: "#6b7280",
    atual: "#64748b", desejado: "#b45309", projetado: "#7c3aed", caixa: "#f8fafc",
    marca: "#7c3aed", vazio: "#71809a",
  },
};

// Preenchida no início de buildProjecaoSvg — as funções de seção leem daqui.
let P: Paleta = PALETAS.dark;

// ── 1) Os três funis ─────────────────────────────────────────────────────────
const FUNNEL_TOP = 100;
const FUNNEL_H = 620;

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
  let y = FUNNEL_TOP + 50;
  let body = "";
  rows.forEach(([label, val, extra]) => {
    body += `<text x="${x + 20}" y="${y}" fill="${P.label}" font-size="15">${esc(label)}</text>`;
    body += `<text x="${x + cw - 20}" y="${y}" fill="${P.valor}" font-size="17" font-weight="700" text-anchor="end">${esc(val)}${extra ? `  <tspan fill="${accent}" font-size="13">(${esc(extra)})</tspan>` : ""}</text>`;
    y += 36;
  });
  y += 6;
  body += `<line x1="${x + 18}" y1="${y - 18}" x2="${x + cw - 18}" y2="${y - 18}" stroke="${P.borda}" stroke-width="1"/>`;
  totals.forEach(([label, val]) => {
    body += `<text x="${x + 20}" y="${y}" fill="${P.label}" font-size="14">${esc(label)}</text>`;
    body += `<text x="${x + cw - 20}" y="${y}" fill="${P.positivo}" font-size="15" font-weight="700" text-anchor="end">${esc(val)}</text>`;
    y += 32;
  });
  return `
    <rect x="${x}" y="${FUNNEL_TOP}" width="${cw}" height="${FUNNEL_H}" rx="16" fill="${P.card}" stroke="${P.borda}"/>
    <rect x="${x}" y="${FUNNEL_TOP}" width="${cw}" height="6" rx="3" fill="${accent}"/>
    <text x="${x + 20}" y="${FUNNEL_TOP + 35}" fill="${P.titulo}" font-size="20" font-weight="800">${esc(title)}</text>
    ${body}`;
}

// ── Moldura reutilizável de seção ────────────────────────────────────────────
function sectionFrame(y: number, h: number, title: string, accent: string): string {
  return `
    <rect x="40" y="${y}" width="${W - 80}" height="${h}" rx="16" fill="${P.card}" stroke="${P.borda}"/>
    <rect x="40" y="${y}" width="${W - 80}" height="6" rx="3" fill="${accent}"/>
    <text x="64" y="${y + 40}" fill="${P.titulo}" font-size="19" font-weight="800">${esc(title)}</text>
    <line x1="56" y1="${y + 58}" x2="${W - 56}" y2="${y + 58}" stroke="${P.borda}" stroke-width="1"/>`;
}

// ── 2) Atual vs Desejado — quanto batemos da meta ────────────────────────────
// Altura calculada, não chutada: 120 (cabeçalho) + 6 linhas x 34 = a tabela
// termina em +290; as caixas de taxa ficam em (AVD_H - 96). Com 400 o título
// "TAXAS DE CONVERSÃO" caía exatamente sobre a última linha — daí os 460.
const AVD_H = 460;

function atualVsDesejado(y: number, a: ProjCalc, d: ProjCalc): string {
  const rows: [string, number, number, boolean][] = [
    ["Investimento", a.investimento, d.investimento, true],
    ["Leads", a.leads, d.leads, false],
    ["Pré-Atendimento", a.preAtendimento, d.preAtendimento, false],
    ["Qualificados", a.qualificados, d.qualificados, false],
    ["Vendas", a.vendas, d.vendas, false],
    ["Faturamento", a.faturamento, d.faturamento, true],
  ];
  const cEtapa = 90, cAtual = 640, cDesej = 890, cPct = 1150;
  let body = `
    <text x="${cEtapa}" y="${y + 86}" fill="${P.label}" font-size="13">Etapa</text>
    <text x="${cAtual}" y="${y + 86}" fill="${P.label}" font-size="13" text-anchor="end">Atual</text>
    <text x="${cDesej}" y="${y + 86}" fill="${P.desejado}" font-size="13" text-anchor="end">Desejado</text>
    <text x="${cPct}" y="${y + 86}" fill="${P.label}" font-size="13" text-anchor="end">% Atingido</text>`;
  let ry = y + 120;
  rows.forEach(([label, av, dv, money]) => {
    const pct = dv > 0 ? (av / dv) * 100 : null;
    // Status do atingimento — tons próprios por tema (no claro, os vivos somem).
    const OK = P.bg === PALETAS.dark.bg ? "#34d399" : "#047857";
    const MEIO = P.bg === PALETAS.dark.bg ? "#fbbf24" : "#b45309";
    const RUIM = P.bg === PALETAS.dark.bg ? "#f87171" : "#b91c1c";
    const cor = pct === null ? P.vazio : pct >= 100 ? OK : pct >= 80 ? MEIO : RUIM;
    const txt = pct === null ? "—" : pct.toFixed(0) + "%";
    const fmt = money ? brl : intf;
    body += `
      <text x="${cEtapa}" y="${ry}" fill="${P.valor}" font-size="15">${esc(label)}</text>
      <text x="${cAtual}" y="${ry}" fill="${P.valor}" font-size="16" font-weight="700" text-anchor="end">${esc(fmt(av))}</text>
      <text x="${cDesej}" y="${ry}" fill="${P.desejado}" font-size="16" font-weight="700" text-anchor="end">${esc(fmt(dv))}</text>
      <text x="${cPct}" y="${ry}" fill="${cor}" font-size="16" font-weight="700" text-anchor="end">${esc(txt)}</text>`;
    ry += 34;
  });

  // Taxas de conversão (atual -> desejado)
  const taxas: [string, number, number][] = [
    ["Pré-Atend.", a.taxaPre, d.taxaPre],
    ["Qualificados", a.taxaQual, d.taxaQual],
    ["Vendas", a.taxaVendas, d.taxaVendas],
  ];
  const boxY = y + AVD_H - 96;
  body += `<text x="${W / 2}" y="${boxY - 14}" fill="${P.label}" font-size="12" letter-spacing="2" text-anchor="middle">TAXAS DE CONVERSÃO</text>`;
  const bw = 352, gap = 16, startX = 56;
  taxas.forEach(([label, av, dv], i) => {
    const bx = startX + i * (bw + gap);
    body += `
      <rect x="${bx}" y="${boxY}" width="${bw}" height="64" rx="10" fill="${P.caixa}" stroke="${P.borda}"/>
      <text x="${bx + bw / 2}" y="${boxY + 24}" fill="${P.label}" font-size="12" text-anchor="middle">${esc(label)}</text>
      <text x="${bx + bw / 2}" y="${boxY + 48}" fill="${P.valor}" font-size="16" font-weight="700" text-anchor="middle">${esc(pctf(av))}  →  <tspan fill="${P.desejado}">${esc(pctf(dv))}</tspan></text>`;
  });

  return sectionFrame(y, AVD_H, "Atual vs Desejado — O quanto batemos da meta?", P.desejado) + body;
}

// ── 3) Comparativo geral — 3 funis ───────────────────────────────────────────
const CG_H = 372;

function comparativoGeral(y: number, a: ProjCalc, d: ProjCalc, p: ProjCalc): string {
  const rows: [string, (c: ProjCalc) => string][] = [
    ["Investimento", (c) => brl(c.investimento)],
    ["CPL", (c) => brl(c.cpl)],
    ["Leads", (c) => intf(c.leads)],
    ["Pré-Atendimento", (c) => intf(c.preAtendimento)],
    ["Qualificados", (c) => intf(c.qualificados)],
    ["Vendas", (c) => intf(c.vendas)],
    ["Faturamento", (c) => brl(c.faturamento)],
    ["Custo/Venda", (c) => brl(c.custoPorVenda)],
  ];
  const cEtapa = 90, cA = 640, cD = 890, cP = 1150;
  let body = `
    <text x="${cEtapa}" y="${y + 86}" fill="${P.label}" font-size="13">Etapa</text>
    <text x="${cA}" y="${y + 86}" fill="${P.label}" font-size="13" text-anchor="end">Atual</text>
    <text x="${cD}" y="${y + 86}" fill="${P.desejado}" font-size="13" text-anchor="end">Desejado</text>
    <text x="${cP}" y="${y + 86}" fill="${P.projetado}" font-size="13" text-anchor="end">Projetado</text>`;
  let ry = y + 118;
  rows.forEach(([label, fmt]) => {
    body += `
      <text x="${cEtapa}" y="${ry}" fill="${P.valor}" font-size="15">${esc(label)}</text>
      <text x="${cA}" y="${ry}" fill="${P.valor}" font-size="16" font-weight="700" text-anchor="end">${esc(fmt(a))}</text>
      <text x="${cD}" y="${ry}" fill="${P.desejado}" font-size="16" font-weight="700" text-anchor="end">${esc(fmt(d))}</text>
      <text x="${cP}" y="${ry}" fill="${P.projetado}" font-size="16" font-weight="700" text-anchor="end">${esc(fmt(p))}</text>`;
    ry += 31;
  });
  return sectionFrame(y, CG_H, "Comparativo Geral — 3 Funis", P.projetado) + body;
}

// ── 4) Plano de ação ─────────────────────────────────────────────────────────
// Quebra manual: não há DOM para medir texto, então estima ~95 caracteres por
// linha a 15px numa largura útil de ~1120px.
function wrapText(txt: string, maxChars: number): string[] {
  const out: string[] = [];
  (txt || "").split(/\r?\n/).forEach((paragraph) => {
    if (!paragraph.trim()) { out.push(""); return; }
    let line = "";
    paragraph.split(/\s+/).forEach((word) => {
      if ((line + " " + word).trim().length > maxChars) {
        if (line) out.push(line);
        line = word;
      } else {
        line = (line ? line + " " : "") + word;
      }
    });
    if (line) out.push(line);
  });
  return out;
}

const planoHeight = (linhas: string[]) => Math.max(150, 112 + linhas.length * 26 + 24);

function planoDeAcao(y: number, notes: string, linhas: string[]): string {
  const h = planoHeight(linhas);
  let body = `<text x="64" y="${y + 78}" fill="${P.label}" font-size="13">Ações e estratégias para o mês projetado</text>`;
  if (!notes.trim()) {
    body += `<text x="64" y="${y + 112}" fill="${P.vazio}" font-size="15">Nenhuma ação registrada.</text>`;
  } else {
    let ly = y + 112;
    linhas.forEach((l) => {
      body += `<text x="64" y="${ly}" fill="${P.valor}" font-size="15">${esc(l)}</text>`;
      ly += 26;
    });
  }
  return sectionFrame(y, h, "Plano de Ação", "#10b981") + body;
}

export function buildProjecaoSvg(
  clientName: string,
  periodo: string,
  atual: ProjCalc,
  desejado: ProjCalc,
  projetado: ProjCalc,
  actionNotes = "",
  tema: TemaExport = "dark",
): string {
  P = PALETAS[tema] ?? PALETAS.dark;
  const linhas = actionNotes.trim() ? wrapText(actionNotes, 95) : [];

  const yAvd = FUNNEL_TOP + FUNNEL_H + 40;
  const yCg = yAvd + AVD_H + 32;
  const yPlano = yCg + CG_H + 32;
  const H = yPlano + planoHeight(linhas) + 60;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">
    <rect width="${W}" height="${H}" fill="${P.bg}"/>
    <text x="40" y="48" fill="${P.marca}" font-size="13" font-weight="700" letter-spacing="2">KP ASSESSORIA · PROJEÇÃO DE VENDAS</text>
    <text x="40" y="80" fill="${P.titulo}" font-size="26" font-weight="800">${esc(clientName)}</text>
    <text x="${W - 40}" y="80" fill="${P.label}" font-size="16" text-anchor="end">${esc(periodo)}</text>
    ${column(40, "Funil Atual", P.atual, atual)}
    ${column(440, "Funil Desejado", P.desejado, desejado)}
    ${column(840, "Funil Projetado", P.projetado, projetado)}
    ${atualVsDesejado(yAvd, atual, desejado)}
    ${comparativoGeral(yCg, atual, desejado, projetado)}
    ${planoDeAcao(yPlano, actionNotes, linhas)}
    <text x="40" y="${H - 24}" fill="${P.rodape}" font-size="12">Gerado em ${new Date().toLocaleDateString("pt-BR")} · KP Assessoria</text>
  </svg>`;
}

// Converte o SVG em um Blob PNG. A altura agora é variável (depende do tamanho
// do plano de ação), então é lida do próprio SVG em vez de uma constante.
export function svgToPngBlob(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const m = svg.match(/<svg[^>]*\bheight="(\d+)"/);
    const h = m ? parseInt(m[1], 10) : 880;
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return reject(new Error("canvas")); }
      const bg = svg.match(/<rect width="\d+" height="\d+" fill="(#[0-9a-fA-F]{6})"/);
      ctx.fillStyle = bg ? bg[1] : "#0a0a12";
      ctx.fillRect(0, 0, W, h);
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
