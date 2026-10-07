"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D, { type ForceGraphMethods } from "react-force-graph-3d";
import * as THREE from "three";
import { ExternalLink, Focus, MousePointer2, Rotate3D, RotateCcw, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { GraphEdge, GraphNode } from "./ProjectContextMap";

type ForceNode = GraphNode & { id: string; val: number; color: string; z?: number };
type ForceLink = GraphEdge & { source: string | ForceNode; target: string | ForceNode };

const NODE_COLORS: Record<GraphNode["kind"], string> = {
  project: "#ec1b69",
  agent: "#35e6b1",
  task: "#f5c451",
  source: "#38bdf8",
  gate: "#a78bfa",
};

function endpointId(value: string | ForceNode): string {
  return typeof value === "string" ? value : value.id;
}

function safeTooltip(node: ForceNode): string {
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char] ?? char);
  return `<div style="padding:6px 8px;border:1px solid ${node.color};border-radius:8px;background:#0e0716;color:#ececff"><strong>${escape(node.label)}</strong><br/><small>${escape(node.status || node.kind)}</small></div>`;
}

function labelSprite(node: ForceNode, dimmed: boolean): THREE.Sprite {
  const text = node.label;
  const color = dimmed ? "#51465e" : node.color;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 150;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = dimmed ? "rgba(7,3,13,.46)" : "rgba(10,6,18,.94)";
    context.roundRect(5, 8, 630, 134, 24);
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = node.kind === "project" ? 5 : 3;
    context.stroke();
    context.font = "600 32px system-ui, sans-serif";
    context.fillStyle = dimmed ? "rgba(247,241,255,.4)" : "#f7f1ff";
    const compact = text.length > 32 ? `${text.slice(0, 31)}…` : text;
    context.fillText(compact, 320, 60);
    context.font = "500 18px system-ui, sans-serif";
    context.fillStyle = dimmed ? "rgba(170,164,190,.3)" : color;
    context.fillText((node.status || (node.isPM ? "LEAD AGENT" : node.kind)).toUpperCase(), 320, 104);
  }
  const material = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const width = node.kind === "project" ? 132 : node.kind === "task" ? 112 : 104;
  sprite.scale.set(width, width * (150 / 640), 1);
  return sprite;
}

