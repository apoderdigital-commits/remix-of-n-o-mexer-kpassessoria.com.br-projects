import * as React from "react";
import { Check, ChevronsUpDown, Users, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Client {
  id: string;
  name: string;
  meta_account_id?: string | null;
  meta_access_token?: string | null;
  google_sheet_id?: string | null;
  ticket_medio?: number | null;
  ghl_api_key?: string | null;
  ghl_location_id?: string | null;
  squad_id?: string | null;
}

interface ClientSelectorProps {
  clients: Client[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        ok ? "bg-emerald-400" : "bg-muted-foreground/40"
      )}
    />
  );
}

const NO_SQUAD = "__none__";

export function ClientSelector({ clients, selectedId, onSelect }: ClientSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [squadOpen, setSquadOpen] = React.useState(false);
  const [squadFilter, setSquadFilter] = React.useState<string>("");

  const selected = clients.find((c) => c.id === selectedId);
  const selectedName = selected?.name;

  const { data: squads } = useQuery({
    queryKey: ["squads_for_selector"],
    queryFn: async () => {
      const { data, error } = await supabase.from("squads").select("id, name").order("name");
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Se já tem um cliente selecionado, alinha o filtro ao squad dele
  React.useEffect(() => {
    if (selected && !squadFilter) {
      setSquadFilter(selected.squad_id || NO_SQUAD);
    }
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasNoSquadClients = React.useMemo(
    () => clients.some((c) => !c.squad_id),
    [clients]
  );

  // Clientes do squad escolhido
  const squadClients = React.useMemo(() => {
    if (!squadFilter) return [];
    if (squadFilter === NO_SQUAD) return clients.filter((c) => !c.squad_id);
    return clients.filter((c) => c.squad_id === squadFilter);
  }, [clients, squadFilter]);

  const squadLabel =
    squadFilter === NO_SQUAD
      ? "Sem squad"
      : squads?.find((s) => s.id === squadFilter)?.name || "Selecionar squad";

  const checks = selected
    ? [
        { label: "Meta ID", ok: !!selected.meta_account_id },
        { label: "Token Meta", ok: !!selected.meta_access_token },
        { label: "Sheet", ok: !!selected.google_sheet_id },
        { label: "Ticket", ok: !!selected.ticket_medio },
        { label: "CRM Key", ok: !!selected.ghl_api_key },
        { label: "Subconta CRM", ok: !!selected.ghl_location_id },
      ]
    : [];
  const okCount = checks.filter((c) => c.ok).length;
  const allOk = selected && okCount === checks.length;

  const renderItem = (c: Client) => (
    <CommandItem
      key={c.id}
      value={c.name}
      onSelect={() => {
        onSelect(c.id);
        setOpen(false);
      }}
    >
      <Check
        className={cn("mr-2 h-4 w-4", selectedId === c.id ? "opacity-100" : "opacity-0")}
      />
      {c.name}
    </CommandItem>
  );

  // ── Botão 1: filtro de squad ──
  const squadButton = (
    <Popover open={squadOpen} onOpenChange={setSquadOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={squadOpen}
          className="w-[190px] justify-between bg-secondary border-border/50 text-left font-normal"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Users className="h-4 w-4 shrink-0 text-primary/80" />
            <span className="truncate">{squadLabel}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[190px] p-0 bg-card border-border/50">
        <Command>
          <CommandList>
            <CommandGroup heading="Squads">
              {(squads || []).map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.name}
                  onSelect={() => {
                    setSquadFilter(s.id);
                    setSquadOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", squadFilter === s.id ? "opacity-100" : "opacity-0")}
                  />
                  {s.name}
                </CommandItem>
              ))}
              {hasNoSquadClients && (
                <CommandItem
                  value="Sem squad"
                  onSelect={() => {
                    setSquadFilter(NO_SQUAD);
                    setSquadOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", squadFilter === NO_SQUAD ? "opacity-100" : "opacity-0")}
                  />
                  Sem squad
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  // ── Botão 2: seletor de cliente (só ativo com squad escolhido) ──
  const squadChosen = !!squadFilter;

  const clientButton = (
    <Popover open={open} onOpenChange={(o) => squadChosen && setOpen(o)}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={!squadChosen}
          className="w-[260px] justify-between bg-secondary border-border/50 text-left font-normal disabled:opacity-60"
        >
          <span className="flex items-center gap-2 min-w-0">
            {!squadChosen && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            {squadChosen && selected && <StatusDot ok={!!allOk} />}
            <span className="truncate">
              {!squadChosen
                ? "Selecione um squad primeiro"
                : selectedName || "Selecione um cliente"}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0 bg-card border-border/50">
        <Command>
          <CommandInput placeholder="Buscar cliente..." />
          <CommandList>
            <CommandEmpty>Nenhum cliente neste squad.</CommandEmpty>
            <CommandGroup heading={squadLabel}>
              {squadClients.map(renderItem)}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  const row = (
    <div className="flex items-center gap-2">
      {squadButton}
      {clientButton}
    </div>
  );

  if (!selected) return row;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{row}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-card border-border/50 p-3">
          <div className="text-xs font-medium mb-2 text-muted-foreground">
            Conexões {okCount}/{checks.length}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {checks.map((c) => (
              <div key={c.label} className="flex items-center gap-2 text-xs">
                <StatusDot ok={c.ok} />
                <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
