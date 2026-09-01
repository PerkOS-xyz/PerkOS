"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { ExternalLink, MousePointer2, Rotate3D } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { GraphEdge, GraphNode } from "./ProjectContextMap";

type ForceNode = GraphNode & { id: string; val: number; color: string };
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

function labelSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = "600 30px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(7,3,13,.86)";
    context.roundRect(4, 8, 504, 80, 18);
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = "#f7f1ff";
    const compact = text.length > 28 ? `${text.slice(0, 27)}…` : text;
    context.fillText(compact, 256, 49);
  }
  const material = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(58, 11, 1);
  return sprite;
}

function blockObject(node: ForceNode, dimmed: boolean): THREE.Object3D {
  const group = new THREE.Group();
  const color = dimmed ? "#30283d" : node.color;
  const isAgent = node.shape === "agent-block";
  const isTask = node.shape === "task-block";
  const geometry = isAgent
    ? new THREE.BoxGeometry(30, 18, 12, 2, 2, 2)
    : isTask
      ? new THREE.BoxGeometry(38, 13, 9, 2, 2, 2)
      : new THREE.SphereGeometry(Math.max(6, node.val / 1.8), 18, 12);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: dimmed ? 0.05 : node.live?.bridgeConnected || node.status === "In progress" ? 0.48 : 0.2,
    metalness: 0.28,
    roughness: 0.42,
    transparent: true,
    opacity: dimmed ? 0.35 : 0.94,
  });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  if (isAgent || isTask) {
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: dimmed ? "#51465e" : "#ffffff", transparent: true, opacity: dimmed ? 0.15 : 0.48 }),
    );
    group.add(outline);
    const label = labelSprite(node.label, color);
    label.position.set(0, isAgent ? 16 : 13, 0);
    group.add(label);
  }
  return group;
}

export function InteractiveGraph3D({
  nodes,
  edges,
  ariaLabel,
  expanded,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  ariaLabel: string;
  expanded: boolean;
}) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 720, height: 430 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  return (
    <div
      ref={hostRef}
      className={cn(
        "relative isolate w-full overflow-hidden rounded-lg border border-border bg-[#07030d] [touch-action:none]",
        expanded ? "h-[calc(100dvh-10rem)]" : "h-[360px] sm:h-[460px]",
      )}
      role="application"
      aria-label={ariaLabel}
    >
      <ForceGraph3D<ForceNode, ForceLink>
        width={size.width}
        height={size.height}
        graphData={graphData}
        backgroundColor="#07030d"
        controlType="trackball"
        enableNavigationControls
        enableNodeDrag
        showNavInfo={false}
        nodeLabel={safeTooltip}
        nodeThreeObject={(node) => blockObject(node, Boolean(selectedId && !neighbors.has(node.id)))}
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
        linkWidth={(link) => link.active ? 2.2 : selectedId && (endpointId(link.source) === selectedId || endpointId(link.target) === selectedId) ? 1.8 : 0.7}
        linkOpacity={0.58}
        linkDirectionalParticles={(link) => link.active ? 3 : 0}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={0.88}
        linkDirectionalArrowColor={(link) => selectedId && !(endpointId(link.source) === selectedId || endpointId(link.target) === selectedId) ? "rgba(70,60,88,.16)" : link.color}
        linkDirectionalParticleWidth={1.8}
        linkDirectionalParticleColor={() => "#ffffff"}
        linkDirectionalParticleSpeed={0.006}
        d3VelocityDecay={0.32}
        cooldownTime={6_000}
        onNodeClick={(node) => setSelectedId(node.id)}
        onBackgroundClick={() => setSelectedId(null)}
      />

      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[10px] text-white/70 backdrop-blur">
        <Rotate3D className="h-3.5 w-3.5 text-primary" />
        {t("components.graph.rotateHint")}
      </div>

      {selected ? (
        <aside className="absolute bottom-3 left-3 right-3 z-10 rounded-xl border border-primary/35 bg-[#0e0716]/95 p-3 shadow-2xl backdrop-blur sm:left-auto sm:top-3 sm:w-64">
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
          {selected.href ? (
            <Link href={selected.href} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              {t("components.graph.openEntity")} <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
