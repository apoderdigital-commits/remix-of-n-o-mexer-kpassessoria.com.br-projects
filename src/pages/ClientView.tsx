/**
 * /view?lid=<ghl_location_id>
 *
 * Página pública (sem login) embutida via iframe no GoHighLevel.
 * Recebe o location ID da subconta via query param e exibe dados
 * daquele cliente automaticamente.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Users, Target, TrendingUp, DollarSign, BarChart3, AlertCircle } from "lucide-react";
import kpLogo from "@/assets/kp-logo.png";

// ── tipos ─────────────────────────────────────────────────────────────────────
interface ClientRow {
  id: string;
  name: string;
  google_sheet_id: string | null;
  ticket_medio: number | null;
  meta_account_id: string | null;
}

interface SheetData {
  leads: number;
  mqls: number;
  rows: number;
}

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(v);

async function fetchSheetData(sheetId: string): Promise<SheetData> {
  // Busca o CSV público da planilha Google Sheets
  const tabs = ["Página4", "Sheet1", "Leads", "página4", "page4"];
  for (const tab of tabs) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const txt = await r.text();
      const lines = txt.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) continue;

      const header = lines[0].split(",").map((h) => h.replace(/"/g, "").toUpperCase().trim());
      const mqlCol = header.findIndex((h) => h === "MQL");

      let leads = 0, mqls = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.replace(/"/g, "").trim());
        if (!cols.some((c) => c)) continue;
        leads++;
        if (mqlCol >= 0 && (cols[mqlCol] || "").toUpperCase() === "SIM") mqls++;
      }
      return { leads, mqls, rows: leads };
    } catch { continue; }
  }
  return { leads: 0, mqls: 0, rows: 0 };
}

// ── componente principal ──────────────────────────────────────────────────────
export default function ClientView() {
  const [params] = useSearchParams();
  const locationId = params.get("lid");

  const [client, setClient] = useState<ClientRow | null>(null);
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!locationId) { setLoading(false); setNotFound(true); return; }

    const load = async () => {
      setLoading(true);
      // Busca cliente pelo ghl_location_id
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, google_sheet_id, ticket_medio, meta_account_id")
        .eq("ghl_location_id", locationId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error || !data) { setLoading(false); setNotFound(true); return; }
      setClient(data as ClientRow);

      // Busca dados da planilha se disponível
      if (data.google_sheet_id) {
        const sd = await fetchSheetData(data.google_sheet_id);
        setSheet(sd);
      }
      setLoading(false);
    };

    load();
  }, [locationId]);

  // ── estados de carregamento/erro ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src={kpLogo} alt="KP" className="h-10 w-10 rounded-xl" />
          <p className="text-sm text-white/40 animate-pulse">Carregando dados…</p>
        </div>
      </div>
    );
  }

  if (notFound || !client) {
    return (
      <div className="min-h-screen bg-[#0d0d14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <AlertCircle className="h-8 w-8 text-white/20" />
          <p className="text-white/40 text-sm">Nenhum cliente vinculado a esta subconta.</p>
        </div>
      </div>
    );
  }

  // ── métricas ──────────────────────────────────────────────────────────────
  const convRate = sheet && sheet.leads > 0
    ? ((sheet.mqls / sheet.leads) * 100).toFixed(1)
    : null;

  const receitaPotencial = sheet && client.ticket_medio && sheet.mqls > 0
    ? sheet.mqls * client.ticket_medio
    : null;

  const cards = [
    {
      icon: Users,
      label: "Leads Qualificados",
      value: sheet ? fmtNum(sheet.leads) : "—",
      sub: "total na planilha",
      color: "text-violet-400",
      bg: "bg-violet-500/10 border-violet-500/20",
    },
    {
      icon: Target,
      label: "MQLs",
      value: sheet ? fmtNum(sheet.mqls) : "—",
      sub: "prontos para reunião",
      color: "text-cyan-400",
      bg: "bg-cyan-500/10 border-cyan-500/20",
    },
    {
      icon: BarChart3,
      label: "Taxa de Conversão",
      value: convRate ? `${convRate}%` : "—",
      sub: "leads → MQL",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      icon: DollarSign,
      label: "Receita Potencial",
      value: receitaPotencial ? fmtBRL(receitaPotencial) : "—",
      sub: `ticket médio ${fmtBRL(client.ticket_medio)}`,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
  ];

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d0d14] text-white font-sans">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0d0d14]/80 backdrop-blur-xl px-5 py-4 flex items-center gap-3">
        <img src={kpLogo} alt="KP" className="h-8 w-8 rounded-lg" />
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/30">KP Assessoria</p>
          <p className="text-sm font-semibold leading-tight">{client.name}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-white/30">ao vivo</span>
        </div>
      </div>

      {/* Cards */}
      <div className="p-5 space-y-4">
        <p className="text-xs uppercase tracking-widest text-white/30">Visão Geral</p>

        <div className="grid grid-cols-2 gap-3">
          {cards.map((c) => (
            <div
              key={c.label}
              className={`rounded-xl border p-4 ${c.bg} flex flex-col gap-1`}
            >
              <div className="flex items-center gap-2">
                <c.icon className={`h-4 w-4 ${c.color}`} />
                <p className="text-[10px] uppercase tracking-wide text-white/40">{c.label}</p>
              </div>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-[10px] text-white/30">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Barra de progresso leads → MQL */}
        {sheet && sheet.leads > 0 && (
          <div className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                Funil de Leads
              </p>
              <span className="text-[10px] text-white/30">{sheet.rows} registros</span>
            </div>

            {/* Leads */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/50">Leads</span>
                <span className="text-white/70 font-medium">{fmtNum(sheet.leads)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-violet-500" style={{ width: "100%" }} />
              </div>
            </div>

            {/* MQLs */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/50">MQLs</span>
                <span className="text-cyan-400 font-medium">{fmtNum(sheet.mqls)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-cyan-500"
                  style={{ width: `${(sheet.mqls / sheet.leads) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Rodapé */}
        <p className="text-center text-[10px] text-white/15 pt-2">
          KP Assessoria · Dados atualizados em tempo real
        </p>
      </div>
    </div>
  );
}
