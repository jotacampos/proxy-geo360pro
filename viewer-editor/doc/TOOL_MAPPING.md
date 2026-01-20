# Mapeamento de Ferramentas: Viewer Atual → Novo Layout

Este documento mapeia todas as ferramentas existentes no viewer para sua nova localização no layout com **dois painéis laterais** (Selection Panel + Task Pane).

## Filosofia do Layout

| Painel | Posição | Foco | Comportamento |
|--------|---------|------|---------------|
| **Selection Panel** | Esquerda | **Edição** - O que estou fazendo | Contextual (auto-expande com seleção) |
| **Task Pane** | Direita | **Gestão** - O que existe | Sempre visível (colapsável) |

## Visão Geral do Novo Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              COMPACT RIBBON (~48px)                              │
│  ┌───────┬──────────────────┬──────────────────┬─────────────┬────────────────┐ │
│  │ Geo   │     Desenho      │     Seleção      │    Snap     │    Arquivo     │ │
│  │ 360   │ 📍📏⬡▭⭕⬭       │ ✋⬚⭕🎯        │ 🧲📐       │  📤📥🗑️       │ │
│  └───────┴──────────────────┴──────────────────┴─────────────┴────────────────┘ │
├─────────────────┬───────────────────────────────────────────────┬───────────────┤
│ ▶ SELECTION     │                                               │ ◀ TASK PANE   │
│ ┌─────────────┐ │                                               │ ┌───────────┐ │
│ │ 3 objetos   │ │                                               │ │[📑Camadas]│ │
│ ├─────────────┤ │                                               │ │[📋Atribut]│ │
│ │ ► #42 Pol   │ │                     MAPA                      │ │[📊Análise]│ │
│ │   #43 Pol   │ │                   (deck.gl)                   │ ├───────────┤ │
│ ├─────────────┤ │                                               │ │           │ │
│ │ DETALHES    │ │                      ⬡                        │ │ Camadas:  │ │
│ │ EDIÇÃO 🔓   │ │                  (features)                   │ │ 👁️🖱️🔓🔍 │ │
│ │ OPERAÇÕES   │ │                                               │ │           │ │
│ │ HISTÓRICO   │ │                                               │ │           │ │
│ └─────────────┘ │                                               │ └───────────┘ │
├─────────────────┴───────────────────────────────────────────────┴───────────────┤
│ 📋 TABELA: cadastro.lotes (1.234)      [🔍 Filtrar...] [⚙️ Colunas] [⬇️] [✕]   │
├───────┬──────────────────┬────────────┬─────────────────────────────────────────┤
│   #   │ inscricao        │ area       │ ...                                     │
└───────┴──────────────────┴────────────┴─────────────────────────────────────────┘
```

### Controles de Camada (Task Pane)

| Ícone | Função |
|-------|--------|
| 👁️ | Visível - renderiza no mapa |
| 🖱️ | Selecionável - permite selecionar features |
| 🔓/🔒 | Editável/Bloqueada - permite edição |
| 🔍 | Zoom para extent da camada |

---

## Mapeamento Detalhado

### 1. Ferramentas de Navegação (nav)

| Ferramenta Atual | Atalho | Nova Localização | Observações |
|------------------|--------|------------------|-------------|
| Navegar (view) | V | **Ribbon → Edição** | Primeiro botão, sempre acessível |
| Sel. Referência (select-snap-ref) | R | **Ribbon → Snap** | Agrupa com outras ferramentas de snap |

### 2. Ferramentas de Seleção (select)

| Ferramenta Atual | Atalho | Nova Localização | Observações |
|------------------|--------|------------------|-------------|
| Seleção Retângulo | - | **Ribbon → Edição** | Ícone ⬚ |
| Seleção Laço | - | **Ribbon → Edição** | Ícone ⭕ |

### 3. Ferramentas de Desenho Básico (basic)

| Ferramenta Atual | Atalho | Nova Localização | Observações |
|------------------|--------|------------------|-------------|
| Ponto | P | **Ribbon → Desenho** | Ícone 📍 |
| Linha | L | **Ribbon → Desenho** | Ícone 📏 |
| Polígono | G | **Ribbon → Desenho** | Ícone ⬡ |
| Laço | - | **Ribbon → Desenho** | Ícone 〰️ |
| Estender Linha | - | **Ribbon → Desenho** | Ícone ➡️, habilitado quando linha selecionada |

### 4. Ferramentas de Formas (shapes)

| Ferramenta Atual | Atalho | Nova Localização | Observações |
|------------------|--------|------------------|-------------|
| Retângulo | T | **Ribbon → Desenho** (dropdown) | Ícone ▭ |
| Retângulo Centro | - | **Ribbon → Desenho** (dropdown) | Submenu de Retângulo |
| Retângulo 3 Pontos | - | **Ribbon → Desenho** (dropdown) | Submenu de Retângulo |
| Quadrado | - | **Ribbon → Desenho** (dropdown) | Submenu de Quadrado |
| Quadrado Centro | - | **Ribbon → Desenho** (dropdown) | Submenu de Quadrado |
| Círculo | C | **Ribbon → Desenho** (dropdown) | Ícone ⭕ |
| Círculo Diâmetro | - | **Ribbon → Desenho** (dropdown) | Submenu de Círculo |
| Redim. Círculo | - | **Painel Flutuante** | Aparece quando círculo selecionado |
| Elipse | - | **Ribbon → Desenho** (dropdown) | Ícone ⬭ |
| Elipse 3 Pontos | - | **Ribbon → Desenho** (dropdown) | Submenu de Elipse |
| Polígono 90° | - | **Ribbon → Desenho** | Ícone 📐 |

### 5. Ferramentas de Transformação (transform)

| Ferramenta Atual | Atalho | Nova Localização | Observações |
|------------------|--------|------------------|-------------|
| Editar Vértices | E | **Selection Panel → Edição** | Ícone ✏️, requer seleção |
| Mover | M | **Selection Panel → Edição** | Ícone ↔️, requer seleção |
| Rotacionar | - | **Selection Panel → Edição** | Ícone 🔄, requer seleção |
| Escalar | - | **Selection Panel → Edição** | Ícone ⤢, requer seleção |
| Extrudar | - | **Selection Panel → Operações** | Aparece com polígono selecionado |
| Elevação | - | **Selection Panel → Operações** | Modo 3D (futuro) |
| Transformar | - | **Selection Panel → Edição** | Ícone ⧉ (combinado) |
| Dividir | - | **Selection Panel → Operações** | Requer 1 polígono selecionado |
| Duplicar | - | **Selection Panel → Edição** | Ícone 📋, também Ctrl+D |
| Excluir | D | **Selection Panel → Edição** | Ícone 🗑️, também Delete key |

**Nota:** Ferramentas de transformação aparecem no Selection Panel porque dependem de ter objetos selecionados.

### 6. Ferramentas Compostas (composite)

| Ferramenta Atual | Atalho | Nova Localização | Observações |
|------------------|--------|------------------|-------------|
| Desenhar + Editar | - | **Ribbon → Desenho** | Modo avançado, ícone 🔀 |

### 7. Ferramentas de Medição (measure)

| Ferramenta Atual | Atalho | Nova Localização | Observações |
|------------------|--------|------------------|-------------|
| Medir Distância | - | **Task Pane → Análise** | Também acessível via Ribbon |
| Medir Área | - | **Task Pane → Análise** | Também acessível via Ribbon |
| Medir Ângulo | - | **Task Pane → Análise** | Também acessível via Ribbon |

### 8. Controles de Snap

| Ferramenta Atual | Atalho | Nova Localização | Observações |
|------------------|--------|------------------|-------------|
| Toggle Snap | S | **Ribbon → Snap** | Botão principal 🧲 |
| Modo (vertex/edge/both) | - | **Ribbon → Snap** (Popover) | Aparece ao clicar no botão Snap |
| Distância (1-50px) | - | **Ribbon → Snap** (Popover) | Slider no popover |
| Guias Ortogonais | - | **Ribbon → Snap** (Popover) | Toggle no popover |
| Lista de Referências | - | **Ribbon → Snap** (Popover) | Lista com opção de limpar |

### 9. Operações Booleanas

| Ferramenta Atual | Atalho | Nova Localização | Observações |
|------------------|--------|------------------|-------------|
| União | - | **Selection Panel → Operações** | Requer 2+ polígonos selecionados |
| Diferença | - | **Selection Panel → Operações** | Requer 2 polígonos selecionados |
| Interseção | - | **Selection Panel → Operações** | Requer 2 polígonos selecionados |

**Nota:** Operações booleanas ficam no Selection Panel porque dependem de múltiplos objetos selecionados.

### 10. Operações de Arquivo

| Ferramenta Atual | Atalho | Nova Localização | Observações |
|------------------|--------|------------------|-------------|
| Copiar | Ctrl+C | **Ribbon → Arquivo** | Ícone 📋 |
| Colar | Ctrl+V | **Ribbon → Arquivo** | Ícone 📥 |
| Baixar GeoJSON | - | **Ribbon → Arquivo** | Ícone 📤 |
| Carregar GeoJSON | - | **Ribbon → Arquivo** | Ícone 📂 |
| Limpar Tudo | - | **Ribbon → Arquivo** | Ícone 🗑️, com confirmação |

---

## Componentes Existentes → Nova Estrutura

### LayerPanel.tsx → Task Pane (Aba Camadas)

```
ATUAL:                          NOVO:
┌─────────────────────┐         ┌─────────────────────────┐
│ Camadas Espaciais   │    →    │ 📑 CAMADAS              │
│ 5 camadas disponíveis│         │ ┌─────────────────────┐ │
├─────────────────────┤         │ │ 🔍 Buscar...        │ │
│ ☑ Lotes            │    →    │ ├─────────────────────┤ │
│   └ schema, tabela │         │ │ ▼ 📁 Cadastro       │ │
│   └ campos: ...    │    →    │ │   ☑ 🟦 Lotes        │ │
│ ☐ Edificações      │         │ │   ☑ 🟩 Edificações  │ │
├─────────────────────┤         │ │ ▶ 📁 Infraestrutura │ │
│ 2 camada(s) visível │    →    │ └─────────────────────┘ │
└─────────────────────┘         │ [+ Grupo] [+ Camada]    │
                                 │ ─────────────────────── │
                                 │ LEGENDA                 │
                                 │ 🟦 ━━ Lotes             │
                                 └─────────────────────────┘

