"use client";
import { useCallback, useMemo, useState, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  useReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Roadmap, RoadmapNode, Assessment } from "@/lib/types";
import RoadmapNodeComponent from "./RoadmapNode";
import NodePanel from "./NodePanel";
import QuizRunner from "../assessment/QuizRunner";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Loader2, X } from "lucide-react";

const nodeTypes = { roadmapNode: RoadmapNodeComponent };

function isNodeVisible(n: RoadmapNode, allNodes: RoadmapNode[], edges: { source: string; target: string }[]): boolean {
  const nodesMap = new Map(allNodes.map(node => [node.id, node]));

  const getTier = (depth: number | string | undefined): number => {
    if (depth === undefined) return 0;
    if (typeof depth === "number") return depth;
    if (depth === "CoreNode") return 0;
    if (depth === "SubNode") return 1;
    if (depth === "SubSubNode") return 2;
    const num = parseInt(depth, 10);
    return isNaN(num) ? 0 : num;
  };

  const getParents = (nodeId: string): string[] => {
    const parentSet = new Set<string>();
    const nodeObj = nodesMap.get(nodeId);
    if (nodeObj?.parent) {
      parentSet.add(nodeObj.parent);
    }
    for (const e of edges) {
      if (e.target === nodeId) {
        parentSet.add(e.source);
      }
    }
    return Array.from(parentSet);
  };

  const getChildren = (nodeId: string): string[] => {
    const childrenSet = new Set<string>();
    for (const e of edges) {
      if (e.source === nodeId) {
        childrenSet.add(e.target);
      }
    }
    for (const node of allNodes) {
      if (node.parent === nodeId) {
        childrenSet.add(node.id);
      }
    }
    return Array.from(childrenSet);
  };

  const isBaseVisible = (nodeId: string, visited: Set<string>): boolean => {
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);

    const node = nodesMap.get(nodeId);
    if (!node) return false;

    const tier = getTier(node.depth);
    if (tier === 0) return true;

    if (node.status === "unlocked" || node.status === "in_progress" || node.status === "completed") {
      return true;
    }

    const parents = getParents(nodeId);
    if (parents.length === 0) {
      return true;
    }

    const hasUnlockedParentOneTierAbove = parents.some(pId => {
      const parentNode = nodesMap.get(pId);
      if (!parentNode) return false;
      const parentTier = getTier(parentNode.depth);
      return (tier - parentTier === 1) && (parentNode.status !== "locked");
    });

    if (hasUnlockedParentOneTierAbove) return true;

    const allParentsCompleted = parents.every(pId => {
      const parentNode = nodesMap.get(pId);
      return parentNode?.status === "completed";
    });

    if (allParentsCompleted) return true;

    return false;
  };

  const checkDescendantsVisible = (startId: string): boolean => {
    const queue = [startId];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);

      if (isBaseVisible(curr, new Set<string>())) {
        return true;
      }

      queue.push(...getChildren(curr));
    }
    return false;
  };

  return checkDescendantsVisible(n.id);
}

function buildFlowNodes(
  roadmap: Roadmap,
  assessments: Assessment[],
  onSelect: (n: RoadmapNode) => void,
): Node[] {
  const visibleNodes = roadmap.nodes.filter(n => isNodeVisible(n, roadmap.nodes, roadmap.edges));
  return visibleNodes.map(n => ({
    id: n.id,
    type: "roadmapNode",
    position: n.position,
    data: { ...n, assessments, onClick: () => onSelect(n) },
    draggable: true,
  }));
}

function buildFlowEdges(roadmap: Roadmap): Edge[] {
  const visibleNodeIds = new Set(
    roadmap.nodes.filter(n => isNodeVisible(n, roadmap.nodes, roadmap.edges)).map(n => n.id)
  );
  
  const visibleEdges = roadmap.edges.filter(
    e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
  );

  return visibleEdges.map(e => {
    const targetNode = roadmap.nodes.find(n => n.id === e.target);
    const isTargetLocked = targetNode?.status === "locked";
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      animated: roadmap.nodes.find(n => n.id === e.source)?.status === "in_progress",
      style: {
        stroke: isTargetLocked ? "#d0cbbf" : "#c8bfb0",
        strokeWidth: 2,
        strokeDasharray: isTargetLocked ? "5,5" : undefined,
      },
    };
  });
}

