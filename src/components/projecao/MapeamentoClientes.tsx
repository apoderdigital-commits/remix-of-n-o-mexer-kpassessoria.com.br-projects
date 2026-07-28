// Popup de mapeamento: liga cada cliente do Squad ao cliente correspondente na
// dash de Criativos. Nem todo cliente do Squad roda tráfego, então o vínculo é
// explícito (e opcional) em vez de adivinhado por nome.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Link2, Search, Save, Wand2, CheckCircle2, CircleDashed } from 'lucide-react';

export interface SquadClienteLinha {
  id: string;
  name: string;
  crm_client_id: string | null;
}

interface CrmCliente { id: string; name: string }

interface Props {
  open: boolean;
  onClose: () => void;
  squadNome: string;
  clientes: SquadClienteLinha[];
  onSalvo: () => void;
}

// "Moto Mil Ariquemes | Porto | Vilhena" -> "moto mil ariquemes porto vilhena"
const norm = (s: string) =>
  (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const SEM_VINCULO = '__none__';

export function MapeamentoClientes({ open, onClose, squadNome, clientes, onSalvo }: Props) {
  const [crmClientes, setCrmClientes] = useState<CrmCliente[]>([]);
  const [mapa, setMapa] = useState<Record<string, string | null>>({});
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBusca('');
    setMapa(Object.fromEntries(clientes.map((c) => [c.id, c.crm_client_id])));
    const carregar = async () => {
      setCarregando(true);
      const { data } = await supabase
        .from('clients').select('id, name').is('deleted_at', null).order('name');
      setCrmClientes(((data as any[]) || []).map((c) => ({ id: c.id, name: c.name })));
      setCarregando(false);
    };
    carregar();
  }, [open, clientes]);

  // Sugere o vínculo por nome — só preenche o que ainda está vazio, nunca
  // sobrescreve um vínculo que a pessoa já definiu. Nada é salvo até clicar Salvar.
  const sugerir = () => {
    let achou = 0;
    const novo = { ...mapa };
    clientes.forEach((sc) => {
      if (novo[sc.id]) return;
      const alvo = norm(sc.name);
      const exato = crmClientes.find((c) => norm(c.name) === alvo);
      const parcial = crmClientes.find(
        (c) => alvo.startsWith(norm(c.name)) || norm(c.name).startsWith(alvo)
      );
      const m = exato || parcial;
      if (m) { novo[sc.id] = m.id; achou++; }
    });
    setMapa(novo);
    toast[achou ? 'success' : 'info'](
      achou ? `${achou} sugestão(ões) preenchida(s). Confira e clique em Salvar.` : 'Nenhuma sugestão nova encontrada.'
    );
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const alterados = clientes.filter((c) => (mapa[c.id] ?? null) !== c.crm_client_id);
      if (alterados.length === 0) { toast.info('Nada mudou.'); return; }
      for (const c of alterados) {
        const { error } = await supabase
          .from('squad_clients')
          .update({ crm_client_id: mapa[c.id] ?? null } as any)
          .eq('id', c.id);
        if (error) throw error;
      }
      toast.success(`${alterados.length} vínculo(s) salvo(s).`);
      onSalvo();
      onClose();
    } catch (e: any) {
      const msg = e?.message || '';
      if (/crm_client_id/.test(msg)) {
        toast.error('Falta a migração: peça ao Lovable para rodar squad_clients_crm_link.');
      } else {
        toast.error(msg || 'Não foi possível salvar os vínculos.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const visiveis = useMemo(() => {
    const q = norm(busca);
    return q ? clientes.filter((c) => norm(c.name).includes(q)) : clientes;
  }, [clientes, busca]);

  const vinculados = useMemo(
    () => clientes.filter((c) => mapa[c.id]).length,
    [clientes, mapa]
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Mapear clientes — {squadNome}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Ligue cada cliente do Squad ao cadastro dele na dash de Criativos. Quem não roda
          tráfego pode ficar sem vínculo — nesse caso o funil é preenchido à mão.
        </p>

        <div className="flex flex-wrap items-center gap-2 py-1">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente..."
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={sugerir} disabled={carregando}>
            <Wand2 className="h-3.5 w-3.5" /> Sugerir por nome
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {vinculados}/{clientes.length} vinculados
          </span>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5">
          {carregando ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Carregando clientes de Criativos...</p>
          ) : visiveis.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          ) : (
            visiveis.map((sc) => {
              const val = mapa[sc.id];
              return (
                <div
                  key={sc.id}
                  className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/40 px-3 py-2"
                >
                  {val ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <CircleDashed className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 truncate text-sm" title={sc.name}>{sc.name}</span>
                  <Select
                    value={val || SEM_VINCULO}
                    onValueChange={(v) => setMapa({ ...mapa, [sc.id]: v === SEM_VINCULO ? null : v })}
                  >
                    <SelectTrigger className="w-[300px] h-9 text-sm shrink-0">
                      <SelectValue placeholder="Sem vínculo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_VINCULO}>
                        <span className="text-muted-foreground">Sem vínculo</span>
                      </SelectItem>
                      {crmClientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border/40 pt-3">
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando} className="gap-1.5">
            <Save className="h-4 w-4" /> {salvando ? 'Salvando...' : 'Salvar vínculos'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