Melhorias:
- Árvore hierárquica com headless-tree
- Drag-and-drop para reordenar
- Grupos colapsáveis
- Busca por nome
- Menu de contexto (botão direito)
- Ícones de ação rápida (👁️ 📋 ⚙️)
```

### FeaturePanel.tsx → Task Pane (Aba Atributos)

```
ATUAL (flutuante):              NOVO (no Task Pane):
┌─────────────────────┐         ┌─────────────────────────┐
│ Feature #1  [✕]     │    →    │ 📋 ATRIBUTOS            │
│ Polygon             │         ├─────────────────────────┤
├─────────────────────┤         │ FEATURE SELECIONADA     │
│ PROPRIEDADES        │    →    │ ┌─────────────────────┐ │
│ inscricao: 001.001  │         │ │ #42     [◀ 1/3 ▶]   │ │
│ area: 450.5         │    →    │ │ 🔷 Polygon          │ │
│ bairro: Centro      │         │ │ Área: 1.234 m²      │ │
├─────────────────────┤         │ ├─────────────────────┤ │
│ [+ Propriedade]     │    →    │ │ inscricao │001.001✎│ │
│ [Excluir]           │         │ │ area      │ 450.5 ✎│ │
└─────────────────────┘         │ │ bairro    │Centro ✎│ │
                                 │ └─────────────────────┘ │
                                 │ [🔍Zoom][📋Copy][🗑️Del]│
                                 ├─────────────────────────┤
                                 │ PREVIEW DA CAMADA       │
                                 │ [Abrir tabela ↗]        │
                                 └─────────────────────────┘

