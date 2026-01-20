import { useState, useRef, useCallback, useEffect } from 'react';
import { CompactRibbon, type RibbonTab } from './CompactRibbon';
import { FloatingToolbar } from './FloatingToolbar';
import { AttributeTable, type LayerInfo } from './AttributeTable';
import { LayerTree, type LayerItem } from '../layers/LayerTree';
import { MapView } from '../map/MapView';
import { DrawingPanel } from '../panels/DrawingPanel';
import { BufferPanel } from '../panels/BufferPanel';
import { MeasurePanel } from '../panels/MeasurePanel';
import { NotificationContainer } from '../ui/NotificationContainer';
import { useEditorStore, type DrawingMode, notify } from '../../stores';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import buffer from '@turf/buffer';
import union from '@turf/union';
import difference from '@turf/difference';
import intersect from '@turf/intersect';
import simplify from '@turf/simplify';
import { SimplifyPanel, type SimplifyOptions } from '../panels/SimplifyPanel';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

export function AppLayout() {
  // Panel widths (percentual)
  const [leftWidth, setLeftWidth] = useState(20);
  const [rightWidth, setRightWidth] = useState(20);

  // Collapse states
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Attribute table state
  const [tableOpen, setTableOpen] = useState(false);
  const [tableHeight, setTableHeight] = useState(200);
  const [tableLayer, setTableLayer] = useState<LayerInfo | null>(null);

  // Open table with a specific layer (from LayerTree)
  const openTableWithLayer = (layer: LayerItem) => {
    setTableLayer({
      id: layer.id,
      name: layer.name,
      schema: layer.parentId || undefined,
      featureCount: layer.featureCount,
    });
    setTableOpen(true);
  };

  // Open table without a layer (from Outros menu)
  const openTableEmpty = () => {
    setTableLayer(null);
    setTableOpen(true);
  };

  // Ribbon tab and active tool
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>('selecao');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [tabCenterX, setTabCenterX] = useState<number | undefined>(undefined);

  // Selection mode: 'single' | 'multi' | null (no selection active)
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi' | null>(null);

  // Handle ribbon tab change - toggle toolbar if clicking same tab
  const handleRibbonTabChange = (tab: RibbonTab) => {
    if (tab === ribbonTab) {
      // Same tab clicked - toggle toolbar visibility
      setToolbarVisible(!toolbarVisible);
    } else {
      // Different tab - switch and show toolbar
      setRibbonTab(tab);
      setToolbarVisible(true);
      setActiveTool(null); // Reset tool when switching tabs
      // Close any open panels
      setDrawingPanelOpen(false);
      setBufferPanelOpen(false);
      setMeasurePanelOpen(false);
    }
  };

  // Task Pane active tab
  const [activeTab, setActiveTab] = useState<'layers' | 'attributes'>('layers');

  // Map view state
  const [mapViewState, setMapViewState] = useState({
    longitude: -49.2800,
    latitude: -16.6800,
    zoom: 15,
  });

  // Floating panels state
  const [drawingPanelOpen, setDrawingPanelOpen] = useState(false);
  const [bufferPanelOpen, setBufferPanelOpen] = useState(false);
  const [measurePanelOpen, setMeasurePanelOpen] = useState(false);
  const [measureType, setMeasureType] = useState<'distance' | 'area' | 'angle'>('distance');
  const [simplifyPanelOpen, setSimplifyPanelOpen] = useState(false);

  // Left panel tab state
  const [leftPanelTab, setLeftPanelTab] = useState<'selection' | 'history' | 'snapping'>('selection');

  // Hover state for highlighting features on map
  const [hoveredFeatureIndex, setHoveredFeatureIndex] = useState<number | null>(null);

  // FlyTo state for zooming to features
  const [flyToFeatureIndex, setFlyToFeatureIndex] = useState<number | null>(null);

  // Attribute editing state
  const [editingProperty, setEditingProperty] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [newPropertyName, setNewPropertyName] = useState<string>('');
  const [showAddProperty, setShowAddProperty] = useState(false);

  // Editor store
  const {
    setMode,
    snapEnabled,
    setSnapEnabled,
    features,
    addFeature,
    updateFeature,
    clearFeatures,
    deleteFeatures,
    selectedIndexes,
    setSelectedIndexes,
    clearSelection,
    drawingCoordinates,
    setIsDrawing,
    silentMode,
    setSilentMode,
    undo,
    redo,
    canUndo,
    canRedo,
    history,
    historyIndex,
    // Measurement
    measurementResults,
    setMeasurementMode,
    clearMeasurementResults,
  } = useEditorStore();

  // Keyboard shortcuts
  useKeyboardShortcuts();

  // Function to load mock data for testing
  const loadMockData = () => {
    // Clear existing features first
    clearFeatures();

    // === PONTOS (Postes, Marcos, Equipamentos) ===

    // Poste de iluminação
    addFeature({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-49.2800, -16.6800] },
      properties: {
        name: 'Poste PE-0042',
        tipo: 'Poste',
        codigo: 'PE-0042',
        material: 'Concreto',
        altura_m: 9,
        potencia_w: 150,
        status: 'Ativo',
      },
    });

    addFeature({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-49.2830, -16.6790] },
      properties: {
        name: 'Poste PE-0043',
        tipo: 'Poste',
        codigo: 'PE-0043',
        material: 'Metálico',
        altura_m: 12,
        potencia_w: 250,
        status: 'Ativo',
      },
    });

    addFeature({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-49.2760, -16.6820] },
      properties: {
        name: 'Hidrante H-015',
        tipo: 'Hidrante',
        codigo: 'H-015',
        pressao_bar: 4.5,
        ultima_manutencao: '2025-06-15',
        status: 'Operacional',
      },
    });

    addFeature({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-49.2785, -16.6755] },
      properties: {
        name: 'Marco Geodésico MG-001',
        tipo: 'Marco',
        codigo: 'MG-001',
        altitude_m: 842.5,
        datum: 'SIRGAS2000',
      },
    });

    // === LINHAS (Ruas, Redes, Limites) ===

    // Rua principal
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-49.2870, -16.6850],
          [-49.2840, -16.6830],
          [-49.2800, -16.6810],
          [-49.2760, -16.6800],
          [-49.2720, -16.6795],
        ],
      },
      properties: {
        name: 'Av. Goiás',
        tipo: 'Via',
        classe: 'Arterial',
        largura_m: 14,
        pavimento: 'Asfalto',
        sentido: 'Duplo',
        velocidade_max: 60,
      },
    });

    // Rua secundária
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-49.2800, -16.6810],
          [-49.2800, -16.6780],
          [-49.2800, -16.6750],
          [-49.2800, -16.6720],
        ],
      },
      properties: {
        name: 'Rua 15',
        tipo: 'Via',
        classe: 'Coletora',
        largura_m: 10,
        pavimento: 'Paralelepípedo',
        sentido: 'Único',
        velocidade_max: 40,
      },
    });

    // Rede de água
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-49.2850, -16.6800],
          [-49.2820, -16.6800],
          [-49.2790, -16.6800],
          [-49.2760, -16.6800],
        ],
      },
      properties: {
        name: 'Rede H2O-Setor5',
        tipo: 'Rede de Água',
        diametro_mm: 150,
        material: 'PVC',
        pressao_nominal: 10,
        ano_instalacao: 2018,
      },
    });

    // Rede de esgoto
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-49.2845, -16.6805],
          [-49.2815, -16.6805],
          [-49.2785, -16.6805],
          [-49.2755, -16.6805],
        ],
      },
      properties: {
        name: 'Coletor ESG-S5-01',
        tipo: 'Rede de Esgoto',
        diametro_mm: 200,
        material: 'Concreto',
        profundidade_m: 1.8,
        declividade: 0.5,
      },
    });

    // === POLÍGONOS (Lotes, Edificações, Áreas) ===

    // Lote residencial
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-49.2780, -16.6780],
          [-49.2760, -16.6780],
          [-49.2760, -16.6760],
          [-49.2780, -16.6760],
          [-49.2780, -16.6780],
        ]],
      },
      properties: {
        name: 'Lote 001-A',
        tipo: 'Lote',
        inscricao: '001.002.003.0045',
        area_m2: 450.5,
        testada_m: 15,
        uso: 'Residencial',
        zoneamento: 'ZR-2',
        valor_venal: 185000,
      },
    });

    // Lote comercial
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-49.2820, -16.6750],
          [-49.2790, -16.6750],
          [-49.2790, -16.6720],
          [-49.2820, -16.6720],
          [-49.2820, -16.6750],
        ]],
      },
      properties: {
        name: 'Lote 002-B',
        tipo: 'Lote',
        inscricao: '001.002.004.0012',
        area_m2: 900,
        testada_m: 30,
        uso: 'Comercial',
        zoneamento: 'ZC-1',
        valor_venal: 520000,
      },
    });

    // Edificação residencial
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-49.2775, -16.6775],
          [-49.2765, -16.6775],
          [-49.2765, -16.6765],
          [-49.2775, -16.6765],
          [-49.2775, -16.6775],
        ]],
      },
      properties: {
        name: 'Residência',
        tipo: 'Edificação',
        area_construida_m2: 120,
        pavimentos: 1,
        ano_construcao: 2015,
        padrao: 'Médio',
        ocupacao: 'Própria',
      },
    });

    // Edificação comercial (L-shape)
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-49.2815, -16.6745],
          [-49.2795, -16.6745],
          [-49.2795, -16.6735],
          [-49.2805, -16.6735],
          [-49.2805, -16.6725],
          [-49.2815, -16.6725],
          [-49.2815, -16.6745],
        ]],
      },
      properties: {
        name: 'Centro Comercial',
        tipo: 'Edificação',
        area_construida_m2: 450,
        pavimentos: 2,
        ano_construcao: 2020,
        padrao: 'Alto',
        ocupacao: 'Aluguel',
      },
    });

    // Quadra urbana
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-49.2850, -16.6850],
          [-49.2750, -16.6850],
          [-49.2750, -16.6700],
          [-49.2850, -16.6700],
          [-49.2850, -16.6850],
        ]],
      },
      properties: {
        name: 'Quadra 15',
        tipo: 'Quadra',
        setor: 'Centro',
        num_lotes: 24,
        area_m2: 15000,
      },
    });

    // Área verde / Praça
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-49.2740, -16.6780],
          [-49.2710, -16.6780],
          [-49.2710, -16.6750],
          [-49.2740, -16.6750],
          [-49.2740, -16.6780],
        ]],
      },
      properties: {
        name: 'Praça Central',
        tipo: 'Área Verde',
        area_m2: 900,
        equipamentos: 'Playground, Bancos, Iluminação',
        manutencao: 'Municipal',
      },
    });

    // APP - Área de Preservação Permanente
    addFeature({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-49.2700, -16.6820],
          [-49.2680, -16.6800],
          [-49.2660, -16.6810],
          [-49.2650, -16.6840],
          [-49.2670, -16.6860],
          [-49.2690, -16.6850],
          [-49.2700, -16.6820],
        ]],
      },
      properties: {
        name: 'APP Córrego',
        tipo: 'APP',
        classe: 'Mata Ciliar',
        largura_faixa_m: 30,
        corpo_hidrico: 'Córrego das Flores',
        restricao: 'Não edificável',
      },
    });

    // Select some features to demonstrate multi-selection
    setSelectedIndexes([0, 1]);
  };

  // Function to duplicate selected features
  const duplicateSelected = () => {
    if (selectedIndexes.length === 0) return;

    selectedIndexes.forEach(idx => {
      const f = features.features[idx];
      if (!f) return;

      // Offset the geometry slightly so it's visible
      let offsetGeometry = JSON.parse(JSON.stringify(f.geometry));
      const offset = 0.0005; // Small offset

      if (offsetGeometry.type === 'Point') {
        offsetGeometry.coordinates[0] += offset;
        offsetGeometry.coordinates[1] += offset;
      } else if (offsetGeometry.type === 'LineString') {
        offsetGeometry.coordinates = offsetGeometry.coordinates.map((c: number[]) => [c[0] + offset, c[1] + offset]);
      } else if (offsetGeometry.type === 'Polygon') {
        offsetGeometry.coordinates = offsetGeometry.coordinates.map((ring: number[][]) =>
          ring.map((c: number[]) => [c[0] + offset, c[1] + offset])
        );
      }

      addFeature({
        type: 'Feature',
        geometry: offsetGeometry,
        properties: {
          name: `${f.properties?.name || 'Feature'} (cópia)`,
        },
      });
    });
  };

  // Buffer operation handler
  const handleBufferExecute = (options: { distance: number; unit: 'meters' | 'kilometers'; segments: number; dissolve: boolean; outputLayer: string }) => {
    if (selectedIndexes.length === 0) return;

    const selectedFeatures = selectedIndexes.map(i => features.features[i]).filter(Boolean);
    const bufferedFeatures: Feature<Polygon | MultiPolygon>[] = [];

    selectedFeatures.forEach(f => {
      const buffered = buffer(f as Feature, options.distance, {
        units: options.unit === 'meters' ? 'meters' : 'kilometers',
        steps: options.segments,
      });

      if (buffered) {
        bufferedFeatures.push(buffered as Feature<Polygon | MultiPolygon>);
      }
    });

    if (options.dissolve && bufferedFeatures.length > 1) {
      // Union all buffers into one (Turf v7 API)
      const fc = { type: 'FeatureCollection' as const, features: bufferedFeatures };
      const merged = union(fc);
      if (merged) {
        addFeature({
          ...merged,
          properties: {
            name: options.outputLayer,
            tipo: 'Buffer',
            distancia: `${options.distance} ${options.unit}`,
            dissolvido: true,
          },
        });
      }
    } else {
      // Add each buffer separately
      bufferedFeatures.forEach((bf, i) => {
        const sourceFeature = selectedFeatures[i];
        addFeature({
          ...bf,
          properties: {
            name: `${sourceFeature?.properties?.name || 'Feature'} - Buffer`,
            tipo: 'Buffer',
            distancia: `${options.distance} ${options.unit}`,
            feature_origem: sourceFeature?.properties?.name,
          },
        });
      });
    }

    setBufferPanelOpen(false);
    setActiveTool(null);

    // Notify
    notify.success('Buffer criado', `${bufferedFeatures.length} buffer(s) gerado(s)`);
  };

  // Boolean operations handlers (Turf v7 API uses FeatureCollections)
  const handleUnion = useCallback(() => {
    if (selectedIndexes.length < 2) return;

    const polygons = selectedIndexes
      .map(i => features.features[i])
      .filter(f => f && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')) as Feature<Polygon | MultiPolygon>[];

    if (polygons.length < 2) return;

    // Turf v7 union takes a FeatureCollection
    const fc = { type: 'FeatureCollection' as const, features: polygons };
    const result = union(fc);

    if (result) {
      addFeature({
        ...result,
        properties: {
          name: 'União',
          tipo: 'União',
          operacao: 'union',
          num_features_origem: polygons.length,
        },
      });
      notify.success('União realizada', `${polygons.length} polígonos unidos`);
    } else {
      notify.error('Erro na união', 'Não foi possível unir os polígonos');
    }
  }, [selectedIndexes, features.features, addFeature]);

  const handleDifference = useCallback(() => {
    if (selectedIndexes.length !== 2) return;

    const polygons = selectedIndexes
      .map(i => features.features[i])
      .filter(f => f && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')) as Feature<Polygon | MultiPolygon>[];

    if (polygons.length !== 2) return;

    // Turf v7 difference takes a FeatureCollection
    const fc = { type: 'FeatureCollection' as const, features: polygons };
    const result = difference(fc);

    if (result) {
      addFeature({
        ...result,
        properties: {
          name: 'Diferença',
          tipo: 'Diferença',
          operacao: 'difference',
        },
      });
      notify.success('Diferença calculada', 'Polígono de diferença criado');
    } else {
      notify.warning('Sem diferença', 'Os polígonos não têm área de diferença');
    }
  }, [selectedIndexes, features.features, addFeature]);

  const handleIntersection = useCallback(() => {
    if (selectedIndexes.length !== 2) return;

    const polygons = selectedIndexes
      .map(i => features.features[i])
      .filter(f => f && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')) as Feature<Polygon | MultiPolygon>[];

    if (polygons.length !== 2) return;

    // Turf v7 intersect takes a FeatureCollection
    const fc = { type: 'FeatureCollection' as const, features: polygons };
    const result = intersect(fc);

    if (result) {
      addFeature({
        ...result,
        properties: {
          name: 'Interseção',
          tipo: 'Interseção',
          operacao: 'intersection',
        },
      });
      notify.success('Interseção calculada', 'Polígono de interseção criado');
    } else {
      notify.warning('Sem interseção', 'Os polígonos não se intersectam');
    }
  }, [selectedIndexes, features.features, addFeature]);

  // Simplify handler
  const handleSimplify = useCallback((options: SimplifyOptions) => {
    if (selectedIndexes.length === 0) return;

    let simplifiedCount = 0;
    let totalVerticesBefore = 0;
    let totalVerticesAfter = 0;

    selectedIndexes.forEach((index) => {
      const feature = features.features[index];
      if (!feature) return;

      // Count vertices before
      const countVertices = (geom: any): number => {
        if (geom.type === 'Point') return 1;
        if (geom.type === 'LineString') return geom.coordinates.length;
        if (geom.type === 'Polygon') return geom.coordinates.reduce((acc: number, ring: any) => acc + ring.length, 0);
        if (geom.type === 'MultiPolygon') {
          return geom.coordinates.reduce((acc: number, poly: any) =>
            acc + poly.reduce((a: number, ring: any) => a + ring.length, 0), 0);
        }
        return 0;
      };

      const verticesBefore = countVertices(feature.geometry);
      totalVerticesBefore += verticesBefore;

      // Simplify
      const simplified = simplify(feature as Feature, {
        tolerance: options.tolerance,
        highQuality: options.highQuality,
      });

      const verticesAfter = countVertices(simplified.geometry);
      totalVerticesAfter += verticesAfter;

      if (options.mutate) {
        // Replace original
        updateFeature(index, {
          ...simplified,
          properties: {
            ...feature.properties,
            simplificado: true,
            vertices_antes: verticesBefore,
            vertices_depois: verticesAfter,
          },
        });
      } else {
        // Add as new feature
        addFeature({
          ...simplified,
          properties: {
            name: `${feature.properties?.name || 'Feature'} - Simplificado`,
            tipo: 'Simplificado',
            vertices_antes: verticesBefore,
            vertices_depois: verticesAfter,
            tolerancia: options.tolerance,
          },
        });
      }

      simplifiedCount++;
    });

    setSimplifyPanelOpen(false);
    setActiveTool(null);

    const reduction = totalVerticesBefore > 0
      ? Math.round((1 - totalVerticesAfter / totalVerticesBefore) * 100)
      : 0;

    notify.success(
      'Geometria simplificada',
      `${simplifiedCount} feature(s): ${totalVerticesBefore} → ${totalVerticesAfter} vértices (-${reduction}%)`
    );
  }, [selectedIndexes, features.features, addFeature, updateFeature]);

  // Drawing tools that open the drawing panel (simplified)
  const DRAWING_TOOLS = [
    'draw-point', 'draw-line', 'draw-polygon', 'draw-lasso', 'extend-line',
    'draw-rectangle', 'draw-rectangle-3pts', 'draw-square',
    'draw-circle', 'draw-ellipse', 'draw-90deg-polygon'
  ];

  // Edit tools that set editor mode directly
  const EDIT_TOOLS = [
    'modify', 'translate', 'rotate', 'scale', 'transform',
    'split-polygon', 'extrude', 'composite-draw-modify'
  ];

  // Open drawing panel when coordinates are captured (after first map click)
  // Only for point creation - other tools use native deck.gl behavior
  useEffect(() => {
    if (activeTool === 'draw-point' && drawingCoordinates.length > 0 && !drawingPanelOpen && !silentMode) {
      setDrawingPanelOpen(true);
    }
  }, [activeTool, drawingCoordinates.length, drawingPanelOpen, silentMode]);

  // Handle tool selection with panel opening
  const handleToolSelect = (toolId: string | null) => {
    setActiveTool(toolId);

    // Close all panels first
    setDrawingPanelOpen(false);
    setBufferPanelOpen(false);
    setMeasurePanelOpen(false);

    if (toolId) {
      // For drawing tools: set the mode
      if (DRAWING_TOOLS.includes(toolId)) {
        setMode(toolId as DrawingMode);
        // Only use custom drawing flow for points
        // Other tools use native deck.gl behavior
        if (toolId === 'draw-point') {
          setIsDrawing(true);
          setSilentMode(false); // Reset silent mode when selecting tool
          // Panel will open after first map click (via useEffect above)
        } else {
          setIsDrawing(false); // Use native deck.gl mode
        }
      } else if (EDIT_TOOLS.includes(toolId)) {
        // Set editor mode directly for edit tools
        setIsDrawing(false); // Ensure native deck.gl mode is used
        if (toolId === 'composite-draw-modify') {
          setMode('modify'); // Composto starts in modify mode
        } else {
          setMode(toolId as DrawingMode);
        }
      } else if (toolId === 'measure-distance') {
        setMeasurementMode('distance');
        setMeasureType('distance');
        setMeasurePanelOpen(true);
      } else if (toolId === 'measure-area') {
        setMeasurementMode('area');
        setMeasureType('area');
        setMeasurePanelOpen(true);
      } else if (toolId === 'measure-angle') {
        setMeasureType('angle');
        setMeasurePanelOpen(true);
      } else if (toolId === 'simplify') {
        setSimplifyPanelOpen(true);
      } else if (toolId === 'tabela-atributos') {
        // Open attribute table without layer context
        openTableEmpty();
        setActiveTool(null); // Deselect tool after action
      } else if (toolId === 'download-geojson') {
        // Download features as GeoJSON
        if (features.features.length > 0) {
          const blob = new Blob([JSON.stringify(features, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'features.geojson';
          a.click();
          URL.revokeObjectURL(url);
        }
        setActiveTool(null);
      } else if (toolId === 'load-geojson') {
        // Open file picker to load GeoJSON
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.geojson,.json';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const text = await file.text();
            try {
              const geojson = JSON.parse(text);
              if (geojson.type === 'FeatureCollection') {
                useEditorStore.getState().setFeatures(geojson);
              }
            } catch (err) {
              console.error('Invalid GeoJSON file');
            }
          }
        };
        input.click();
        setActiveTool(null);
      } else if (toolId === 'clear-all') {
        clearFeatures();
        setActiveTool(null);
      } else if (toolId === 'delete') {
        // Delete selected features
        if (selectedIndexes.length > 0) {
          deleteFeatures(selectedIndexes);
        }
        setActiveTool(null);
      } else if (toolId === 'duplicate') {
        // Duplicate selected features
        if (selectedIndexes.length > 0) {
          const store = useEditorStore.getState();
          selectedIndexes.forEach(index => {
            const feature = features.features[index];
            if (feature) {
              store.addFeature({
                ...feature,
                geometry: JSON.parse(JSON.stringify(feature.geometry)),
                properties: { ...feature.properties },
              });
            }
          });
        }
        setActiveTool(null);
      } else if (toolId === 'snap-toggle') {
        setSnapEnabled(!useEditorStore.getState().snapEnabled);
        setActiveTool(null);
      } else if (toolId === 'select-single') {
        // Single selection mode
        setMode('view');
        setSelectionMode('single');
      } else if (toolId === 'select-multi') {
        // Multi selection mode
        setMode('view');
        setSelectionMode('multi');
      } else if (toolId === 'select-rectangle' || toolId === 'select-lasso') {
        // Selection tools - set to view mode
        setMode('view');
        setSelectionMode('single'); // Default to single for now
      }
    } else {
      // No tool selected - set to view mode
      setMode('view');
    }
  };

  // Resize handling
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const COLLAPSED_SIZE = 48; // px
  const MIN_SIZE = 15; // percentual
  const MAX_SIZE = 35; // percentual

  const handleMouseDown = useCallback((handle: 'left' | 'right') => (e: React.MouseEvent) => {
    // If panel is collapsed, don't allow resize
    if ((handle === 'left' && leftCollapsed) || (handle === 'right' && rightCollapsed)) {
      return;
    }

    isDragging.current = handle;
    startX.current = e.clientX;
    startWidth.current = handle === 'left' ? leftWidth : rightWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftWidth, rightWidth, leftCollapsed, rightCollapsed]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const deltaX = e.clientX - startX.current;
    const deltaPercent = (deltaX / containerWidth) * 100;

    if (isDragging.current === 'left') {
      const newWidth = Math.max(MIN_SIZE, Math.min(MAX_SIZE, startWidth.current + deltaPercent));
      setLeftWidth(newWidth);
    } else {
      const newWidth = Math.max(MIN_SIZE, Math.min(MAX_SIZE, startWidth.current - deltaPercent));
      setRightWidth(newWidth);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div className="h-screen w-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* Notifications */}
      <NotificationContainer />

      {/* Compact Ribbon */}
      <CompactRibbon
        activeTab={ribbonTab}
        onTabChange={handleRibbonTabChange}
        onTabPositionChange={setTabCenterX}
      />

      {/* Main Content Area */}
      <div ref={containerRef} className="flex-1 flex min-h-0">
        {/* Selection Panel (Left) */}
        <div
          className="h-full bg-gray-900 border-r border-gray-700 flex flex-col flex-shrink-0 transition-all duration-200"
          style={{ width: leftCollapsed ? COLLAPSED_SIZE : `${leftWidth}%` }}
        >
          {/* Panel Header with Tabs */}
          <div className="border-b border-gray-700 flex-shrink-0">
            <div className="h-10 flex items-center px-2">
              <button
                onClick={() => setLeftCollapsed(!leftCollapsed)}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                title={leftCollapsed ? 'Expandir' : 'Colapsar'}
              >
                {leftCollapsed ? '▶' : '◀'}
              </button>
            </div>
            {!leftCollapsed && (
              <div className="flex border-t border-gray-700">
                <button
                  onClick={() => setLeftPanelTab('selection')}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                    leftPanelTab === 'selection'
                      ? 'text-emerald-400 bg-gray-800 border-b-2 border-emerald-400'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Seleção
                </button>
                <button
                  onClick={() => setLeftPanelTab('history')}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                    leftPanelTab === 'history'
                      ? 'text-emerald-400 bg-gray-800 border-b-2 border-emerald-400'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Histórico
                </button>
                <button
                  onClick={() => setLeftPanelTab('snapping')}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                    leftPanelTab === 'snapping'
                      ? 'text-emerald-400 bg-gray-800 border-b-2 border-emerald-400'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Snap
                </button>
              </div>
            )}
          </div>

          {/* Panel Content */}
          {!leftCollapsed && (
            <div className="flex-1 overflow-auto p-3">
              {/* Selection Tab */}
              {leftPanelTab === 'selection' && (
                <div className="space-y-4">
                  {/* Mock data loader for testing */}
                  {features.features.length === 0 && (
                    <div className="bg-blue-900/30 border border-blue-700/50 rounded p-3 text-center">
                      <p className="text-xs text-blue-300 mb-2">Nenhum objeto no mapa</p>
                      <button
                        onClick={loadMockData}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white"
                      >
                        🧪 Carregar dados de teste
                      </button>
                    </div>
                  )}

                  {/* Single unified objects list */}
                  {features.features.length > 0 && (
                    <section>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase">
                          Objetos ({selectedIndexes.length}/{features.features.length})
                        </h3>
                        <div className="flex gap-2">
                          {selectedIndexes.length === 0 ? (
                            <button
                              onClick={() => setSelectedIndexes(features.features.map((_, i) => i))}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              Todos
                            </button>
                          ) : (
                            <button
                              onClick={clearSelection}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Limpar
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {/* Sort: selected items first, then unselected */}
                        {[...features.features]
                          .map((feature, index) => ({ feature, index }))
                          .sort((a, b) => {
                            const aSelected = selectedIndexes.includes(a.index);
                            const bSelected = selectedIndexes.includes(b.index);
                            if (aSelected && !bSelected) return -1;
                            if (!aSelected && bSelected) return 1;
                            return a.index - b.index;
                          })
                          .map(({ feature, index }) => {
                            const geomType = feature?.geometry?.type || 'Unknown';
                            const isSelected = selectedIndexes.includes(index);
                            const geomIcons: Record<string, string> = {
                              'Point': '📍',
                              'LineString': '📏',
                              'Polygon': '⬡',
                              'MultiPoint': '📍',
                              'MultiLineString': '📏',
                              'MultiPolygon': '⬡',
                            };
                            return (
                              <div
                                key={index}
                                className={`flex items-center gap-2 p-2 rounded text-xs cursor-pointer transition-colors ${
                                  isSelected
                                    ? hoveredFeatureIndex === index
                                      ? 'bg-yellow-900/50 border border-yellow-600/50'
                                      : 'bg-emerald-900/40 border border-emerald-600/50'
                                    : hoveredFeatureIndex === index
                                      ? 'bg-yellow-900/30 border border-yellow-700/50'
                                      : 'bg-gray-800 hover:bg-gray-700 border border-transparent'
                                }`}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedIndexes(selectedIndexes.filter(i => i !== index));
                                  } else {
                                    setSelectedIndexes([...selectedIndexes, index]);
                                  }
                                }}
                                onMouseEnter={() => setHoveredFeatureIndex(index)}
                                onMouseLeave={() => setHoveredFeatureIndex(null)}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  readOnly
                                  className="w-3 h-3 rounded bg-gray-700 border-gray-600 text-emerald-500"
                                />
                                <span>{geomIcons[geomType] || '📦'}</span>
                                <span className={`flex-1 truncate ${
                                  isSelected
                                    ? 'text-emerald-300 font-medium'
                                    : hoveredFeatureIndex === index
                                      ? 'text-yellow-300'
                                      : 'text-gray-400'
                                }`}>
                                  {feature?.properties?.name || `${geomType} #${index + 1}`}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFlyToFeatureIndex(index);
                                  }}
                                  className="text-gray-500 hover:text-blue-400"
                                  title="Ir para"
                                >
                                  🎯
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteFeatures([index]);
                                  }}
                                  className="text-gray-500 hover:text-red-400"
                                  title="Excluir geometria"
                                >
                                  🗑️
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    </section>
                  )}

                  {/* Editing tools - only enabled when objects are selected */}
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                      Edição {selectedIndexes.length === 0 && <span className="text-gray-600 normal-case">(selecione um objeto)</span>}
                    </h3>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        disabled={selectedIndexes.length === 0}
                        onClick={() => {
                          if (activeTool === 'modify') {
                            setMode('view'); setActiveTool(null);
                          } else {
                            setIsDrawing(false); setMode('modify'); setActiveTool('modify');
                          }
                        }}
                        className={`p-2 rounded text-xs flex flex-col items-center gap-1 transition-colors ${
                          activeTool === 'modify'
                            ? 'bg-emerald-600 text-white'
                            : selectedIndexes.length > 0
                              ? 'bg-gray-800 text-gray-300 hover:bg-emerald-900/50 hover:text-emerald-400'
                              : 'bg-gray-800/50 text-gray-600'
                        }`}
                      >
                        <span>✏️</span>
                        <span>Vértices</span>
                      </button>
                      <button
                        disabled={selectedIndexes.length === 0}
                        onClick={() => {
                          if (activeTool === 'translate') {
                            setMode('view'); setActiveTool(null);
                          } else {
                            setIsDrawing(false); setMode('translate'); setActiveTool('translate');
                          }
                        }}
                        className={`p-2 rounded text-xs flex flex-col items-center gap-1 transition-colors ${
                          activeTool === 'translate'
                            ? 'bg-emerald-600 text-white'
                            : selectedIndexes.length > 0
                              ? 'bg-gray-800 text-gray-300 hover:bg-emerald-900/50 hover:text-emerald-400'
                              : 'bg-gray-800/50 text-gray-600'
                        }`}
                      >
                        <span>↔️</span>
                        <span>Mover</span>
                      </button>
                      <button
                        disabled={selectedIndexes.length === 0}
                        onClick={() => {
                          if (activeTool === 'rotate') {
                            setMode('view'); setActiveTool(null);
                          } else {
                            setIsDrawing(false); setMode('rotate'); setActiveTool('rotate');
                          }
                        }}
                        className={`p-2 rounded text-xs flex flex-col items-center gap-1 transition-colors ${
                          activeTool === 'rotate'
                            ? 'bg-emerald-600 text-white'
                            : selectedIndexes.length > 0
                              ? 'bg-gray-800 text-gray-300 hover:bg-emerald-900/50 hover:text-emerald-400'
                              : 'bg-gray-800/50 text-gray-600'
                        }`}
                      >
                        <span>🔄</span>
                        <span>Rotar</span>
                      </button>
                      <button
                        disabled={selectedIndexes.length === 0}
                        onClick={() => {
                          if (activeTool === 'scale') {
                            setMode('view'); setActiveTool(null);
                          } else {
                            setIsDrawing(false); setMode('scale'); setActiveTool('scale');
                          }
                        }}
                        className={`p-2 rounded text-xs flex flex-col items-center gap-1 transition-colors ${
                          activeTool === 'scale'
                            ? 'bg-emerald-600 text-white'
                            : selectedIndexes.length > 0
                              ? 'bg-gray-800 text-gray-300 hover:bg-emerald-900/50 hover:text-emerald-400'
                              : 'bg-gray-800/50 text-gray-600'
                        }`}
                      >
                        <span>⤢</span>
                        <span>Escalar</span>
                      </button>
                      <button
                        disabled={selectedIndexes.length === 0}
                        onClick={duplicateSelected}
                        className={`p-2 rounded text-xs flex flex-col items-center gap-1 transition-colors ${
                          selectedIndexes.length > 0
                            ? 'bg-gray-800 text-gray-300 hover:bg-emerald-900/50 hover:text-emerald-400'
                            : 'bg-gray-800/50 text-gray-600'
                        }`}
                      >
                        <span>📋</span>
                        <span>Copiar</span>
                      </button>
                      <button
                        disabled={selectedIndexes.length === 0}
                        onClick={() => {
                          if (selectedIndexes.length > 0) {
                            deleteFeatures(selectedIndexes);
                          }
                        }}
                        className={`p-2 rounded text-xs flex flex-col items-center gap-1 transition-colors ${
                          selectedIndexes.length > 0
                            ? 'bg-gray-800 text-gray-300 hover:bg-red-900/50 hover:text-red-400'
                            : 'bg-gray-800/50 text-gray-600'
                        }`}
                      >
                        <span>🗑️</span>
                        <span>Excluir</span>
                      </button>
                    </div>
                  </section>

                  {/* Operations - only enabled when objects are selected */}
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                      Operações
                    </h3>
                    {/* Composite edit mode - special editing mode */}
                    <button
                      disabled={selectedIndexes.length === 0}
                      onClick={() => {
                        if (activeTool === 'composite-draw-modify') {
                          setMode('view'); setActiveTool(null);
                        } else {
                          setIsDrawing(false); setMode('modify'); setActiveTool('composite-draw-modify');
                        }
                      }}
                      className={`w-full p-2 mb-2 rounded text-xs flex items-center justify-center gap-2 transition-colors ${
                        activeTool === 'composite-draw-modify'
                          ? 'bg-emerald-600 text-white'
                          : selectedIndexes.length > 0
                            ? 'bg-gray-800 text-gray-300 hover:bg-emerald-900/50 hover:text-emerald-400'
                            : 'bg-gray-800/50 text-gray-600'
                      }`}
                    >
                      <span>🔀</span>
                      <span>Modo Composto (Desenhar + Editar)</span>
                    </button>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        disabled={selectedIndexes.length < 1}
                        onClick={() => setBufferPanelOpen(true)}
                        className={`p-2 rounded text-xs flex items-center justify-center gap-1 transition-colors ${
                          selectedIndexes.length >= 1
                            ? 'bg-gray-800 text-gray-300 hover:bg-emerald-900/50 hover:text-emerald-400'
                            : 'bg-gray-800/50 text-gray-600'
                        }`}
                      >
                        <span>⭕</span>
                        <span>Buffer</span>
                      </button>
                      <button
                        disabled={selectedIndexes.length < 2}
                        onClick={handleUnion}
                        className={`p-2 rounded text-xs flex items-center justify-center gap-1 transition-colors ${
                          selectedIndexes.length >= 2
                            ? 'bg-gray-800 text-gray-300 hover:bg-emerald-900/50 hover:text-emerald-400'
                            : 'bg-gray-800/50 text-gray-600'
                        }`}
                      >
                        <span>🔗</span>
                        <span>Unir</span>
                      </button>
                      <button
                        disabled={selectedIndexes.length !== 2}
                        onClick={handleIntersection}
                        className={`p-2 rounded text-xs flex items-center justify-center gap-1 transition-colors ${
                          selectedIndexes.length === 2
                            ? 'bg-gray-800 text-gray-300 hover:bg-emerald-900/50 hover:text-emerald-400'
                            : 'bg-gray-800/50 text-gray-600'
                        }`}
                      >
                        <span>✂️</span>
                        <span>Interseção</span>
                      </button>
                      <button
                        disabled={selectedIndexes.length !== 2}
                        onClick={handleDifference}
                        className={`p-2 rounded text-xs flex items-center justify-center gap-1 transition-colors ${
                          selectedIndexes.length === 2
                            ? 'bg-gray-800 text-gray-300 hover:bg-emerald-900/50 hover:text-emerald-400'
                            : 'bg-gray-800/50 text-gray-600'
                        }`}
                      >
                        <span>➖</span>
                        <span>Diferença</span>
                      </button>
                    </div>
                  </section>
                </div>
              )}

              {/* History Tab */}
              {leftPanelTab === 'history' && (
                <div className="space-y-4">
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                      Ações
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={undo}
                        disabled={!canUndo()}
                        className="flex-1 p-2 bg-gray-800 rounded text-xs text-gray-300 disabled:opacity-50 disabled:text-gray-500 hover:bg-gray-700 flex items-center justify-center gap-1"
                      >
                        ↩️ Desfazer
                      </button>
                      <button
                        onClick={redo}
                        disabled={!canRedo()}
                        className="flex-1 p-2 bg-gray-800 rounded text-xs text-gray-300 disabled:opacity-50 disabled:text-gray-500 hover:bg-gray-700 flex items-center justify-center gap-1"
                      >
                        Refazer ↪️
                      </button>
                    </div>
                  </section>
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                      Estados ({historyIndex + 1}/{history.length})
                    </h3>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {history.map((_, index) => (
                        <div
                          key={index}
                          className={`flex items-center gap-2 p-2 rounded text-xs cursor-pointer transition-colors ${
                            index === historyIndex
                              ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/50'
                              : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                          }`}
                        >
                          <span>{index === historyIndex ? '●' : '○'}</span>
                          <span>
                            {index === 0 ? 'Estado inicial' : `Alteração ${index}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {/* Snapping Tab */}
              {leftPanelTab === 'snapping' && (
                <div className="space-y-4">
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                      Snap
                    </h3>
                    <label className="flex items-center gap-3 p-3 bg-gray-800 rounded cursor-pointer hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={snapEnabled}
                        onChange={(e) => setSnapEnabled(e.target.checked)}
                        className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500"
                      />
                      <div>
                        <div className="text-sm text-gray-300">Snap habilitado</div>
                        <div className="text-xs text-gray-500">Aderir a vértices e arestas</div>
                      </div>
                    </label>
                  </section>
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                      Opções de Snap
                    </h3>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700">
                        <input
                          type="checkbox"
                          checked={snapEnabled}
                          disabled
                          className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-gray-400">Vértices</span>
                      </label>
                      <label className="flex items-center gap-3 p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700">
                        <input
                          type="checkbox"
                          checked={snapEnabled}
                          disabled
                          className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-gray-400">Arestas</span>
                      </label>
                      <label className="flex items-center gap-3 p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700">
                        <input
                          type="checkbox"
                          disabled
                          className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-gray-400">Grade (em breve)</span>
                      </label>
                    </div>
                  </section>
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                      Tolerância
                    </h3>
                    <div className="bg-gray-800 rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">Distância</span>
                        <span className="text-xs text-gray-300">10 px</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="30"
                        defaultValue="10"
                        disabled
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
                      />
                    </div>
                  </section>
                </div>
              )}
            </div>
          )}

          {/* Collapsed Icons */}
          {leftCollapsed && (
            <div className="flex-1 flex flex-col items-center py-2 gap-2">
              <button
                title="Seleção"
                onClick={() => { setLeftCollapsed(false); setLeftPanelTab('selection'); }}
                className={`p-2 hover:text-white hover:bg-gray-700 rounded ${leftPanelTab === 'selection' ? 'text-emerald-400' : 'text-gray-400'}`}
              >
                ✋
              </button>
              <button
                title="Histórico"
                onClick={() => { setLeftCollapsed(false); setLeftPanelTab('history'); }}
                className={`p-2 hover:text-white hover:bg-gray-700 rounded ${leftPanelTab === 'history' ? 'text-emerald-400' : 'text-gray-400'}`}
              >
                📜
              </button>
              <button
                title="Snap"
                onClick={() => { setLeftCollapsed(false); setLeftPanelTab('snapping'); }}
                className={`p-2 hover:text-white hover:bg-gray-700 rounded ${leftPanelTab === 'snapping' ? 'text-emerald-400' : 'text-gray-400'}`}
              >
                🧲
              </button>
            </div>
          )}
        </div>

        {/* Resize Handle Left */}
        {!leftCollapsed && (
          <div
            className="w-2 bg-gray-600 hover:bg-emerald-500 active:bg-emerald-600 cursor-col-resize flex-shrink-0 transition-colors"
            onMouseDown={handleMouseDown('left')}
          />
        )}

        {/* Map Area (Center) */}
        <div className="flex-1 h-full bg-gray-800 relative min-w-0 overflow-hidden">
          {/* Map */}
          <MapView
            onViewStateChange={(vs) => setMapViewState({ longitude: vs.longitude, latitude: vs.latitude, zoom: vs.zoom })}
            onFeatureClick={(info) => console.log('Feature clicked:', info)}
            hoveredFeatureIndex={hoveredFeatureIndex}
            flyToFeatureIndex={flyToFeatureIndex}
            onFlyToComplete={() => setFlyToFeatureIndex(null)}
            selectionMode={selectionMode}
          />

          {/* Floating Toolbar */}
          {toolbarVisible && (
            <FloatingToolbar
              activeTab={ribbonTab}
              activeTool={activeTool}
              onToolSelect={handleToolSelect}
              centerX={tabCenterX}
            />
          )}

          {/* Drawing Panel - only for point creation */}
          {drawingPanelOpen && activeTool === 'draw-point' && (
            <DrawingPanel
              isOpen={drawingPanelOpen}
              onClose={() => setDrawingPanelOpen(false)}
              onDeactivate={() => { setDrawingPanelOpen(false); setActiveTool(null); setMode('view'); }}
              drawingType={activeTool as any}
            />
          )}

          {/* Buffer Panel */}
          <BufferPanel
            isOpen={bufferPanelOpen}
            onClose={() => { setBufferPanelOpen(false); setActiveTool(null); }}
            onExecute={handleBufferExecute}
            selectedFeatureCount={selectedIndexes.length}
          />

          {/* Measure Panel */}
          <MeasurePanel
            isOpen={measurePanelOpen}
            onClose={() => {
              setMeasurePanelOpen(false);
              setActiveTool(null);
              setMeasurementMode('none');
            }}
            measureType={measureType}
            measurements={measurementResults.map((r, i) => ({
              id: `measurement-${i}`,
              type: r.type,
              value: r.value,
              unit: r.unit,
              coordinates: r.coordinates,
            }))}
            onClear={clearMeasurementResults}
          />

          {/* Simplify Panel */}
          <SimplifyPanel
            isOpen={simplifyPanelOpen}
            onClose={() => {
              setSimplifyPanelOpen(false);
              setActiveTool(null);
            }}
            onExecute={handleSimplify}
            selectedFeatureCount={selectedIndexes.length}
          />

          {/* Floating: Coordinates */}
          <div className="absolute bottom-4 left-4 bg-gray-900/90 px-3 py-1.5 rounded text-xs font-mono text-gray-400 z-10">
            📍 {mapViewState.longitude.toFixed(4)}, {mapViewState.latitude.toFixed(4)} | 🔍 Zoom: {mapViewState.zoom.toFixed(1)}
          </div>

          {/* Floating: Open Table Button */}
          {!tableOpen && (
            <button
              onClick={() => setTableOpen(true)}
              className="absolute bottom-4 right-4 bg-gray-900/90 hover:bg-gray-700 px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white transition-colors z-10"
            >
              📋 Abrir Tabela
            </button>
          )}
        </div>

        {/* Resize Handle Right */}
        {!rightCollapsed && (
          <div
            className="w-2 bg-gray-600 hover:bg-emerald-500 active:bg-emerald-600 cursor-col-resize flex-shrink-0 transition-colors"
            onMouseDown={handleMouseDown('right')}
          />
        )}

        {/* Task Pane (Right) */}
        <div
          className="h-full bg-gray-900 border-l border-gray-700 flex flex-col flex-shrink-0 transition-all duration-200"
          style={{ width: rightCollapsed ? COLLAPSED_SIZE : `${rightWidth}%` }}
        >
          {/* Panel Header with Tabs */}
          <div className="h-10 border-b border-gray-700 flex items-center flex-shrink-0">
            {!rightCollapsed && (
              <>
                {[
                  { id: 'layers', label: 'Camadas', icon: '📑' },
                  { id: 'attributes', label: 'Atributos', icon: '📋' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`px-3 py-2 text-xs transition-colors flex items-center gap-1 ${
                      activeTab === tab.id
                        ? 'text-emerald-400 border-b-2 border-emerald-400'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span className="hidden lg:inline">{tab.label}</span>
                  </button>
                ))}
              </>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setRightCollapsed(!rightCollapsed)}
              className="p-1 mx-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              title={rightCollapsed ? 'Expandir' : 'Colapsar'}
            >
              {rightCollapsed ? '◀' : '▶'}
            </button>
          </div>

          {/* Panel Content */}
          {!rightCollapsed && (
            <div className="flex-1 overflow-auto p-3">
              {activeTab === 'layers' && (
                <div className="h-full -m-3">
                  <LayerTree
                    onLayerSelect={(layer) => console.log('Selected:', layer)}
                    onLayerZoom={(layer) => console.log('Zoom to:', layer)}
                    onOpenTable={(layer) => {
                      console.log('Open table:', layer);
                      openTableWithLayer(layer);
                    }}
                  />
                </div>
              )}
              {activeTab === 'attributes' && (
                <div className="space-y-3">
                  {selectedIndexes.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <div className="text-2xl mb-2">📋</div>
                      <div className="text-sm">Selecione um objeto para ver atributos</div>
                    </div>
                  ) : selectedIndexes.length === 1 ? (
                    // Single object selected - show detailed info
                    (() => {
                      const feature = features.features[selectedIndexes[0]];
                      const geom = feature?.geometry;
                      const props = feature?.properties || {};
                      const geomType = geom?.type || 'Unknown';

                      // Extract coordinates based on geometry type
                      const getCoordinatesInfo = () => {
                        if (!geom) return null;

                        if (geomType === 'Point') {
                          const coords = (geom as any).coordinates;
                          return (
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Longitude:</span>
                                <span className="text-gray-300 font-mono text-xs">{coords[0]?.toFixed(8)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Latitude:</span>
                                <span className="text-gray-300 font-mono text-xs">{coords[1]?.toFixed(8)}</span>
                              </div>
                            </div>
                          );
                        }

                        if (geomType === 'LineString') {
                          const coords = (geom as any).coordinates || [];
                          return (
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Vértices:</span>
                                <span className="text-gray-300">{coords.length}</span>
                              </div>
                              <div className="max-h-32 overflow-y-auto space-y-1">
                                {coords.map((coord: number[], idx: number) => (
                                  <div key={idx} className="flex items-center gap-2 text-[10px] font-mono bg-gray-800 rounded px-2 py-1">
                                    <span className="text-gray-500 w-4">{idx + 1}.</span>
                                    <span className="text-gray-300">{coord[0]?.toFixed(6)}, {coord[1]?.toFixed(6)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        if (geomType === 'Polygon') {
                          const rings = (geom as any).coordinates || [];
                          const exteriorRing = rings[0] || [];
                          const numVertices = exteriorRing.length > 0 ? exteriorRing.length - 1 : 0; // -1 because first/last are same
                          return (
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Vértices:</span>
                                <span className="text-gray-300">{numVertices}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Anéis:</span>
                                <span className="text-gray-300">{rings.length} (1 ext. + {rings.length - 1} int.)</span>
                              </div>
                              <div className="max-h-32 overflow-y-auto space-y-1">
                                {exteriorRing.slice(0, -1).map((coord: number[], idx: number) => (
                                  <div key={idx} className="flex items-center gap-2 text-[10px] font-mono bg-gray-800 rounded px-2 py-1">
                                    <span className="text-gray-500 w-4">{idx + 1}.</span>
                                    <span className="text-gray-300">{coord[0]?.toFixed(6)}, {coord[1]?.toFixed(6)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        return null;
                      };

                      return (
                        <div className="space-y-3">
                          {/* Header */}
                          <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
                            <span className="text-lg">
                              {geomType === 'Point' ? '📍' : geomType === 'LineString' ? '📏' : '⬡'}
                            </span>
                            <div>
                              <div className="text-sm text-gray-200">
                                {props.name || `${geomType} #${selectedIndexes[0] + 1}`}
                              </div>
                              <div className="text-xs text-gray-500">{geomType}</div>
                            </div>
                          </div>

                          {/* Coordinates */}
                          <section>
                            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                              Coordenadas
                            </h4>
                            {getCoordinatesInfo()}
                          </section>

                          {/* Properties - Editable */}
                          <section>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-semibold text-gray-400 uppercase">
                                Propriedades
                              </h4>
                              <button
                                onClick={() => setShowAddProperty(!showAddProperty)}
                                className="text-xs text-emerald-400 hover:text-emerald-300"
                                title="Adicionar propriedade"
                              >
                                {showAddProperty ? '✕' : '＋'}
                              </button>
                            </div>

                            {/* Add new property form */}
                            {showAddProperty && (
                              <div className="mb-2 p-2 bg-gray-800 rounded border border-gray-700">
                                <input
                                  type="text"
                                  placeholder="Nome da propriedade"
                                  value={newPropertyName}
                                  onChange={(e) => setNewPropertyName(e.target.value)}
                                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white mb-1"
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => {
                                      if (newPropertyName.trim() && selectedIndexes.length === 1) {
                                        const idx = selectedIndexes[0];
                                        const f = features.features[idx];
                                        if (f) {
                                          updateFeature(idx, {
                                            ...f,
                                            properties: {
                                              ...f.properties,
                                              [newPropertyName.trim()]: '',
                                            },
                                          });
                                          setNewPropertyName('');
                                          setShowAddProperty(false);
                                          setEditingProperty(newPropertyName.trim());
                                          setEditingValue('');
                                        }
                                      }
                                    }}
                                    disabled={!newPropertyName.trim()}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 text-white text-xs rounded px-2 py-1"
                                  >
                                    Adicionar
                                  </button>
                                  <button
                                    onClick={() => { setShowAddProperty(false); setNewPropertyName(''); }}
                                    className="bg-gray-600 hover:bg-gray-500 text-white text-xs rounded px-2 py-1"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="space-y-1 text-xs">
                              {Object.entries(props)
                                .filter(([key]) => !['style', 'id', 'createdAt', 'updatedAt'].includes(key))
                                .map(([key, value]) => (
                                  <div key={key} className="flex items-center bg-gray-800 rounded px-2 py-1 group">
                                    <span className="text-gray-500 mr-2 min-w-[30%]">{key}:</span>
                                    {editingProperty === key ? (
                                      <div className="flex-1 flex gap-1">
                                        <input
                                          type="text"
                                          value={editingValue}
                                          onChange={(e) => setEditingValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              const idx = selectedIndexes[0];
                                              const f = features.features[idx];
                                              if (f) {
                                                let parsedValue: string | number | boolean = editingValue;
                                                // Try to parse as number
                                                const num = parseFloat(editingValue);
                                                if (!isNaN(num) && editingValue.trim() !== '') {
                                                  parsedValue = num;
                                                }
                                                // Try to parse as boolean
                                                if (editingValue.toLowerCase() === 'true') parsedValue = true;
                                                if (editingValue.toLowerCase() === 'false') parsedValue = false;

                                                updateFeature(idx, {
                                                  ...f,
                                                  properties: {
                                                    ...f.properties,
                                                    [key]: parsedValue,
                                                  },
                                                });
                                              }
                                              setEditingProperty(null);
                                              setEditingValue('');
                                            } else if (e.key === 'Escape') {
                                              setEditingProperty(null);
                                              setEditingValue('');
                                            }
                                          }}
                                          autoFocus
                                          className="flex-1 bg-gray-700 border border-emerald-500 rounded px-1 py-0.5 text-white text-xs"
                                        />
                                        <button
                                          onClick={() => {
                                            const idx = selectedIndexes[0];
                                            const f = features.features[idx];
                                            if (f) {
                                              let parsedValue: string | number | boolean = editingValue;
                                              const num = parseFloat(editingValue);
                                              if (!isNaN(num) && editingValue.trim() !== '') parsedValue = num;
                                              if (editingValue.toLowerCase() === 'true') parsedValue = true;
                                              if (editingValue.toLowerCase() === 'false') parsedValue = false;

                                              updateFeature(idx, {
                                                ...f,
                                                properties: { ...f.properties, [key]: parsedValue },
                                              });
                                            }
                                            setEditingProperty(null);
                                            setEditingValue('');
                                          }}
                                          className="text-emerald-400 hover:text-emerald-300 px-1"
                                        >
                                          ✓
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <span
                                          onClick={() => {
                                            setEditingProperty(key);
                                            setEditingValue(typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''));
                                          }}
                                          className="text-gray-300 truncate flex-1 cursor-pointer hover:text-emerald-400"
                                          title="Clique para editar"
                                        >
                                          {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}
                                        </span>
                                        <button
                                          onClick={() => {
                                            const idx = selectedIndexes[0];
                                            const f = features.features[idx];
                                            if (f && f.properties) {
                                              const newProps = { ...f.properties };
                                              delete newProps[key];
                                              updateFeature(idx, { ...f, properties: newProps });
                                            }
                                          }}
                                          className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 ml-1"
                                          title="Remover propriedade"
                                        >
                                          ✕
                                        </button>
                                      </>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </section>

                          {/* Style */}
                          {props.style && (
                            <section>
                              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                                Estilo
                              </h4>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-6 h-6 rounded border border-gray-600"
                                  style={{
                                    backgroundColor: props.style.fillColor
                                      ? `rgba(${props.style.fillColor.join(',')})`
                                      : 'transparent',
                                    borderColor: props.style.strokeColor
                                      ? `rgba(${props.style.strokeColor.join(',')})`
                                      : undefined,
                                    borderWidth: props.style.strokeWidth || 1,
                                  }}
                                />
                                <span className="text-xs text-gray-400">
                                  Borda: {props.style.strokeWidth || 1}px
                                </span>
                              </div>
                            </section>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    // Multiple objects selected
                    <div className="space-y-3">
                      <div className="text-center text-gray-400 py-2">
                        <div className="text-2xl mb-1">📋</div>
                        <div className="text-sm">{selectedIndexes.length} objetos selecionados</div>
                      </div>

                      {/* Summary by type */}
                      <section>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                          Resumo por Tipo
                        </h4>
                        <div className="space-y-1">
                          {(() => {
                            const typeCounts: Record<string, number> = {};
                            selectedIndexes.forEach(idx => {
                              const type = features.features[idx]?.geometry?.type || 'Unknown';
                              typeCounts[type] = (typeCounts[type] || 0) + 1;
                            });
                            return Object.entries(typeCounts).map(([type, count]) => (
                              <div key={type} className="flex justify-between bg-gray-800 rounded px-2 py-1 text-xs">
                                <span className="text-gray-400 flex items-center gap-1">
                                  <span>{type === 'Point' ? '📍' : type === 'LineString' ? '📏' : '⬡'}</span>
                                  {type}
                                </span>
                                <span className="text-gray-300">{count}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </section>

                      {/* List of selected */}
                      <section>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                          Objetos
                        </h4>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {selectedIndexes.map(idx => {
                            const f = features.features[idx];
                            const type = f?.geometry?.type || 'Unknown';
                            return (
                              <div
                                key={idx}
                                className={`flex items-center gap-2 rounded px-2 py-1 text-xs cursor-pointer transition-colors ${
                                  hoveredFeatureIndex === idx
                                    ? 'bg-yellow-900/50 border border-yellow-600/50'
                                    : 'bg-gray-800 hover:bg-gray-700'
                                }`}
                                onClick={() => setSelectedIndexes([idx])}
                                onMouseEnter={() => setHoveredFeatureIndex(idx)}
                                onMouseLeave={() => setHoveredFeatureIndex(null)}
                              >
                                <span>{type === 'Point' ? '📍' : type === 'LineString' ? '📏' : '⬡'}</span>
                                <span className={`flex-1 truncate ${hoveredFeatureIndex === idx ? 'text-yellow-300' : 'text-gray-300'}`}>
                                  {f?.properties?.name || `${type} #${idx + 1}`}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFlyToFeatureIndex(idx);
                                  }}
                                  className="text-gray-500 hover:text-blue-400"
                                  title="Ir para"
                                >
                                  🎯
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Collapsed Icons */}
          {rightCollapsed && (
            <div className="flex-1 flex flex-col items-center py-2 gap-2">
              <button
                title="Camadas"
                onClick={() => { setRightCollapsed(false); setActiveTab('layers'); }}
                className={`p-2 rounded ${activeTab === 'layers' ? 'text-emerald-400 bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
              >
                📑
              </button>
              <button
                title="Atributos"
                onClick={() => { setRightCollapsed(false); setActiveTab('attributes'); }}
                className={`p-2 rounded ${activeTab === 'attributes' ? 'text-emerald-400 bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
              >
                📋
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Attribute Table */}
      <AttributeTable
        isOpen={tableOpen}
        height={tableHeight}
        onHeightChange={setTableHeight}
        onClose={() => {
          setTableOpen(false);
          setTableLayer(null);
        }}
        layer={tableLayer}
        onLayerChange={setTableLayer}
      />

      {/* Status Bar */}
      <div className="h-6 bg-gray-900 border-t border-gray-700 flex items-center px-3 text-xs text-gray-400 flex-shrink-0">
        <span>📍 {mapViewState.longitude.toFixed(4)}, {mapViewState.latitude.toFixed(4)}</span>
        <span className="mx-3 text-gray-600">|</span>
        <span>🔍 Zoom: {mapViewState.zoom.toFixed(1)}</span>
        <span className="mx-3 text-gray-600">|</span>
        <span>📊 1.234 features</span>
        <span className="mx-3 text-gray-600">|</span>
        <span>✏️ Modo: {activeTool || 'Nenhum'}</span>
        <span className="flex-1"></span>
        <span className="text-emerald-400">● Conectado</span>
      </div>
    </div>
  );
}
