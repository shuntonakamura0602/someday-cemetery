"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { Gravestone } from "@/components/grave/gravestone";
import { useI18n } from "@/components/language-provider";
import { GARDEN_V1_PLOTS, type GardenPlotDto } from "@/domain";
import { localizeExampleGrave } from "@/i18n/presentation";

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
  const { locale } = useI18n();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const plotMap = useMemo(() => new Map(plots.map((plot) => [plot.plotIndex, plot])), [plots]);
  const text = locale === "ja"
    ? {
        mapLabel: "操作できる墓地の地図",
        instructions: "ドラッグして庭を歩く · 矢印キーで区画を移動",
        zoomControls: "地図の拡大・縮小",
        zoomOut: "縮小",
        zoomIn: "拡大",
        gridLabel: "100区画の墓地",
        selected: "選択済み",
        leaveMap: "地図を離れる",
      }
    : {
        mapLabel: "Interactive cemetery map",
        instructions: "Drag to wander · Use arrow keys between plots",
        zoomControls: "Map zoom controls",
        zoomOut: "Zoom out",
        zoomIn: "Zoom in",
        gridLabel: "One hundred cemetery plots",
        selected: "Chosen",
        leaveMap: "Leave the map",
      };

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
    <section className="cemetery-map-shell" aria-label={text.mapLabel}>
      <div className="map-toolbar">
        <p>{text.instructions}</p>
        <div className="map-zoom" aria-label={text.zoomControls}>
          <button
            className="icon-button"
            type="button"
            aria-label={text.zoomOut}
            onClick={() => setZoom((value) => Math.max(0.82, Number((value - 0.18).toFixed(2))))}
          >
            −
          </button>
          <span aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button
            className="icon-button"
            type="button"
            aria-label={text.zoomIn}
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

          <div className="plot-layer" role="grid" aria-label={text.gridLabel}>
            {GARDEN_V1_PLOTS.map((position) => {
              const plot = plotMap.get(position.index) ?? { plotIndex: position.index, occupied: false };
              const grave = plot.grave ? localizeExampleGrave(plot.grave, locale) : undefined;
              const isSelected = selectedPlot === position.index;
              const isActionable = Boolean((grave && onOpenGrave) || (selectable && !plot.occupied && onSelectPlot));
              const plotNumber = position.index + 1;
              const label = locale === "ja"
                ? grave
                  ? `区画 ${plotNumber}: ${grave.title}${grave.isExample ? "、投稿例" : ""}`
                  : plot.occupied
                    ? `区画 ${plotNumber}: 使用中のため選択できません`
                    : `区画 ${plotNumber}: 空いている場所`
                : grave
                  ? `Plot ${plotNumber}: ${grave.title}${grave.isExample ? ", example" : ""}`
                  : plot.occupied
                    ? `Plot ${plotNumber}: occupied, unavailable`
                    : `Plot ${plotNumber}: open resting place`;
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
                  {isSelected ? <span className="plot-selected-label">{text.selected}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <a className="skip-map" href="#after-map">
        {text.leaveMap}
      </a>
    </section>
  );
}
