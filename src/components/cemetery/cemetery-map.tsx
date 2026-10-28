"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { Gravestone } from "@/components/grave/gravestone";
import { GARDEN_V1_PLOTS, type GardenPlotDto } from "@/domain";

type CemeteryMapProps = {
  plots: GardenPlotDto[];
  selectable?: boolean;
  selectedPlot?: number | null;
  onSelectPlot?: (plotIndex: number) => void;
  onOpenGrave?: (graveId: string) => void;
};

export function CemeteryMap({
  plots,
  selectable = false,
  selectedPlot = null,
  onSelectPlot,
  onOpenGrave,
}: CemeteryMapProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const plotMap = useMemo(() => new Map(plots.map((plot) => [plot.plotIndex, plot])), [plots]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const nextX = drag.current.panX + (event.clientX - drag.current.x) / zoom;
    const nextY = drag.current.panY + (event.clientY - drag.current.y) / zoom;
    setPan({ x: Math.max(-22, Math.min(22, nextX)), y: Math.max(-18, Math.min(18, nextY)) });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handlePlotKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" ? 10 : event.key === "ArrowUp" ? -10 : 0;
    if (!delta) return;
    const next = index + delta;
    if (next < 0 || next > 99 || (Math.floor(index / 10) !== Math.floor(next / 10) && Math.abs(delta) === 1)) return;
    event.preventDefault();
    document.querySelector<HTMLButtonElement>(`[data-plot-index="${next}"]`)?.focus();
  }

  return (
    <section className="cemetery-map-shell" aria-label="Interactive cemetery map">
      <div className="map-toolbar">
        <p>Drag to wander · Use arrow keys between plots</p>
        <div className="map-zoom" aria-label="Map zoom controls">
          <button
            className="icon-button"
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.82, Number((value - 0.18).toFixed(2))))}
          >
            −
          </button>
          <span aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button
            className="icon-button"
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(1.54, Number((value + 0.18).toFixed(2))))}
          >
            +
          </button>
        </div>
      </div>
      <div
        className="cemetery-map-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="cemetery-map-canvas"
          style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
        >
          <div className="sky-haze" />
          <div className="garden-path garden-path-a" />
          <div className="garden-path garden-path-b" />
          <div className="garden-pond" aria-hidden="true" />
          {[0, 1, 2, 3, 4, 5, 6].map((tree) => (
            <span key={tree} className={`garden-tree garden-tree-${tree}`} aria-hidden="true">
              <i />
            </span>
          ))}
          {[0, 1, 2, 3, 4].map((light) => (
            <span key={light} className={`garden-light garden-light-${light}`} aria-hidden="true" />
          ))}

          <div className="plot-layer" role="grid" aria-label="One hundred cemetery plots">
            {GARDEN_V1_PLOTS.map((position) => {
              const plot = plotMap.get(position.index) ?? { plotIndex: position.index, occupied: false };
              const grave = plot.grave;
              const isSelected = selectedPlot === position.index;
              const isActionable = Boolean((grave && onOpenGrave) || (selectable && !plot.occupied && onSelectPlot));
              const label = grave
                ? `Plot ${position.index + 1}: ${grave.title}${grave.isExample ? ", example" : ""}`
                : plot.occupied
                  ? `Plot ${position.index + 1}: occupied, unavailable`
                  : `Plot ${position.index + 1}: open resting place`;
              return (
                <button
                  key={position.index}
                  type="button"
                  role="gridcell"
                  data-plot-index={position.index}
                  className={`map-plot ${grave ? "map-plot-occupied" : "map-plot-empty"} ${isSelected ? "map-plot-selected" : ""}`}
                  style={{
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                    transform: `translate(-50%, -50%) rotate(${position.rotation}deg) scale(${position.scale})`,
                  }}
                  aria-label={label}
                  aria-selected={isSelected}
                  disabled={!isActionable}
                  onKeyDown={(event) => handlePlotKeyDown(event, position.index)}
                  onClick={() => {
                    if (grave && onOpenGrave) onOpenGrave(grave.id);
                    else if (selectable && !plot.occupied) onSelectPlot?.(position.index);
                  }}
                >
                  {grave ? (
                    <Gravestone grave={grave} compact showText={false} />
                  ) : (
                    <span className="empty-plot-marker" aria-hidden="true" />
                  )}
                  {isSelected ? <span className="plot-selected-label">Chosen</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <a className="skip-map" href="#after-map">
        Leave the map
      </a>
    </section>
  );
}