Melhorias:
- Navegação entre features selecionadas (◀ ▶)
- Métricas geométricas (vértices, área, perímetro)
- Preview da tabela de atributos
- Link para abrir tabela completa
```

### HistoryPanel.tsx → Selection Panel (Histórico)

```
ATUAL:                          NOVO (no Selection Panel):
┌─────────────────────┐         ┌─────────────────────────┐
│ Histórico (5)       │    →    │ HISTÓRICO DE EDIÇÃO     │
│ 3 ativas | 2 revert │         ├─────────────────────────┤
├─────────────────────┤         │ [↩️ Desfazer][↪️ Refazer]│
│ [Todas][Ativas][Rev]│    →    ├─────────────────────────┤
├─────────────────────┤         │ ● 14:32 Criar polígono  │
│ + 14:32 Criar pol.  │    →    │   └ #42 cadastro.lotes  │
│   └ [Reverter]      │         │ ○ 14:30 Mover           │
│ ~ 14:30 Editar attr │    →    │   └ #43 [Reverter]      │
│   └ [Reverter]      │         │ ○ 14:28 Editar vértice  │
├─────────────────────┤         │   └ #42 [Reverter]      │
│ Legenda: +~- ...    │    →    ├─────────────────────────┤
└─────────────────────┘         │ ● = atual  ○ = anterior │
                                └─────────────────────────┘

