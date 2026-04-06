import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Client {
  id: string;
  name: string;
}

interface ClientSelectorProps {
  clients: Client[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ClientSelector({ clients, selectedId, onSelect }: ClientSelectorProps) {
  return (
    <Select value={selectedId || ""} onValueChange={onSelect}>
      <SelectTrigger className="w-[240px] bg-secondary border-border/50">
        <SelectValue placeholder="Selecione um cliente" />
      </SelectTrigger>
      <SelectContent className="bg-card border-border/50">
        {clients.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
