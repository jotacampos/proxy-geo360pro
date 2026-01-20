# Status de Desenvolvimento - Viewer Editor

**Ultima atualizacao:** 2026-01-20
**Versao:** 0.2.0
**Status geral:** ~90% completo (funcionalidades core + snap avancado implementados)

---

## Visao Geral

O viewer-editor e um editor GIS completo construido com:
- **React 18** + **TypeScript** + **Vite 6**
- **deck.gl 9** + **@deck.gl-community/editable-layers**
- **MapLibre GL** (basemap)
- **FlexLayout** (paineis dockaveis)
- **Zustand** (state management)
- **Turf.js v7** (operacoes geoespaciais)
- **Tailwind CSS** (styling)

---

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           INTERFACE                                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ RibbonTabBar (Logo, Abas, Acoes Rapidas)                           │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ RibbonPanel (Ferramentas da aba ativa)                             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  ┌──────────┬──────────────────────────────────────────┬─────────────┐ │
│  │  LEFT    │                                          │   RIGHT     │ │
│  │ BORDER   │              MAP VIEW                    │  BORDER     │ │
│  │          │         (deck.gl + MapLibre)             │             │ │
│  │ Camadas  │                                          │   Opcoes    │ │
│  │ Selecao  │   ┌──────────────────────────────────┐   │  Atributos  │ │
│  │ Snap     │   │   EditableGeoJsonLayer          │   │  Historico  │ │
│  │          │   │   SnapGuidesLayer               │   │             │ │
│  │          │   │   MeasurementLayer              │   │             │ │
│  │          │   └──────────────────────────────────┘   │             │ │
│  ├──────────┴──────────────────────────────────────────┴─────────────┤ │
│  │ BOTTOM BORDER (Tabela de Atributos)                               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ StatusBar (Coordenadas, Zoom, Ferramenta, Features, Status)        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Funcionalidades Implementadas

### 1. Sistema de Layout (FlexLayout)

| Componente | Status | Descricao |
|------------|--------|-----------|
| Layout dockavel | ✅ | Paineis podem ser arrastados, redimensionados |
| Borders (left/right/bottom) | ✅ | Paineis laterais e inferior |
| Persistencia localStorage | ✅ | Estado salvo automaticamente |
| Auto-hide borders | ✅ | Esconde quando vazio |
| Multiplos mapas | ✅ | Botao "+" para adicionar mapas |

**Paineis Configurados:**

| Painel | Localizacao | Status |
|--------|-------------|--------|
| Camadas | left | ✅ Mock |
| Selecao | left | ✅ Real |
| **Snap** | left | ✅ **Real** |
| Opcoes | right | ✅ Real |
| Atributos | right | ✅ Mock |
| Historico | right | ✅ Mock |
| Analise | right | ✅ Mock |
| Tabela | bottom | ✅ Mock |

---

### 2. Interface Ribbon (Microsoft Office Style)

| Aba | Icone | Grupos | Status |
|-----|-------|--------|--------|
| Selecao | ⬚ | Modo, Area, Painel | ✅ |
| Criar | ✏️ | Basico, Retangulos, Circulos, Especial | ✅ |
| Editar | ⧉ | Geometria, Transformar, Acoes | ✅ |
| Analise | 📊 | Operacoes, Dividir, Geometria | ✅ |
| Medicao | 📏 | Medir, Opcoes | ✅ |
| Ferramentas | 🛠️ | Snap, Arquivo, Paineis | ✅ |

**Caracteristicas:**
- Double-click na aba colapsa/expande
- Botao toggle no canto direito
- Grupos com separadores e labels
- Atalhos de teclado visiveis

---

### 3. Ferramentas de Desenho

| Ferramenta | Modo | Status | Atalho |
|------------|------|--------|--------|
| Ponto | `draw-point` | ✅ | `P` |
| Linha | `draw-line` | ✅ | `L` |
| Poligono | `draw-polygon` | ✅ | `G` |
| Retangulo | `draw-rectangle` | ✅ | `T` |
| Circulo | `draw-circle` | ✅ | `C` |
| Elipse | `draw-90-degree-polygon` | ✅ | - |
| Poligono 90° | `draw-90-degree-polygon` | ✅ | - |
| Laco (freehand) | `DrawPolygonByDraggingMode` | ✅ | - |
| Retangulo 3pts | `draw-rectangle-3pts` | ✅ | - |