/** Stable key so we remount flow state when node status changes — no sync useEffect loop */
function graphStateKey(roadmap: Roadmap): string {
  return roadmap.nodes.map(n => `${n.id}:${n.status}:${n.confidence}`).join("|");
}

function RoadmapFlow({ roadmap }: { roadmap: Roadmap }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<any>(null); // Assessment | null
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const { refresh, assessments } = useApp();
  const { setCenter } = useReactFlow();

  const needsEnrichment = useMemo(() => {
    return roadmap.nodes.some(n => 
      (n.status === "unlocked" || n.status === "in_progress") &&
      (
        (n.isSkillCheck && (!n.tasks || n.tasks.length === 0)) ||
        (!n.isSkillCheck && (!n.resources || n.resources.length === 0) && (!n.tasks || n.tasks.length === 0))
      )
    );
  }, [roadmap]);

  useEffect(() => {
    if (!needsEnrichment) return;

    const intervalId = setInterval(async () => {
      try {
        const updated = await api.getRoadmap(roadmap.id);
        const stillNeedsEnrichment = updated.nodes.some(n => 
          (n.status === "unlocked" || n.status === "in_progress") &&
          (
            (n.isSkillCheck && (!n.tasks || n.tasks.length === 0)) ||
            (!n.isSkillCheck && (!n.resources || n.resources.length === 0) && (!n.tasks || n.tasks.length === 0))
          )
        );
        
        if (!stillNeedsEnrichment) {
          clearInterval(intervalId);
          await refresh();
        } else {
          const currentEnrichedCount = roadmap.nodes.filter(n => (n.resources && n.resources.length > 0) || (n.tasks && n.tasks.length > 0)).length;
          const updatedEnrichedCount = updated.nodes.filter(n => (n.resources && n.resources.length > 0) || (n.tasks && n.tasks.length > 0)).length;
          if (updatedEnrichedCount > currentEnrichedCount) {
            await refresh();
          }
        }
      } catch (e) {
        console.error("Error polling roadmap enrichment status:", e);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [needsEnrichment, roadmap.id, refresh, roadmap.nodes]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return roadmap.nodes.find(n => n.id === selectedNodeId) || null;
  }, [roadmap.nodes, selectedNodeId]);

  const handleSelectNode = useCallback((n: RoadmapNode | null) => {
    setSelectedNodeId(n ? n.id : null);
  }, []);

  const initialNodes = useMemo(
    () => buildFlowNodes(roadmap, assessments, handleSelectNode),
    [roadmap, assessments, handleSelectNode],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

  useEffect(() => {
    setNodes(initialNodes.map(node => ({
      ...node,
      selected: node.id === selectedNodeId
    })));
  }, [initialNodes, selectedNodeId, setNodes]);

  useEffect(() => {
    setNodes(prevNodes =>
      prevNodes.map(node => ({
        ...node,
        selected: node.id === selectedNodeId
      }))
    );
  }, [selectedNodeId, setNodes]);

  useEffect(() => {
    if (selectedNode) {
      const x = selectedNode.position.x + 186 / 2;
      const y = selectedNode.position.y + 80 / 2;
      setCenter(x, y, { zoom: 1.0, duration: 800 });
    }
  }, [selectedNode, setCenter]);

  const activeNodeId = hoveredNodeId || selectedNodeId || null;

  const flowEdges = useMemo(() => {
    const visibleNodeIds = new Set(
      roadmap.nodes.filter(n => isNodeVisible(n, roadmap.nodes, roadmap.edges)).map(n => n.id)
    );
    
    const visibleEdges = roadmap.edges.filter(
      e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );

    return visibleEdges.map(e => {
      const targetNode = roadmap.nodes.find(n => n.id === e.target);
      const isTargetLocked = targetNode?.status === "locked";
      const isSourceActive = activeNodeId && e.source === activeNodeId;
      const isTargetActive = activeNodeId && e.target === activeNodeId;
      const isDirectlyConnected = isSourceActive || isTargetActive;

      const opacity = activeNodeId ? (isDirectlyConnected ? 1.0 : 0.15) : 0.6;
      const strokeWidth = activeNodeId && isDirectlyConnected ? 2.5 : 2;

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        animated: roadmap.nodes.find(n => n.id === e.source)?.status === "in_progress",
        style: {
          stroke: isTargetLocked ? "#d0cbbf" : "#c8bfb0",
          strokeWidth,
          strokeDasharray: isTargetLocked ? "5,5" : undefined,
          opacity,
          transition: "opacity 0.2s, stroke-width 0.2s",
        },
      };
    });
  }, [roadmap, activeNodeId]);

  const handleTakeQuiz = async (nodeId: string) => {
    setLoadingQuiz(true);
    try {
      const quiz = await api.generateQuiz(roadmap.id, nodeId, "milestone");
      setActiveQuiz(quiz);
    } catch (e) {
      console.error("Failed to generate quiz assessment:", e);
    } finally {
      setLoadingQuiz(false);
    }
  };


  const handleQuizFinish = async () => {
    setActiveQuiz(null);
    await refresh();
  };

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <div
        style={{
          flex: 1,
          height: "100%",
          minHeight: 0,
          minWidth: 0,
          position: "relative",
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => {
            const rn = roadmap.nodes.find(n => n.id === node.id);
            if (rn && rn.status !== "locked") handleSelectNode(rn);
          }}
          onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
          onNodeMouseLeave={() => setHoveredNodeId(null)}
          onPaneClick={() => handleSelectNode(null)}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.25}
          maxZoom={1.8}
          proOptions={{ hideAttribution: true }}
          style={{ width: "100%", height: "100%" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#e2d9cc" />
          <Controls position="bottom-left" />
          <MiniMap
            position="bottom-right"
            nodeColor={n => {
              const rn = roadmap.nodes.find(nn => nn.id === n.id);
              if (!rn) return "#e2d9cc";
              const colors: Record<string, string> = {
                success: "#1a9e5c",
                completed: "#1a9e5c",
                in_progress: "#e8520a",
                failed: "#dc3545",
                not_started: "#c8bfb0",
                unlocked: "#c8bfb0",
                locked: "#e2d9cc",
              };
              return colors[rn.status] || "#e2d9cc";
            }}
            maskColor="rgba(250,247,242,0.7)"
          />
        </ReactFlow>
      </div>

      {selectedNode && (
        <NodePanel
          node={selectedNode}
          roadmap={roadmap}
          onClose={() => handleSelectNode(null)}
          onTakeQuiz={handleTakeQuiz}
          onSelectNode={(id) => handleSelectNode(roadmap.nodes.find(n => n.id === id) || null)}
        />
      )}

      {/* Quiz Modal Overlay */}
      {(activeQuiz || loadingQuiz) && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(26,20,10,0.5)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}>
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            width: "100%",
            maxWidth: 520,
            padding: 32,
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            position: "relative"
          }}>
            <button 
              onClick={() => { setActiveQuiz(null); setLoadingQuiz(false); }}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: "5px 7px",
                display: "flex",
                alignItems: "center"
              }}
            >
              <X size={15} />
            </button>

            {loadingQuiz ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0" }}>
                <Loader2 size={36} color="var(--accent)" style={{ animation: "spin 1s linear infinite", marginBottom: 20 }} />
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>Curating Quiz Questions...</h3>
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8, textAlign: "center" }}>
                  The Inquisitor is generating exactly 5 personalized quiz questions to test your knowledge.
                </p>
              </div>
            ) : (
              <QuizRunner assessment={activeQuiz} onFinish={handleQuizFinish} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RoadmapCanvas({ roadmap }: { roadmap: Roadmap }) {
  const remountKey = `${roadmap.id}:${graphStateKey(roadmap)}`;

  return (
    <ReactFlowProvider key={remountKey}>
      <RoadmapFlow roadmap={roadmap} />
    </ReactFlowProvider>
  );
}