Melhorias:
- Movido para Selection Panel (fluxo de edição)
- Histórico junto com as operações de edição
- Botões Desfazer/Refazer no topo
- Integração com atalhos (Ctrl+Z)
```

### EditToolbar.tsx → Ribbon + Painéis

```
ATUAL (vertical lateral):       NOVO (horizontal no topo):
┌───────────────┐               ┌─────────────────────────────────────────┐
│ Navegação     │               │ [Desenho▼][Edição▼][Snap▼][Arquivo▼]   │
│ [🖐️ Nav] [🎯]│          →    ├─────────────────────────────────────────┤
├───────────────┤               │ 📍 📏 ⬡ ▭ ⭕ ⬭ │ ✋ ✏️ ↔️ 🔄 │ 🧲 📐 │
│ Seleção       │               └─────────────────────────────────────────┘
│ [⬚][⭕]      │
├───────────────┤               Dropdowns por grupo:
│ Desenho       │               ┌───────────────────┐
│ [📍][📏][⬡]  │          →    │ Desenho           │
│ [〰️][➡️]    │               │ ├ 📍 Ponto        │
├───────────────┤               │ ├ 📏 Linha        │
│ Formas        │               │ ├ ⬡ Polígono     │
│ [▭][⊞][⭕]   │          →    │ ├ ▭ Retângulo ▶  │
│ [⬭]...       │               │ │  └ Centro       │
├───────────────┤               │ │  └ 3 Pontos     │
│ Transformar   │               │ ├ ⭕ Círculo ▶   │
│ [✏️][↔️][🔄] │          →    │ │  └ Diâmetro     │
│ [⤢][✂️][🗑️] │               │ └ ...             │
├───────────────┤               └───────────────────┘
│ Snap [🧲]     │          →    Popover de Snap:
│ [Modo][Dist]  │               ┌───────────────────┐
│ [Guias]       │               │ 🧲 Snap [ON]      │
├───────────────┤               │ ─────────────────  │
│ Arquivo       │               │ Modo: [Vértice ▼] │
│ [📤][📥][🗑️]│          →    │ Dist: [===○===]15px│
└───────────────┘               │ ☑ Guias Ortogonais│
                                 │ ─────────────────  │
                                 │ 2 refs selecionadas│
                                 │ [Limpar refs]      │
                                 └───────────────────┘

Benefícios:
- Mais espaço horizontal para o mapa
- Ribbon familiar (estilo Office/AutoCAD)
- Popovers para configurações avançadas
- Dropdowns para variantes de ferramentas
```

---

## Painéis Flutuantes (Contextuais)

Aparecem **sobre o mapa** apenas durante operações específicas:

### Durante Desenho

```
┌─────────────────────────┐
│ 🔷 Desenhando Polígono  │
├─────────────────────────┤
│ Vértices: 5             │
│ Área: 1.234 m²          │
│ Perímetro: 156 m        │
├─────────────────────────┤
│ 💡 Dicas:               │
│ • Duplo-clique finaliza │
│ • Backspace remove      │
├─────────────────────────┤
│ [Cancelar] [Finalizar]  │
└─────────────────────────┘
```

### Com Feature Selecionada (Operações)

```
┌─────────────────────────┐
│ ⬡ Polígono Selecionado  │
├─────────────────────────┤
│ OPERAÇÕES DISPONÍVEIS   │
│ ├ ✂️ Cortar             │
│ ├ ⭕ Buffer             │
│ ├ 📐 Simplificar        │
│ └ 〰️ Suavizar          │
├─────────────────────────┤
│ MÚLTIPLOS (2+):         │
│ ├ 🔗 Unir (desabilitado)│
│ ├ ➖ Subtrair (desab.)  │
│ └ ∩ Interseção (desab.) │
└─────────────────────────┘
```

### Durante Medição

```
┌─────────────────────────┐
│ 📏 Medindo Distância    │
├─────────────────────────┤
│ Total: 234.56 m         │
│ Segmento: 45.2 m        │
├─────────────────────────┤
│ [Limpar] [Copiar]       │
└─────────────────────────┘
```

---

## Tabela de Atributos (Painel Inferior)

**Nova funcionalidade** - não existe no viewer atual.

```
Abertura:
1. Botão direito na camada → "Abrir tabela de atributos"
2. Ícone 📋 na camada no Task Pane
3. Atalho F6 (camada ativa)
4. Duplo-clique na camada

