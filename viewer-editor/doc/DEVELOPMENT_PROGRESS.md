# Viewer Editor - Progresso de Desenvolvimento

**Data de Atualização:** Janeiro 2026
**Versão:** 0.1.0 (Protótipo)
**Arquivo de Teste:** `src/pages/FlexLayoutTest.tsx`

---

## Visão Geral

O Viewer Editor é um editor GIS completo construído com React 18, deck.gl 9 e flexlayout-react. O objetivo é criar uma interface profissional similar ao ArcGIS Pro / QGIS, com painéis acopláveis, ribbon de ferramentas e suporte a múltiplos mapas.

---

## Stack Tecnológico

| Componente | Tecnologia | Versão |
|------------|------------|--------|
| Framework | React | 18.3 |
| Build | Vite | 6.x |
| Mapa | deck.gl + MapLibre GL | 9.2.5 |
| Edição | @deck.gl-community/editable-layers | 9.1.1 |
| Layout | flexlayout-react | 0.8.18 |
| Estado | Zustand | 5.0.10 |
| Estilização | Tailwind CSS | 3.4.15 |
| Ícones | Lucide React | 0.562.0 |
| Árvore | @headless-tree/react | 1.6.2 |

---

## Aspectos Implementados

### 1. Sistema de Layout (FlexLayout)

**Status:** ✅ Implementado

- Layout de painéis acopláveis similar ao VS Code / ArcGIS Pro
- Suporte a borders (left, right, bottom) para painéis secundários
- Painéis podem ser arrastados, redimensionados e reorganizados
- Persistência do estado dos painéis visíveis via localStorage
- Auto-hide de borders quando vazios

**Painéis Configurados:**

| Painel | Localização | Componente |
|--------|-------------|------------|
| Camadas | left | `MockLayersPanel` |
| Seleção | left | `MockSelectionPanel` |
| Opções | right | `ToolOptionsPanel` |
| Atributos | right | `MockAttributesPanel` |
| Histórico | right | `MockHistoryPanel` |
| Análise | right | `MockAnalysisPanel` |
| Tabela de Atributos | bottom | `MockAttributeTable` |

---

### 2. Interface Ribbon (Estilo Microsoft Office)

**Status:** ✅ Implementado

Interface de duas linhas seguindo padrão Microsoft Word:
- **Linha 1 (RibbonTabBar):** Logo, menu Arquivo, abas de ferramentas, ações rápidas
- **Linha 2 (RibbonPanel):** Ferramentas agrupadas da aba ativa

**Características:**
- Abas com ícones e labels
- Double-click na aba ativa colapsa/expande o ribbon
- Botão de toggle no canto direito
- Grupos de ferramentas com separadores e labels
- Ferramentas com ícones, labels e atalhos de teclado

**Abas Implementadas:**

| Aba | Ícone | Grupos |
|-----|-------|--------|
| Seleção | ⬚ | Modo, Área, Painel |
| Criar | ✏️ | Básico, Retângulos, Círculos, Especial |
| Editar | ⧉ | Geometria, Transformar, Ações |
| Análise | 📊 | Operações, Dividir, Geometria |
| Medição | 📏 | Medir, Opções |
| Ferramentas | 🛠️ | Snap, Arquivo, Painéis |

---

### 3. Ferramentas de Desenho (Configuração)

**Status:** ✅ Configurado (Mock)

Ferramentas configuradas no ribbon para futura integração com editable-layers:

**Criação:**
- Ponto, Linha, Polígono, Laço
- Retângulo, Quadrado, Retângulo 3 Pontos
- Círculo, Elipse
- Polígono 90°, Estender linha

**Edição:**
- Vértices (modify)
- Dividir polígono
- Extrudar
- Mover, Rotacionar, Escalar, Transformação livre
- Duplicar, Excluir

**Seleção:**
- Simples, Múltipla
- Retângulo, Laço, Polígono

---

### 4. Painel de Opções de Ferramenta (Task Pane)

**Status:** ✅ Implementado

Painel contextual que mostra opções específicas da ferramenta selecionada.

**Painéis de Opções Implementados:**

| Ferramenta | Componente | Funcionalidades |
|------------|------------|-----------------|
| Ponto | `PointToolOptions` | Coordenadas X/Y, SRID, nome |
| Retângulo | `RectangleToolOptions` | Modo (2pts/dimensões), ponto base, largura/altura/rotação |
| Snap | `SnapToolOptions` | Toggle, tipos de snap, tolerância, camadas |
| Buffer | `BufferToolOptions` | Distância, unidade, segmentos, dissolve, output |
| Medição | `MeasureToolOptions` | Lista de medições, unidade, labels |
| Vazio | `EmptyToolOptions` | Estado quando nenhuma ferramenta selecionada |

---

### 5. Múltiplos Mapas

**Status:** ✅ Implementado

