// Popup de mapeamento: liga cada cliente do Squad ao cliente correspondente na
// dash de Criativos. Nem todo cliente do Squad roda tráfego, então o vínculo é
// explícito (e opcional) em vez de adivinhado por nome.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Link2, Search, Save, Wand2, CheckCircle2, CircleDashed, ChevronsUpDown, Check } from 'lucide-react';

export interface SquadClienteLinha {
  id: string;
  name: string;
  crm_client_id: string | null;
}

interface CrmCliente { id: string; name: string; squad_id: string | null }

interface Props {
  open: boolean;
  onClose: () => void;
  squadId: string;
  squadNome: string;
  clientes: SquadClienteLinha[];
  onSalvo: () => void;
}

// "Moto Mil Ariquemes | Porto | Vilhena" -> "moto mil ariquemes porto vilhena"
const norm = (s: string) =>
  (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function MapeamentoClientes({ open, onClose, squadId, squadNome, clientes, onSalvo }: Props) {
  const [crmClientes, setCrmClientes] = useState<CrmCliente[]>([]);
  const [mapa, setMapa] = useState<Record<string, string | null>>({});
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  // A lista de Criativos também é por squad. Mostrar só a do squad atual encurta
  // muito a busca — mas dá pra abrir para todos, porque nem todo cadastro de
  // Criativos tem squad preenchido.
  const [soDoSquad, setSoDoSquad] = useState(true);

  useEffect(() => {
    if (!open) return;
    setBusca('');
    setMapa(Object.fromEntries(clientes.map((c) => [c.id, c.crm_client_id])));
    const carregar = async () => {
      setCarregando(true);
      const { data } = await supabase
        .from('clients').select('id, name, squad_id').is('deleted_at', null).order('name');
      setCrmClientes(((data as any[]) || []).map((c) => ({
        id: c.id, name: c.name, squad_id: c.squad_id ?? null,
      })));
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
      const pool = soDoSquad ? crmClientes.filter((c) => c.squad_id === squadId) : crmClientes;
      const exato = pool.find((c) => norm(c.name) === alvo);
      const parcial = pool.find(
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

  // Opções do dropdown: só as do squad, salvo quando a pessoa abre para todos.
  // Um cliente já vinculado continua na lista mesmo fora do filtro, senão o
  // vínculo existente apareceria como vazio.
  const opcoes = useMemo(() => {
    if (!soDoSquad) return crmClientes;
    const vinculadosIds = new Set(Object.values(mapa).filter(Boolean) as string[]);
    return crmClientes.filter((c) => c.squad_id === squadId || vinculadosIds.has(c.id));
  }, [crmClientes, soDoSquad, squadId, mapa]);

  const nomeDe = (id: string | null | undefined) =>
    crmClientes.find((c) => c.id === id)?.name || '';

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

        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pb-1">
          <Checkbox checked={soDoSquad} onCheckedChange={(v) => setSoDoSquad(!!v)} />
          Mostrar só os clientes de Criativos deste squad
          <span className="text-muted-foreground/70">({opcoes.length} opções)</span>
        </label>

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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline" role="combobox"
                        className="w-[300px] h-9 shrink-0 justify-between font-normal text-sm"
                      >
                        <span className={`truncate ${val ? '' : 'text-muted-foreground'}`}>
                          {val ? nomeDe(val) : 'Sem vínculo'}
                        </span>
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="end">
                      <Command>
                        <CommandInput placeholder="Buscar em Criativos..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="Sem vinculo"
                              onSelect={() => setMapa({ ...mapa, [sc.id]: null })}
                            >
                              <Check className={`mr-2 h-3.5 w-3.5 ${val ? 'opacity-0' : 'opacity-100'}`} />
                              <span className="text-muted-foreground">Sem vínculo</span>
                            </CommandItem>
                            {opcoes.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.name}
                                onSelect={() => setMapa({ ...mapa, [sc.id]: c.id })}
                              >
                                <Check className={`mr-2 h-3.5 w-3.5 ${val === c.id ? 'opacity-100' : 'opacity-0'}`} />
                                {c.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