**Painel de Opcoes por Ferramenta:**

| Ferramenta | Painel | Funcionalidades |
|------------|--------|-----------------|
| Ponto | `PointToolOptions` | Coord X/Y editaveis, SRID, nome |
| Linha | `LineToolOptions` | Lista vertices, add/remove, Enter finaliza |
| Retangulo | `RectangleToolOptions` | Modo 2pts/dimensoes, rotacao |
| Ret. 3pts | `Rectangle3PtsToolOptions` | Vertices configurados |

---

### 4. Ferramentas de Edicao

| Ferramenta | Modo | Status | Atalho |
|------------|------|--------|--------|
| Modificar vertices | `modify` | ✅ | `E` |
| Mover/Translate | `translate` | ✅ | `M` |
| Rotacionar | `rotate` | ✅ | `R` |
| Escalar | `scale` | ✅ | - |
| Transformar livre | `transform` | ✅ | - |
| Extrudar | `extrude` | ✅ | - |
| Dividir | `split-polygon` | ✅ | - |
| Deletar | - | ✅ | `D` / `Del` |

---

### 5. Sistema de Snap Avancado

**Status:** ✅ **Totalmente Implementado**

| Funcionalidade | Status | Descricao |
|----------------|--------|-----------|
| Snap to Vertex | ✅ | Snap para vertices de features |
| Snap to Edge | ✅ | Snap para arestas de features |
| Snap Mode | ✅ | Vertex / Edge / Both |
| Snap Tolerance | ✅ | Ajustavel de 1-50px |
| Snap Guides | ✅ | Guias H/V automaticas durante desenho |
| Guide Intersections | ✅ | Snap prioritario em intersecoes |
| Visual Feedback | ✅ | Indicador pulsante, linha guia |
| Painel Dedicado | ✅ | Painel Snap na sidebar esquerda |

**Cores de Visualizacao:**

| Cor | Significado |
|-----|-------------|
| 🟢 Verde | Snap em vertice |
| 🟠 Laranja | Snap em aresta |
| 🔵 Ciano | Snap em guia |
| 🟡 Amarelo | Intersecao de guias |
| 🟣 Magenta | Vertices disponiveis |

**Arquivos:**

```
src/
├── types/snap.ts              # Tipos TypeScript
├── utils/
│   ├── snapFeatures.ts        # Snap para vertices/arestas
│   └── snapGuides.ts          # Guias ortogonais
├── components/map/
│   └── SnapGuidesLayer.tsx    # Hook useSnapLayers + visualizacao
└── stores/editorStore.ts      # Estado do snap
```

**Estado do Store:**

```typescript
// editorStore.ts
snapEnabled: boolean          // Toggle geral
snapMode: 'vertex' | 'edge' | 'both'
snapPixels: number            // Tolerancia em pixels
snapGuidesEnabled: boolean    // Guias durante desenho
snapGuides: SnapGuide[]       // Guias atuais
snapReferenceFeatures: Feature[] // Features de referencia externa
```

---

### 6. Analise Espacial (Turf.js v7)

| Operacao | Status | Biblioteca |
|----------|--------|------------|
| Buffer | ✅ | `@turf/buffer` |
| Uniao | ✅ | `@turf/union` |
| Diferenca | ✅ | `@turf/difference` |
| Intersecao | ✅ | `@turf/intersect` |
| Simplificar | ✅ | `@turf/simplify` |

---

### 7. Sistema de Medicao

| Ferramenta | Status | Atalho |
|------------|--------|--------|
| Distancia | ✅ | `X` |
| Area | ✅ | `A` |
| Angulo | ⚠️ UI only | - |
| Limpar | ✅ | `Shift+X` |

---

### 8. Historico e Undo/Redo

| Funcionalidade | Status | Atalho |
|----------------|--------|--------|
| Undo | ✅ | `Ctrl+Z` |
| Redo | ✅ | `Ctrl+Y` |
| Historico visual | ✅ | Dropdown no ribbon |
| Undo nao-sequencial | ✅ | Por ID de operacao |

