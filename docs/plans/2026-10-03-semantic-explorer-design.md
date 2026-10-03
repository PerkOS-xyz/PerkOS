# Semantic Explorer design

The visual direction is an Obsidian-style living knowledge graph rather than a static org chart: organic force layout, softly moving relationships, luminous semantic nodes, and smooth focus transitions. PerkOS extends that model with operational meaning, showing projects, agents, tasks, sources, status, and active work directly in the graph.

## Goal

Turn Explore from a decorative 3D cluster into a legible relationship map that complements Project Stage.

## Design

- Keep 3D navigation, but fit the camera to the actual graph on load and on reset.
- Give every node an always-visible label and a recognizable shape by semantic type.
- Make the project the dominant anchor, agents the second layer, and work/sources the outer layer.
- Use directional links, active particles, selection dimming and a readable inspector.
- Add visible Reset view and Clear selection controls.
- Show a compact semantic legend inside the graph rather than relying on the footer alone.
- Focus the camera on a selected node and reveal its directly connected entities.

## Verification

- Unit-test graph semantics and controls with the WebGL renderer mocked.
- Run typecheck, targeted lint and production build.
- Validate camera framing, labels, selection, reset and Stage/Explore switching with production project data.
