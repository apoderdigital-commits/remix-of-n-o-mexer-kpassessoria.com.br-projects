## Problema

1. Os campos **Sheet ID / Aba / Coluna MQL / Valor = MQL** estão vazios — sem isso, o edge function não consegue buscar da planilha e cai no fallback do GHL (mostrando 169 em vez de 26).
2. Mesmo com fonte = "Planilha" selecionada, o card mostra **169** (valor GHL) porque os campos da planilha estão em branco.
3. O usuário não deveria precisar preencher Sheet ID/Aba manualmente — já temos a planilha padrão definida.

## Solução

### 1. Auto-preencher defaults na migration / no load
Quando `kp_comercial_data_sources` for criado (ou estiver com campos nulos/vazios), gravar:
- `sheet_id` = `1esmBP_vybIjhh2aw7miaS-oZMp9pDeroAUhYFaiTs9c`
- `sheet_tab` = `Página4`
- `sheet_mql_column` = `MQL`
- `sheet_mql_value` = `SIM`

Migration faz `UPDATE ... SET ... WHERE sheet_id IS NULL OR sheet_id = ''` para preencher o registro existente.

### 2. UI: mostrar os defaults pré-preenchidos
Em `Comercial.tsx`, na seção "Fontes de dados", inicializar os 4 inputs com os defaults acima quando o registro vier vazio do banco. Salvar automaticamente no primeiro load se estiverem em branco.

### 3. Edge function: garantir que a contagem da planilha bata
Investigar por que a coluna "VIA PLANILHA" mostra **169** em vez de **26**:
- Hoje o fetch usa `/gviz/tq?tqx=out:csv&sheet=Página4` — pode estar puxando a planilha inteira sem filtrar por data.
- Adicionar log dos primeiros registros (cabeçalho + 3 linhas) para descobrir o nome exato da coluna de **data** na Página4.
- Filtrar linhas por `data >= since AND data <= until` antes de contar.
- Conferir que `MQL = SIM` é case-insensitive e ignora espaços (`trim().toUpperCase() === "SIM"`).

### 4. Badge no card
Trocar `leads via GHL · MQLs via GHL` para refletir a fonte realmente selecionada (hoje parece estar travado em GHL mesmo com "Planilha" clicado). Verificar se o radio de fonte está persistindo no banco.

## Ordem

1. Migration: UPDATE `kp_comercial_data_sources` setando os 4 defaults
2. `Comercial.tsx`: inputs vêm pré-preenchidos + persiste se ainda nulo + garante que o clique em "Planilha"/"GHL" salva imediatamente
3. `kp-comercial-snapshot/index.ts`: log do CSV bruto, filtro por data, normalização do MQL
4. Re-rodar snapshot e validar: card deve mostrar **26**, não 169

## Validação

Após aplicar, no card "Leads Totais" com período **18/05 – 24/05** deve aparecer **26** (planilha) e o GHL deve ficar como número de referência ao lado.