---

### 9. Sistema de Notificacoes

| Tipo | Cor | Status |
|------|-----|--------|
| Success | Verde | ✅ |
| Error | Vermelho | ✅ |
| Warning | Ambar | ✅ |
| Info | Azul | ✅ |
| Auto-dismiss | - | ✅ |
| Progress bar | - | ✅ |

---

### 10. Atalhos de Teclado

| Atalho | Acao |
|--------|------|
| `V` | Modo navegacao |
| `P` | Desenhar ponto |
| `L` | Desenhar linha |
| `G` | Desenhar poligono |
| `T` | Desenhar retangulo |
| `C` | Desenhar circulo |
| `E` | Editar vertices |
| `M` | Mover |
| `R` | Rotacionar |
| `D` / `Delete` | Deletar |
| `S` | Toggle snap |
| `X` | Medir distancia |
| `A` | Medir area |
| `Shift+X` | Limpar medicoes |
| `Ctrl+Z` | Desfazer |
| `Ctrl+Y` | Refazer |
| `Enter` | Finalizar desenho |
| `Escape` | Cancelar |

---

## Estrutura de Arquivos

```
viewer-editor/
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Router
│   ├── pages/
│   │   └── FlexLayoutTest.tsx      # Pagina principal (4000+ linhas)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx       # Layout alternativo
│   │   │   ├── CompactRibbon.tsx   # Ribbon compacto
│   │   │   ├── FloatingToolbar.tsx # Toolbar flutuante
│   │   │   ├── AttributeTable.tsx  # Tabela de atributos
│   │   │   └── StatusBar/          # Barra de status
│   │   ├── map/
│   │   │   ├── MapView.tsx         # Mapa deck.gl + editable-layers
│   │   │   ├── SnapGuidesLayer.tsx # Camadas de snap
│   │   │   └── MeasurementLayer.tsx# Camadas de medicao
│   │   ├── panels/
│   │   │   ├── BufferPanel.tsx     # Painel buffer
│   │   │   ├── MeasurePanel.tsx    # Painel medicao
│   │   │   ├── SimplifyPanel.tsx   # Painel simplificar
│   │   │   └── DrawingPanel.tsx    # Painel desenho
│   │   ├── layers/
│   │   │   └── LayerTree.tsx       # Arvore de camadas
│   │   └── ui/
│   │       ├── DraggablePanel.tsx  # Base para paineis
│   │       ├── Popover.tsx         # Componente popover
│   │       └── NotificationContainer.tsx
│   ├── stores/
│   │   ├── index.ts                # Exports + notify helper
│   │   ├── editorStore.ts          # Estado principal (features, snap, medicao)
│   │   ├── layerStore.ts           # Estado de camadas
│   │   ├── mapStore.ts             # Estado do mapa
│   │   ├── uiStore.ts              # Estado da UI
│   │   └── notificationStore.ts    # Notificacoes
│   ├── types/
│   │   ├── index.ts                # Tipos gerais
│   │   └── snap.ts                 # Tipos de snap
│   ├── utils/
│   │   ├── snapFeatures.ts         # Utilitarios snap features
│   │   └── snapGuides.ts           # Utilitarios snap guides
│   ├── hooks/
│   │   └── useKeyboardShortcuts.ts # Atalhos de teclado
│   └── services/
│       ├── api.ts                  # Cliente API
│       └── tiles.ts                # Servico de tiles
├── doc/
│   ├── UI_LAYOUT_PLAN.md           # Especificacao UI/UX
│   ├── TOOL_MAPPING.md             # Mapeamento de ferramentas
│   ├── DEVELOPMENT_PROGRESS.md     # Progresso historico
│   └── DEVELOPMENT_STATUS.md       # Este documento
└── package.json
```

---

## Dependencias Principais