function blockObject(node: ForceNode, dimmed: boolean): THREE.Object3D {
  const group = new THREE.Group();
  const color = dimmed ? "#30283d" : node.color;
  const isProject = node.kind === "project";
  const isAgent = node.kind === "agent";
  const isTask = node.kind === "task";
  const isSource = node.kind === "source";
  const radius = isProject ? 18 : isAgent ? 13 : isTask ? 10 : isSource ? 9 : 8;
  const geometry = new THREE.SphereGeometry(radius, 28, 20);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: dimmed ? 0.04 : node.live?.bridgeConnected || node.status === "In progress" ? 0.55 : isProject ? 0.42 : 0.24,
    metalness: 0.28,
    roughness: 0.42,
    transparent: true,
    opacity: dimmed ? 0.35 : 0.94,
  });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.34, 24, 18),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: dimmed ? 0.025 : node.live?.bridgeConnected || node.status === "In progress" ? 0.14 : 0.07,
      depthWrite: false,
      side: THREE.BackSide,
    }),
  );
  group.add(halo);
  if (isProject || isAgent) {
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.62, isProject ? 0.55 : 0.36, 10, 52),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: dimmed ? 0.08 : 0.48 }),
    );
    orbit.rotation.x = Math.PI * 0.62;
    orbit.rotation.z = Math.PI * 0.12;
    group.add(orbit);
  }
  const label = labelSprite(node, dimmed);
  label.position.set(0, isProject ? 27 : isAgent ? 22 : 18, 0);
  group.add(label);
  return group;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials) {
      const map = (material as THREE.Material & { map?: THREE.Texture }).map;
      map?.dispose();
      material.dispose();
    }
  });
}

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function InteractiveGraph3D({
  nodes,
  edges,
  ariaLabel,
  expanded,
  compact = false,
  mode = "knowledge",
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  ariaLabel: string;
  expanded: boolean;
  compact?: boolean;
  mode?: "knowledge" | "execution";
}) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<ForceNode, ForceLink> | undefined>(undefined);
  const objectCache = useRef(new Map<string, THREE.Object3D>());
  const [size, setSize] = useState({ width: 720, height: 430 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hasAutoFit = useRef(false);
  const reducedMotion = useReducedMotionPreference();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({
        width: Math.max(280, Math.floor(entry.contentRect.width)),
        height: Math.max(320, Math.floor(entry.contentRect.height)),
      });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    for (const object of objectCache.current.values()) disposeObject(object);
    objectCache.current.clear();
  }, []);

  const graphData = useMemo(() => {
    const degree = new Map<string, number>();
    for (const edge of edges) {
      degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
      degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
    }
    return {
      nodes: nodes.map((node): ForceNode => ({
        ...node,
        id: node.key,
        val: Math.min(16, 4 + Math.sqrt(degree.get(node.key) ?? 1) * 3),
        color: NODE_COLORS[node.kind],
      })),
      links: edges.map((edge): ForceLink => ({ ...edge, source: edge.from, target: edge.to })),
    };
  }, [edges, nodes]);

  const selected = graphData.nodes.find((node) => node.id === selectedId) ?? null;
  const neighbors = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const result = new Set<string>([selectedId]);
    for (const link of graphData.links) {
      const source = endpointId(link.source);
      const target = endpointId(link.target);
      if (source === selectedId) result.add(target);
      if (target === selectedId) result.add(source);
    }
    return result;
  }, [graphData.links, selectedId]);

  const connectedNodes = useMemo(() => selectedId
    ? graphData.nodes.filter((node) => node.id !== selectedId && neighbors.has(node.id))
    : [], [graphData.nodes, neighbors, selectedId]);

  const fitGraph = useCallback((animated = true) => {
    graphRef.current?.zoomToFit(animated && !reducedMotion ? 600 : 0, 32);
  }, [reducedMotion]);

  useEffect(() => {
    hasAutoFit.current = false;
    const frame = window.setTimeout(() => fitGraph(false), 80);
    return () => window.clearTimeout(frame);
  }, [fitGraph, graphData]);

  useEffect(() => {
    const charge = graphRef.current?.d3Force("charge") as { strength?: (value: number) => unknown } | undefined;
    const link = graphRef.current?.d3Force("link") as { distance?: (value: number) => unknown } | undefined;
    charge?.strength?.(-260);
    link?.distance?.(112);
    // No manual reheat: new graphData already restarts the simulation once the
    // library has built its layout. Reheating earlier starts the engine with
    // no layout, the first frame throws ("reading 'tick'") and the graph stays
    // blank.
  }, [graphData]);

  const selectNode = useCallback((node: ForceNode) => {
    setSelectedId(node.id);
    const distance = 105;
    const length = Math.hypot(node.x || 1, node.y || 1, node.z || 1);
    const ratio = 1 + distance / length;
    graphRef.current?.cameraPosition(
      { x: (node.x || 0) * ratio, y: (node.y || 0) * ratio, z: 120 },
      { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
      reducedMotion ? 0 : 650,
    );
  }, [reducedMotion]);

  const nodeObject = useCallback((node: ForceNode) => {
    const dimmed = Boolean(selectedId && !neighbors.has(node.id));
    const key = `${node.id}:${node.label}:${node.status ?? ""}:${node.color}:${dimmed ? "dim" : "full"}`;
    const cached = objectCache.current.get(key);
    if (cached) return cached;
    const object = blockObject(node, dimmed);
    objectCache.current.set(key, object);
    return object;
  }, [neighbors, selectedId]);

  useEffect(() => {
    const prefixes = graphData.nodes.map((node) => `${node.id}:${node.label}:${node.status ?? ""}:${node.color}:`);
    for (const [key, object] of objectCache.current) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) continue;
      disposeObject(object);
      objectCache.current.delete(key);
    }
  }, [graphData.nodes]);

  return (
    <div
      ref={hostRef}
      className={cn(
        "relative isolate w-full overflow-hidden rounded-lg border border-border bg-[#07030d] [touch-action:none]",
        expanded
          ? "h-[calc(100dvh-10rem)]"
          : compact
            ? mode === "execution" ? "h-[460px]" : "h-[300px] lg:h-full lg:min-h-[320px]"
            : "h-[360px] sm:h-[460px]",
      )}
      role="application"
      aria-label={ariaLabel}
    >
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_45%,rgba(236,27,105,.10),transparent_38%),linear-gradient(rgba(255,255,255,.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.022)_1px,transparent_1px)] bg-[size:auto,32px_32px,32px_32px]" />
      {mode === "execution" ? (
        <div className="pointer-events-none absolute inset-0 z-[1] grid grid-cols-4 pt-12" aria-hidden>
          {["Goal", "Coordinator", "Agents", "Work"].map((label, index) => (
            <div key={label} className={cn("relative border-white/[.055]", index < 3 && "border-r")}>
              <span className="absolute left-3 top-0 text-[9px] font-medium uppercase tracking-[0.16em] text-white/30">{label}</span>
            </div>
          ))}
        </div>
      ) : null}
      <ForceGraph3D<ForceNode, ForceLink>
        ref={graphRef}
        width={size.width}
        height={size.height}
        graphData={graphData}
        backgroundColor="#07030d"
        controlType="orbit"
        numDimensions={2}
        enableNavigationControls
        enableNodeDrag
        showNavInfo={false}
        nodeLabel={safeTooltip}
        nodeThreeObject={nodeObject}
        nodeThreeObjectExtend={false}
        nodeVal="val"
        nodeColor={(node) => selectedId && !neighbors.has(node.id) ? "#30283d" : node.color}
        nodeOpacity={0.94}
        nodeResolution={12}
        linkColor={(link) => {
          if (!selectedId) return link.color;
          return endpointId(link.source) === selectedId || endpointId(link.target) === selectedId
            ? "#ffffff"
            : "rgba(70,60,88,.16)";
        }}
        linkWidth={(link) => link.active ? 2.8 : selectedId && (endpointId(link.source) === selectedId || endpointId(link.target) === selectedId) ? 2.2 : 1.15}
        linkOpacity={0.72}
        linkDirectionalParticles={(link) => reducedMotion ? 0 : link.active ? 4 : 1}
        linkDirectionalArrowLength={7}
        linkDirectionalArrowRelPos={0.88}
        linkDirectionalArrowColor={(link) => selectedId && !(endpointId(link.source) === selectedId || endpointId(link.target) === selectedId) ? "rgba(70,60,88,.16)" : link.color}
        linkDirectionalParticleWidth={(link) => link.active ? 2.2 : 0.9}
        linkDirectionalParticleColor={() => "#ffffff"}
        linkDirectionalParticleSpeed={(link) => reducedMotion ? 0 : link.active ? 0.007 : 0.0025}
        d3AlphaDecay={0.018}
        d3VelocityDecay={0.34}
        warmupTicks={32}
        cooldownTicks={360}
        onEngineStop={() => {
          if (!hasAutoFit.current) {
            hasAutoFit.current = true;
            fitGraph(!reducedMotion);
          }
        }}
        onNodeClick={selectNode}
        onNodeHover={(node) => setHoveredId(node?.id ?? null)}
        onBackgroundClick={() => setSelectedId(null)}
      />

      <ul className="sr-only" aria-label={`${ariaLabel} nodes`}>
        {graphData.nodes.map((node) => (
          <li key={node.id}>
            <button type="button" onClick={() => selectNode(node)}>{node.label}: {node.status || node.kind}</button>
          </li>
        ))}
      </ul>

      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <div className="pointer-events-none flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[10px] text-white/70 backdrop-blur">
          <Rotate3D className="h-3.5 w-3.5 text-primary" />
          {t("components.graph.rotateHint")}
        </div>
        <button type="button" onClick={() => fitGraph(true)} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[10px] text-white/75 backdrop-blur transition hover:border-primary/40 hover:text-white">
          <RotateCcw className="h-3.5 w-3.5" /> {t("components.graph.resetView")}
        </button>
        {selectedId ? <button type="button" onClick={() => { setSelectedId(null); fitGraph(true); }} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[10px] text-white/75 backdrop-blur transition hover:border-primary/40 hover:text-white"><X className="h-3.5 w-3.5" /> {t("components.graph.clear")}</button> : null}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden flex-wrap gap-1.5 sm:flex">
        {Object.entries(NODE_COLORS).map(([kind, color]) => <span key={kind} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/65 px-2 py-1 text-[9px] capitalize text-white/65 backdrop-blur"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />{kind}</span>)}
      </div>

      {hoveredId && !selectedId ? <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[10px] text-white/70 backdrop-blur">{t("components.graph.clickToFocus")}</div> : null}

      {selected ? (
        <aside className="absolute bottom-3 left-3 right-3 z-10 rounded-xl border border-primary/35 bg-[#0e0716]/95 p-4 shadow-2xl backdrop-blur sm:bottom-auto sm:left-auto sm:right-3 sm:top-14 sm:w-72">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full shadow-[0_0_12px_currentColor]" style={{ backgroundColor: selected.color, color: selected.color }} />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("components.graph.selected")}</span>
          </div>
          <h3 className="mt-2 break-words text-sm font-semibold text-foreground">{selected.label}</h3>
          <p className="mt-1 text-xs capitalize text-muted-foreground">{selected.status || selected.kind}</p>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <MousePointer2 className="h-3 w-3" />
            {t("components.graph.neighbors", { count: Math.max(0, neighbors.size - 1) })}
          </p>
          {connectedNodes.length > 0 ? <div className="mt-3 border-t border-white/10 pt-3"><p className="text-[9px] uppercase tracking-[.16em] text-muted-foreground">{t("components.graph.connectedTo")}</p><div className="mt-2 flex flex-wrap gap-1.5">{connectedNodes.slice(0, 6).map((node) => <button key={node.id} type="button" onClick={() => selectNode(node)} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[.04] px-2 py-1 text-[9px] text-foreground transition hover:border-primary/40"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: node.color }} />{node.label}</button>)}</div></div> : null}
          {selected.href ? (
            <Link href={selected.href} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              {t("components.graph.openEntity")} <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
          <button type="button" onClick={() => fitGraph(true)} className="mt-3 inline-flex items-center gap-1.5 text-[10px] text-muted-foreground transition hover:text-foreground"><Focus className="h-3 w-3" />{t("components.graph.showFullMap")}</button>
        </aside>
      ) : null}
    </div>
  );
}
