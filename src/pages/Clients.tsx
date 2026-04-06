import { useState } from "react";
import { useClients } from "@/hooks/useDashboardData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Clients() {
  const { data: clients, isLoading } = useClients();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [metaAccountId, setMetaAccountId] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [googleSheetId, setGoogleSheetId] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("clients").insert({
      name: name.trim(),
      meta_account_id: metaAccountId.trim() || null,
      meta_access_token: metaToken.trim() || null,
    });
    if (error) {
      toast.error("Erro ao criar cliente: " + error.message);
      return;
    }
    toast.success("Cliente criado com sucesso!");
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    setName("");
    setMetaAccountId("");
    setMetaToken("");
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      return;
    }
    toast.success("Cliente excluído");
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Gestão de Clientes</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border/50">
            <DialogHeader>
              <DialogTitle>Adicionar Cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Nome do Cliente</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Moto Honda Recife"
                />
              </div>
              <div className="space-y-2">
                <Label>Meta Account ID</Label>
                <Input
                  value={metaAccountId}
                  onChange={(e) => setMetaAccountId(e.target.value)}
                  placeholder="Ex: 123456789"
                />
              </div>
              <div className="space-y-2">
                <Label>Meta Access Token</Label>
                <Input
                  type="password"
                  value={metaToken}
                  onChange={(e) => setMetaToken(e.target.value)}
                  placeholder="Token de longa duração"
                />
              </div>
              <Button onClick={handleCreate} className="w-full">
                Criar Cliente
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Clientes Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : !clients?.length ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum cliente cadastrado
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead className="text-muted-foreground">Nome</TableHead>
                  <TableHead className="text-muted-foreground">Meta Account ID</TableHead>
                  <TableHead className="text-muted-foreground">Criado em</TableHead>
                  <TableHead className="text-right text-muted-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id} className="border-border/20">
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.meta_account_id || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(c.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