```json
{
  "dependencies": {
    "@deck.gl/core": "^9.1.8",
    "@deck.gl/layers": "^9.1.8",
    "@deck.gl/react": "^9.1.8",
    "@deck.gl-community/editable-layers": "^9.1.8",
    "@turf/area": "^7.3.2",
    "@turf/buffer": "^7.3.2",
    "@turf/difference": "^7.3.2",
    "@turf/distance": "^7.x",
    "@turf/helpers": "^7.3.2",
    "@turf/intersect": "^7.3.2",
    "@turf/length": "^7.3.2",
    "@turf/simplify": "^7.x",
    "@turf/union": "^7.3.2",
    "flexlayout-react": "^0.8.18",
    "maplibre-gl": "^4.x",
    "react": "^18.3",
    "react-map-gl": "^7.x",
    "zustand": "^5.0.10",
    "lucide-react": "^0.562.0",
    "@headless-tree/react": "^1.6.2"
  }
}
```

---

## Como Executar

```bash
cd viewer-editor
npm install
npm run dev
# Acesse http://localhost:5174
```

### Comandos Disponiveis

```bash
npm run dev        # Servidor de desenvolvimento
npm run build      # Build de producao
npm run typecheck  # Verificacao de tipos
npm run preview    # Preview do build
```

---

## Funcionalidades Pendentes

### Alta Prioridade

| Item | Status | Descricao |
|------|--------|-----------|
| Integracao backend | ❌ | API de autenticacao e camadas |
| Persistencia dados | ❌ | Salvar/carregar projetos |
| Import/Export GeoJSON | ⚠️ Basico | Precisa melhorar UI |

### Media Prioridade

| Item | Status | Descricao |
|------|--------|-----------|
| Simbologia por atributo | ❌ | Colorir features por propriedade |
| Labels no mapa | ❌ | Mostrar nomes das features |
| Medicao de angulo | ⚠️ UI only | Logica nao implementada |

### Baixa Prioridade

| Item | Status | Descricao |
|------|--------|-----------|
| Grid/Guias fixas | ❌ | Grade visual no mapa |
| Imprimir/Exportar imagem | ❌ | Screenshot do mapa |
| Temas (dark/light) | ❌ | Somente dark atualmente |
| Internacionalizacao | ❌ | Somente PT-BR |

---

## Problemas Conhecidos

1. **Snap guides muito extensas** - As linhas guia se estendem alem do viewport
2. **Medicao de area com poucos pontos** - Precisa de pelo menos 3 pontos
3. **FlexLayoutTest.tsx muito grande** - 4000+ linhas, considerar modularizar

---

## Notas Tecnicas

### Turf.js v7 Breaking Changes

```typescript
// v6 (antigo)
const result = union(feature1, feature2);

// v7 (atual)
const fc = { type: 'FeatureCollection', features: [feature1, feature2] };
const result = union(fc);
```

### Sistema de Snap

O snap usa coordenadas geograficas (lon/lat) e converte tolerancia de pixels para graus:

```typescript
// snapFeatures.ts
export function calculateSnapThreshold(
  zoom: number,
  latitude: number,
  tolerancePixels: number
): number {
  const metersPerPixel = 156543.03392 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, zoom);
  const thresholdMeters = tolerancePixels * metersPerPixel;
  return thresholdMeters / 111320; // metros para graus
}
```

### Notificacoes

```typescript
import { notify } from '../stores';

notify.success('Titulo', 'Mensagem');
notify.error('Erro', 'Detalhes', 5000); // duracao custom
notify.warning('Aviso', 'Algo errado');
notify.info('Info', 'Informacao util');
```

---

## Changelog

### 2026-01-20 (v0.2.0)
- ✅ Implementado sistema de snap avancado completo
- ✅ Criado painel Snap dedicado (dockavel)
- ✅ Snap para vertices, arestas, guias e intersecoes
- ✅ Visualizacao com indicador pulsante
- ✅ Removida duplicacao SnapToolOptions
- ✅ Migracao automatica de paineis no localStorage

### 2026-01-19 (v0.1.0)
- Sistema de layout FlexLayout implementado
- Interface Ribbon com 6 abas
- Todas ferramentas de desenho basicas
- Ferramentas de edicao (modify, translate, rotate, scale)
- Analise espacial com Turf.js v7
- Sistema de medicao (distancia/area)
- Undo/Redo com historico visual
- Sistema de notificacoes
- Atalhos de teclado

---

*Documentacao atualizada em 2026-01-20*
