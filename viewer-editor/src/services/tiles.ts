import type { Layer } from '../types';

const TILE_BASE = '';  // Empty because Vite proxy handles /tiles/*

export type TileType = 'dynamic' | 'dynamic-optimized' | 'dynamic-intersection' | 'dynamic-buffer';

interface TileUrlOptions {
  schema: string;
  table: string;
  geom: string;
  srid?: number;
  fields?: string;
  noCache?: boolean;
}

interface IntersectionOptions {
  schema1: string;
  table1: string;
  geom1: string;
  srid1?: number;
  fields1?: string;
  schema2: string;
  table2: string;
  geom2: string;
  srid2?: number;
  fields2?: string;
  layerName?: string;
  noCache?: boolean;
}

interface BufferOptions extends TileUrlOptions {
  bufferMeters: number;
  dissolve?: boolean;
  layerName?: string;
}

/**
 * Build a dynamic tile URL for a layer
 */
export function buildTileUrl(layer: Layer, optimized = false): string {
  const fields = layer.attributes
    .filter(a => !a.mainGeometry)
    .slice(0, 10)
    .map(a => a.columnName)
    .join(',') || 'id';

  const route = optimized ? '/tiles/dynamic-optimized' : '/tiles/dynamic';
  const cacheBuster = Date.now();

  const params = new URLSearchParams({
    schema: layer.schema,
    table: layer.tableName,
    geom: layer.geomColumn,
    srid: '4326',
    fields,
    _t: cacheBuster.toString(),
  });

  return `${TILE_BASE}${route}/{z}/{x}/{y}.pbf?${params.toString()}`;
}

/**
 * Build a custom dynamic tile URL
 */
export function buildCustomTileUrl(options: TileUrlOptions, optimized = false): string {
  const route = optimized ? '/tiles/dynamic-optimized' : '/tiles/dynamic';
  const cacheBuster = Date.now();

  const params = new URLSearchParams({
    schema: options.schema,
    table: options.table,
    geom: options.geom,
    srid: (options.srid || 4326).toString(),
    _t: cacheBuster.toString(),
  });

  if (options.fields) {
    params.set('fields', options.fields);
  }

  if (options.noCache) {
    params.set('nocache', '1');
  }

  return `${TILE_BASE}${route}/{z}/{x}/{y}.pbf?${params.toString()}`;
}

/**
 * Build an intersection tile URL
 */
export function buildIntersectionTileUrl(options: IntersectionOptions): string {
  const cacheBuster = Date.now();

  const params = new URLSearchParams({
    schema1: options.schema1,
    table1: options.table1,
    geom1: options.geom1,
    srid1: (options.srid1 || 4326).toString(),
    schema2: options.schema2,
    table2: options.table2,
    geom2: options.geom2,
    srid2: (options.srid2 || 4326).toString(),
    layer_name: options.layerName || 'intersection',
    _t: cacheBuster.toString(),
  });

  if (options.fields1) {
    params.set('fields1', options.fields1);
  }

  if (options.fields2) {
    params.set('fields2', options.fields2);
  }

  if (options.noCache) {
    params.set('nocache', '1');
  }

  return `${TILE_BASE}/tiles/dynamic-intersection/{z}/{x}/{y}.pbf?${params.toString()}`;
}

/**
 * Build a buffer tile URL
 */
export function buildBufferTileUrl(options: BufferOptions): string {
  const cacheBuster = Date.now();

  const params = new URLSearchParams({
    schema: options.schema,
    table: options.table,
    geom: options.geom,
    srid: (options.srid || 4326).toString(),
    buffer_meters: options.bufferMeters.toString(),
    dissolve: (options.dissolve || false).toString(),
    layer_name: options.layerName || 'buffer',
    _t: cacheBuster.toString(),
  });

  if (options.fields) {
    params.set('fields', options.fields);
  }

  if (options.noCache) {
    params.set('nocache', '1');
  }

  return `${TILE_BASE}/tiles/dynamic-buffer/{z}/{x}/{y}.pbf?${params.toString()}`;
}

/**
 * Purge cache for a specific table
 */
export async function purgeTableCache(schema: string, table: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${TILE_BASE}/tiles/cache/purge/dynamic/${schema}/${table}`,
      { credentials: 'include' }
    );
    return response.ok;
  } catch {
    return false;
  }
}