Layout:
┌─────────────────────────────────────────────────────────────────────────┐
│ 📋 cadastro.lotes (1.234 registros)  [🔍Filtrar] [⚙️Colunas] [⬇️] [✕] │
├───────┬──────────────────┬────────────┬────────────────┬────────────────┤
│   #   │ inscricao        │ area       │ bairro         │ proprietario   │
├───────┼──────────────────┼────────────┼────────────────┼────────────────┤
│ ► 42  │ 001.001.042      │ 450.5      │ Centro         │ João Silva     │
│   43  │ 001.001.043      │ 380.0      │ Centro         │ Maria Santos   │
├───────┴──────────────────┴────────────┴────────────────┴────────────────┤
│ ◀ 1 2 3 ... 50 ▶  │  Mostrando 1-25 de 1.234  │  [CSV] [GeoJSON]       │
└─────────────────────────────────────────────────────────────────────────┘

Interações:
- Clique na linha → Seleciona no mapa
- Duplo-clique → Zoom para feature
- Ctrl+clique → Seleção múltipla
- Arrastar borda superior → Redimensionar
```

---

## Estrutura de Abas do Ribbon

| Aba | Ícone | Ferramentas | Popovers |
|-----|-------|-------------|----------|
| **Desenho** | ✏️ | Ponto, Linha, Polígono, Retângulo*, Círculo*, Elipse*, Polígono 90° | Variantes de formas |
| **Edição** | 🔧 | Navegar, Seleção*, Editar Vértices, Mover, Rotacionar, Escalar, Transformar, Duplicar, Excluir | Opções de seleção |
| **Snap** | 🧲 | Toggle Snap, Sel. Referência | Config completa |
| **Arquivo** | 📄 | Copiar, Colar, Baixar, Carregar, Limpar | - |

*\* = tem dropdown com variantes*

---

## Atalhos de Teclado Preservados

| Atalho | Ação | Nova Localização |
|--------|------|------------------|
| V | Modo Navegar | Ribbon → Edição |
| P | Desenhar Ponto | Ribbon → Desenho |
| L | Desenhar Linha | Ribbon → Desenho |
| G | Desenhar Polígono | Ribbon → Desenho |
| T | Desenhar Retângulo | Ribbon → Desenho |
| C | Desenhar Círculo | Ribbon → Desenho |
| E | Editar Vértices | Ribbon → Edição |
| M | Mover | Ribbon → Edição |
| D | Excluir | Ribbon → Edição |
| S | Toggle Snap | Ribbon → Snap |
| R | Sel. Referência Snap | Ribbon → Snap |
| Escape | Cancelar/Desselecionar | Global |
| Ctrl+C | Copiar | Ribbon → Arquivo |
| Ctrl+V | Colar | Ribbon → Arquivo |
| Delete | Excluir selecionados | Global |

### Novos Atalhos

| Atalho | Ação | Localização |
|--------|------|-------------|
| F6 | Abrir/fechar tabela de atributos | Global |
| Ctrl+Z | Abrir aba Histórico | Task Pane |
| Ctrl+F | Focar no filtro (tabela aberta) | Tabela |
| ↑/↓ | Navegar na tabela | Tabela |
| Enter | Zoom para feature (tabela) | Tabela |

---

## Resumo Visual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EditToolbar.tsx                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  nav     → Ribbon (Edição)                                           │   │
│  │  select  → Ribbon (Edição)                                           │   │
│  │  basic   → Ribbon (Desenho)                                          │   │
│  │  shapes  → Ribbon (Desenho) com dropdowns                            │   │
│  │  transform → Ribbon (Edição) + Painel Flutuante contextual           │   │
│  │  composite → Ribbon (Desenho)                                        │   │
│  │  measure → Task Pane (Análise) + Ribbon                              │   │
│  │  snap    → Ribbon (Snap) com popover                                 │   │
│  │  boolean → Task Pane (Análise) + Painel Flutuante                    │   │
│  │  arquivo → Ribbon (Arquivo)                                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│  LayerPanel.tsx → Task Pane (Aba Camadas) com headless-tree                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  FeaturePanel.tsx → Task Pane (Aba Atributos)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  HistoryPanel.tsx → Task Pane (Aba Histórico)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  NOVO: AttributeTable.tsx → Painel inferior redimensionável                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*Documento criado em: Janeiro 2026*
*Baseado na análise de: EditToolbar.tsx, LayerPanel.tsx, FeaturePanel.tsx, HistoryPanel.tsx, MapView.tsx*