- Botão "+" na barra de abas do mapa para adicionar novas visualizações
- Cada mapa pode ter estilo de tile diferente (dark, light, voyager)
- Indicador de sincronização para mapas adicionais
- Mapas podem ser organizados lado a lado ou em abas

---

### 6. Controle de Visibilidade de Painéis

**Status:** ✅ Implementado

Painéis podem ser mostrados/ocultados via botões toggle no ribbon:
- **Aba Seleção:** Toggle do painel Seleção
- **Aba Ferramentas:** Toggles de Camadas, Atributos, Opções, Tabela

Os botões ficam verdes quando o painel está visível.

---

### 7. Barra de Status

**Status:** ✅ Implementado

Barra inferior com informações:
- Coordenadas do cursor (📍)
- Nível de zoom (🔍)
- Ferramenta ativa (✏️)
- Contagem de features (📊)
- Status de conexão (●)
- Link para voltar

---

### 8. Ações Rápidas

**Status:** ✅ Implementado (Visual)

Botões no canto direito da barra de ribbon:
- Desfazer (↩️) - Ctrl+Z
- Refazer (↪️) - Ctrl+Y
- Toggle Ribbon (🔼/🔽) - Ctrl+F1
- Configurações (⚙️)

---

## Componentes Mock (Para Substituição)

Os seguintes componentes são placeholders para implementação futura:

| Componente | Descrição | Próximos Passos |
|------------|-----------|-----------------|
| `MockMapView` | Placeholder do mapa | Integrar deck.gl + MapLibre |
| `MockLayersPanel` | Lista de camadas | Conectar com store de layers |
| `MockSelectionPanel` | Features selecionadas | Integrar com seleção real |
| `MockAttributesPanel` | Atributos de feature | Conectar com feature selecionada |
| `MockHistoryPanel` | Histórico de operações | Integrar com sistema de undo |
| `MockAnalysisPanel` | Ferramentas de análise | Implementar operações espaciais |
| `MockAttributeTable` | Tabela de atributos | Conectar com dados reais |

---

## Estrutura de Arquivos

```
viewer-editor/
├── src/
│   ├── pages/
│   │   └── FlexLayoutTest.tsx    # Protótipo principal
│   ├── components/
│   │   ├── layout/               # (futuro) Componentes de layout
│   │   ├── map/                  # (futuro) Componentes de mapa
│   │   ├── panels/               # (futuro) Painéis
│   │   └── ribbon/               # (futuro) Componentes do ribbon
│   └── stores/                   # (futuro) Zustand stores
├── doc/
│   ├── UI_LAYOUT_PLAN.md         # Especificação UI/UX
│   ├── TOOL_MAPPING.md           # Mapeamento de ferramentas
│   └── DEVELOPMENT_PROGRESS.md   # Este documento
└── package.json
```

---

## Próximos Passos

### Prioridade Alta
1. [ ] Integrar deck.gl real no MapView
2. [ ] Implementar editable-layers para desenho
3. [ ] Criar Zustand stores para estado global
4. [ ] Conectar painéis com dados reais

### Prioridade Média
5. [ ] Implementar sistema de undo/redo não-sequencial
6. [ ] Adicionar atalhos de teclado
7. [ ] Implementar snap to geometry
8. [ ] Criar sistema de notificações

### Prioridade Baixa
9. [ ] Temas (dark/light)
10. [ ] Exportar/importar layout
11. [ ] Internacionalização (i18n)
12. [ ] Documentação de usuário

---

## Decisões de Design

### Por que FlexLayout?
- Suporte nativo a drag & drop de painéis
- Borders para painéis laterais (similar ao VS Code)
- Persistência de layout
- Boa performance com muitos painéis

### Por que Ribbon ao invés de Menu tradicional?
- Agrupa ferramentas por contexto
- Descoberta mais fácil de funcionalidades
- Padrão familiar (Microsoft Office, ArcGIS Pro)
- Suporte a collapse para mais espaço de trabalho

### Por que Task Pane para opções?
- Contexto sempre visível
- Não bloqueia a interação com o mapa
- Padrão profissional (AutoCAD, ArcGIS)
- Permite edição precisa de coordenadas

---

## Comandos de Desenvolvimento

```bash
# Instalar dependências
npm install

# Servidor de desenvolvimento
npm run dev

# Build de produção
npm run build

# Verificação de tipos
npm run typecheck

# Preview do build
npm run preview
```

**URL de Teste:** `http://localhost:5173/?test=flexlayout`

---

## Changelog

### 2026-01-19
- Implementado sistema de layout com FlexLayout
- Criada interface Ribbon com 6 abas de ferramentas
- Implementado ribbon colapsável com double-click
- Criado painel de opções de ferramenta (Task Pane)
- Adicionado suporte a múltiplos mapas
- Distribuídos controles de painéis nas abas Seleção e Ferramentas
- Removida aba Exibir, funcionalidades distribuídas
- Criados componentes mock para todos os painéis
- Implementada barra de status
