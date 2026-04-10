import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Search, Trash2, Building2, Users, Link, Check } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  ticket_medio: number | null;
  share_token: string;
  created_at: string;
}

export function ClientManager() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [newClientName, setNewClientName] = useState('');
  const [newClientTicket, setNewClientTicket] = useState('');

  const fetchClients = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar clientes');
    } else {
      setClients((data as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, [user]);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      toast.error('Digite o nome do cliente');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('clients').insert({
      user_id: user?.id,
      name: newClientName.trim(),
      ticket_medio: newClientTicket ? parseFloat(newClientTicket) : null,
    } as any);
    setSaving(false);

    if (error) {
      toast.error('Erro ao adicionar cliente');
    } else {
      toast.success('Cliente adicionado!');
      setNewClientName('');
      setNewClientTicket('');
      fetchClients();
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    
    if (error) {
      toast.error('Erro ao excluir cliente');
    } else {
      toast.success(`${name} removido`);
      setClients(clients.filter((c) => c.id !== id));
    }
  };

  const handleCopyShareLink = (client: Client) => {
    const url = `${window.location.origin}/share/${client.share_token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(client.id);
    toast.success('Link copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/20">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            Adicionar Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddClient} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="client-name" className="text-sm text-muted-foreground">Nome do Cliente</Label>
              <Input id="client-name" placeholder="Ex: Honda Fortaleza" value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                className="bg-background/50 border-border/50 focus:border-primary" />
            </div>
            <div className="w-full md:w-48 space-y-2">
              <Label htmlFor="ticket" className="text-sm text-muted-foreground">Ticket Médio (R$)</Label>
              <Input id="ticket" type="number" placeholder="15000" value={newClientTicket} onChange={(e) => setNewClientTicket(e.target.value)}
                className="bg-background/50 border-border/50 focus:border-primary" />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={saving} className="w-full md:w-auto px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                <Plus className="mr-2 h-4 w-4" />
                {saving ? 'Salvando...' : 'Adicionar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-accent/20">
                <Building2 className="h-5 w-5 text-accent" />
              </div>
              Clientes Cadastrados
              <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full">{clients.length}</span>
            </CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background/50 border-border/50 focus:border-primary" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-pulse text-muted-foreground">Carregando...</div>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredClients.map((client) => (
                <div key={client.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-background/30 border border-border/30 hover:border-primary/30 hover:bg-background/50 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-lg font-bold text-primary">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{client.name}</p>
                      {client.ticket_medio && (
                        <p className="text-sm text-muted-foreground">Ticket: R$ {Number(client.ticket_medio).toLocaleString('pt-BR')}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleCopyShareLink(client)}
                      className="opacity-0 group-hover:opacity-100 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-all"
                      title="Copiar link de compartilhamento">
                      {copiedId === client.id ? <Check className="h-4 w-4" /> : <Link className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClient(client.id, client.name)}
                      className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
