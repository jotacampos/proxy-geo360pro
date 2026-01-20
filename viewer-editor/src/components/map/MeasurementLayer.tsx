import { useMemo } from 'react';
import { GeoJsonLayer, TextLayer, ScatterplotLayer } from '@deck.gl/layers';
import distance from '@turf/distance';
import area from '@turf/area';
import length from '@turf/length';
import type { Feature, LineString, Polygon, Point } from 'geojson';
import { useEditorStore } from '../../stores/editorStore';

interface MeasurementLayerProps {
  showLabels?: boolean;
}

// Format distance for display
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters.toFixed(2)} m`;
}

// Format area for display
function formatArea(sqMeters: number): string {
  if (sqMeters >= 10000) {
    return `${(sqMeters / 10000).toFixed(2)} ha`;
  }
  return `${sqMeters.toFixed(2)} m²`;
}

// Calculate segment distances for a line
function calculateSegmentDistances(coords: [number, number][]): { midpoint: [number, number]; distance: number }[] {
  const segments: { midpoint: [number, number]; distance: number }[] = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const from: Feature<Point> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: coords[i] }
    };
    const to: Feature<Point> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: coords[i + 1] }
    };

    const dist = distance(from, to, { units: 'meters' });
    const midpoint: [number, number] = [
      (coords[i][0] + coords[i + 1][0]) / 2,
      (coords[i][1] + coords[i + 1][1]) / 2
    ];

    segments.push({ midpoint, distance: dist });
  }

  return segments;
}

// Calculate total length of a line
function calculateTotalLength(coords: [number, number][]): number {
  if (coords.length < 2) return 0;

  const lineFeature: Feature<LineString> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords }
  };

  return length(lineFeature, { units: 'meters' });
}

// Calculate area of a polygon
function calculateArea(coords: [number, number][]): number {
  if (coords.length < 3) return 0;

  // Close the polygon if not already closed
  const closedCoords = [...coords];
  if (coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1]) {
    closedCoords.push(coords[0]);
  }

  const polygonFeature: Feature<Polygon> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [closedCoords] }
  };

  return area(polygonFeature);
}

// Calculate centroid of coordinates
function calculateCentroid(coords: [number, number][]): [number, number] {
  if (coords.length === 0) return [0, 0];

  const sum = coords.reduce(
    (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
    [0, 0]
  );

  return [sum[0] / coords.length, sum[1] / coords.length];
}

export function useMeasurementLayers({ showLabels = true }: MeasurementLayerProps = {}) {
  const {
    measurementMode,
    measurementCoordinates,
    measurementResults,
    showMeasurements,
  } = useEditorStore();

  return useMemo(() => {
    if (!showMeasurements) return [];

    const layers: any[] = [];

    // Active measurement being drawn
    if (measurementCoordinates.length > 0) {
      // Points layer for measurement vertices
      layers.push(
        new ScatterplotLayer({
          id: 'measurement-vertices',
          data: measurementCoordinates.map((coord, index) => ({
            position: coord,
            index,
          })),
          getPosition: (d: any) => d.position,
          getRadius: 5,
          getFillColor: [255, 193, 7, 255], // Amber
          getLineColor: [255, 255, 255, 255],
          getLineWidth: 2,
          stroked: true,
          radiusMinPixels: 5,
          radiusMaxPixels: 8,
          pickable: false,
        })
      );

      // Line layer for measurement path
      if (measurementCoordinates.length >= 2) {
        const lineCoords = measurementMode === 'area' && measurementCoordinates.length >= 3
          ? [...measurementCoordinates, measurementCoordinates[0]] // Close polygon
          : measurementCoordinates;

        layers.push(
          new GeoJsonLayer({
            id: 'measurement-line',
            data: {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: lineCoords,
              },
              properties: {},
            },
            stroked: true,
            getLineColor: [255, 193, 7, 255], // Amber
            getLineWidth: 3,
            lineWidthMinPixels: 2,
            pickable: false,
          })
        );

        // Segment distance labels
        if (showLabels) {
          const segments = calculateSegmentDistances(measurementCoordinates);

          layers.push(
            new TextLayer({
              id: 'measurement-segment-labels',
              data: segments,
              getPosition: (d: any) => d.midpoint,
              getText: (d: any) => formatDistance(d.distance),
              getSize: 12,
              getColor: [255, 255, 255, 255],
              getBackgroundColor: [50, 50, 50, 200],
              background: true,
              backgroundPadding: [4, 2],
              getTextAnchor: 'middle',
              getAlignmentBaseline: 'center',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              pickable: false,
            })
          );
        }

        // Total measurement label
        if (showLabels) {
          let totalText = '';
          let labelPosition: [number, number];

          if (measurementMode === 'distance') {
            const total = calculateTotalLength(measurementCoordinates);
            totalText = `Total: ${formatDistance(total)}`;
            labelPosition = measurementCoordinates[measurementCoordinates.length - 1];
          } else if (measurementMode === 'area' && measurementCoordinates.length >= 3) {
            const areaValue = calculateArea(measurementCoordinates);
            const perimeterValue = calculateTotalLength([...measurementCoordinates, measurementCoordinates[0]]);
            totalText = `Área: ${formatArea(areaValue)}\nPerímetro: ${formatDistance(perimeterValue)}`;
            labelPosition = calculateCentroid(measurementCoordinates);
          } else {
            labelPosition = measurementCoordinates[measurementCoordinates.length - 1];
          }

          if (totalText) {
            layers.push(
              new TextLayer({
                id: 'measurement-total-label',
                data: [{ position: labelPosition, text: totalText }],
                getPosition: (d: any) => d.position,
                getText: (d: any) => d.text,
                getSize: 14,
                getColor: [255, 255, 255, 255],
                getBackgroundColor: [255, 152, 0, 230], // Orange background
                background: true,
                backgroundPadding: [8, 4],
                getTextAnchor: 'start',
                getAlignmentBaseline: 'top',
                getPixelOffset: [10, 10],
                fontFamily: 'monospace',
                fontWeight: 'bold',
                pickable: false,
              })
            );
          }
        }
      }
    }

    // Saved measurement results
    measurementResults.forEach((result, resultIndex) => {
      const baseId = `measurement-result-${resultIndex}`;

      // Vertices
      layers.push(
        new ScatterplotLayer({
          id: `${baseId}-vertices`,
          data: result.coordinates.map((coord, index) => ({
            position: coord,
            index,
          })),
          getPosition: (d: any) => d.position,
          getRadius: 4,
          getFillColor: [156, 39, 176, 255], // Purple for saved measurements
          getLineColor: [255, 255, 255, 255],
          getLineWidth: 1,
          stroked: true,
          radiusMinPixels: 4,
          radiusMaxPixels: 6,
          pickable: false,
        })
      );

      // Line
      if (result.coordinates.length >= 2) {
        const lineCoords = result.type === 'area'
          ? [...result.coordinates, result.coordinates[0]]
          : result.coordinates;

        layers.push(
          new GeoJsonLayer({
            id: `${baseId}-line`,
            data: {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: lineCoords,
              },
              properties: {},
            },
            stroked: true,
            getLineColor: [156, 39, 176, 200], // Purple
            getLineWidth: 2,
            lineWidthMinPixels: 1,
            pickable: false,
          })
        );
      }

      // Result label
      if (showLabels) {
        const labelPosition = result.type === 'area'
          ? calculateCentroid(result.coordinates)
          : result.coordinates[result.coordinates.length - 1];

        const labelText = result.type === 'distance'
          ? formatDistance(result.value)
          : formatArea(result.value);

        layers.push(
          new TextLayer({
            id: `${baseId}-label`,
            data: [{ position: labelPosition, text: labelText }],
            getPosition: (d: any) => d.position,
            getText: (d: any) => d.text,
            getSize: 12,
            getColor: [255, 255, 255, 255],
            getBackgroundColor: [156, 39, 176, 200],
            background: true,
            backgroundPadding: [6, 3],
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'center',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            pickable: false,
          })
        );
      }
    });

    return layers;
  }, [measurementMode, measurementCoordinates, measurementResults, showMeasurements, showLabels]);
}

// Export helper functions for use in other components
export { formatDistance, formatArea, calculateTotalLength, calculateArea };
