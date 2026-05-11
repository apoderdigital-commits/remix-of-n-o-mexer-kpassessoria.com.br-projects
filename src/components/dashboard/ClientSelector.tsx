import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
  CommandSeparator,
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

export function ClientSelector({ clients, selectedId, onSelect }: ClientSelectorProps) {
  const [open, setOpen] = React.useState(false);
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

  const grouped = React.useMemo(() => {
    const squadMap = new Map<string, { id: string; name: string; items: Client[] }>();
    (squads || []).forEach((s) => squadMap.set(s.id, { id: s.id, name: s.name, items: [] }));
    const noSquad: Client[] = [];
    clients.forEach((c) => {
      if (c.squad_id && squadMap.has(c.squad_id)) {
        squadMap.get(c.squad_id)!.items.push(c);
      } else {
        noSquad.push(c);
      }
    });
    const groups = Array.from(squadMap.values()).filter((g) => g.items.length > 0);
    return { groups, noSquad };
  }, [clients, squads]);

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
        className={cn(
          "mr-2 h-4 w-4",
          selectedId === c.id ? "opacity-100" : "opacity-0"
        )}
      />
      {c.name}
    </CommandItem>
  );

  const trigger = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[280px] justify-between bg-secondary border-border/50 text-left font-normal"
        >
          <span className="flex items-center gap-2 min-w-0">
            {selected && (
              <StatusDot ok={!!allOk} />
            )}
            <span className="truncate">
              {selectedName || "Selecione um cliente"}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 bg-card border-border/50">
        <Command>
          <CommandInput placeholder="Buscar cliente..." />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            {grouped.groups.map((g, idx) => (
              <React.Fragment key={g.id}>
                {idx > 0 && <CommandSeparator />}
                <CommandGroup heading={g.name}>
                  {g.items.map(renderItem)}
                </CommandGroup>
              </React.Fragment>
            ))}
            {grouped.noSquad.length > 0 && (
              <>
                {grouped.groups.length > 0 && <CommandSeparator />}
                <CommandGroup heading={grouped.groups.length > 0 ? "Sem squad" : undefined}>
                  {grouped.noSquad.map(renderItem)}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  if (!selected) return trigger;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{trigger}</span>
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
