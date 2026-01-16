/**
 * LinkedNotesGraph Component
 * Interactive force-directed graph visualization for linked notes
 * Similar to Obsidian's graph view
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, Maximize2, RefreshCw, FileCode, PenTool, FileText } from 'lucide-react';
import { WorkspaceFile, FileType } from '../../types/workspace';
import { parseMentions } from '../../utils/noteLinking';
import { useTheme } from '../../contexts/ThemeContext';
import clsx from 'clsx';

interface GraphNode {
    id: string;
    name: string;
    type: FileType;
    x: number;
    y: number;
    vx: number;
    vy: number;
    connections: number;
    isHovered: boolean;
    isDragging: boolean;
    revealOrder: number;      // Order in which this node is revealed (-1 = not yet assigned)
    opacity: number;          // Current opacity for animation (0-1)
}

interface GraphEdge {
    source: string;
    target: string;
    animated: boolean;
}

interface LinkedNotesGraphProps {
    isOpen: boolean;
    onClose: () => void;
    workspaceFiles: WorkspaceFile[];
    onNavigateToFile: (fileId: string) => void;
    getFileContent: (fileId: string) => Promise<string>;
}

// Get icon for file type
const getFileIcon = (type: FileType) => {
    switch (type) {
        case 'exec': return FileCode;
        case 'board': return PenTool;
        case 'note': return FileText;
        default: return FileCode;
    }
};

// Get color for file type
const getFileTypeColor = (type: FileType) => {
    switch (type) {
        case 'exec': return '#3b82f6';  // Blue for notebooks/cells
        case 'board': return '#a855f7'; // Purple for boards
        case 'note': return '#22c55e';  // Green for quick notes
        default: return '#6b7280';
    }
};

// Physics constants for force simulation - tuned for stability
const REPULSION_STRENGTH = 500;        // Reduced to prevent oscillation
const ATTRACTION_STRENGTH = 0.015;     // Reduced for gentler pull
const DAMPING = 0.75;                  // More damping to settle faster
const CENTER_GRAVITY = 0.008;          // Slightly reduced
const MIN_DISTANCE = 100;              // Increased minimum distance
const MAX_VELOCITY = 15;               // Cap velocity to prevent wild movements
const VELOCITY_THRESHOLD = 0.1;        // Stop simulation when settled


export function LinkedNotesGraph({
    isOpen,
    onClose,
    workspaceFiles,
    onNavigateToFile,
    getFileContent,
}: LinkedNotesGraphProps) {
    const { accentColor, theme } = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number>();
    const nodesRef = useRef<GraphNode[]>([]);
    const edgesRef = useRef<GraphEdge[]>([]);

    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [draggedNode, setDraggedNode] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [animationProgress, setAnimationProgress] = useState(0);
    const [revealedCount, setRevealedCount] = useState(0);

    // Build graph data from workspace files
    const buildGraph = useCallback(async () => {
        setIsLoading(true);
        setAnimationProgress(0);
        setRevealedCount(0);

        const graphNodes: GraphNode[] = [];
        const graphEdges: GraphEdge[] = [];
        const connectionCount: Record<string, number> = {};

        console.log(`[Graph] Building graph with ${workspaceFiles.length} files`);
        console.log(`[Graph] Available files:`, workspaceFiles.map(f => f.name));

        // Initialize connection counts
        workspaceFiles.forEach(file => {
            connectionCount[file.id] = 0;
        });

        // Parse all files for mentions
        for (const file of workspaceFiles) {
            try {
                const content = await getFileContent(file.id);
                console.log(`[Graph] File "${file.name}" content:`, content ? `"${content.substring(0, 150)}..."` : '(empty)');
                if (content && content.trim()) {
                    const mentions = parseMentions(content, workspaceFiles);
                    console.log(`[Graph] File "${file.name}" parsed mentions:`, mentions.map(m => ({
                        noteName: m.noteName,
                        linkedFile: m.linkedFile?.name || 'NOT FOUND'
                    })));
                    mentions.forEach(mention => {
                        if (mention.linkedFile) {
                            // Avoid duplicate edges
                            const edgeExists = graphEdges.some(
                                e => (e.source === file.id && e.target === mention.linkedFile!.id) ||
                                    (e.source === mention.linkedFile!.id && e.target === file.id)
                            );
                            if (!edgeExists) {
                                graphEdges.push({
                                    source: file.id,
                                    target: mention.linkedFile.id,
                                    animated: false,
                                });
                                connectionCount[file.id]++;
                                connectionCount[mention.linkedFile.id]++;
                            }
                        }
                    });
                }
            } catch (e) {
                console.error(`[Graph] Error loading file "${file.name}":`, e);
            }
        }

        console.log(`[Graph] Total edges:`, graphEdges.length);

        // Create nodes with random initial positions
        const centerX = 400;
        const centerY = 300;
        const radius = 250;

        workspaceFiles.forEach((file, index) => {
            const angle = (index / workspaceFiles.length) * Math.PI * 2;
            const r = radius * (0.5 + Math.random() * 0.5);

            graphNodes.push({
                id: file.id,
                name: file.name,
                type: file.type,
                x: centerX + Math.cos(angle) * r,
                y: centerY + Math.sin(angle) * r,
                vx: 0,
                vy: 0,
                connections: connectionCount[file.id] || 0,
                isHovered: false,
                isDragging: false,
                revealOrder: -1,  // Not yet assigned
                opacity: 0,       // Start invisible
            });
        });

        // Calculate reveal order - start with most connected node, then spread through connections
        const revealOrder: string[] = [];
        const revealed = new Set<string>();

        // Sort nodes by connection count (descending) to find starting node
        const sortedByConnections = [...graphNodes].sort((a, b) => b.connections - a.connections);

        // Start with the most connected node (or first node if none have connections)
        if (sortedByConnections.length > 0) {
            const startNode = sortedByConnections[0];
            revealOrder.push(startNode.id);
            revealed.add(startNode.id);

            // BFS to reveal connected nodes
            let queue = [startNode.id];
            while (queue.length > 0 && revealed.size < graphNodes.length) {
                const nextQueue: string[] = [];

                for (const nodeId of queue) {
                    // Find all connected nodes
                    const connectedIds = graphEdges
                        .filter(e => e.source === nodeId || e.target === nodeId)
                        .map(e => e.source === nodeId ? e.target : e.source)
                        .filter(id => !revealed.has(id));

                    // Sort connected nodes by their connection count (most connected first)
                    const connectedNodes = connectedIds
                        .map(id => graphNodes.find(n => n.id === id)!)
                        .filter(Boolean)
                        .sort((a, b) => b.connections - a.connections);

                    for (const node of connectedNodes) {
                        if (!revealed.has(node.id)) {
                            revealOrder.push(node.id);
                            revealed.add(node.id);
                            nextQueue.push(node.id);
                        }
                    }
                }

                queue = nextQueue;
            }

            // Add any remaining unconnected nodes at the end
            for (const node of sortedByConnections) {
                if (!revealed.has(node.id)) {
                    revealOrder.push(node.id);
                    revealed.add(node.id);
                }
            }
        }

        // Assign reveal order to nodes
        revealOrder.forEach((nodeId, index) => {
            const node = graphNodes.find(n => n.id === nodeId);
            if (node) {
                node.revealOrder = index;
            }
        });

        nodesRef.current = graphNodes;
        edgesRef.current = graphEdges;
        setNodes(graphNodes);
        setEdges(graphEdges);
        setIsLoading(false);

        // Start the cascading reveal animation
        setRevealedCount(0);
        setAnimationProgress(0);
    }, [workspaceFiles, getFileContent]);

    // Cascading reveal animation
    useEffect(() => {
        if (isLoading || nodes.length === 0) return;

        const revealInterval = setInterval(() => {
            setRevealedCount(prev => {
                const next = prev + 1;
                if (next > nodes.length) {
                    clearInterval(revealInterval);
                    return prev;
                }
                return next;
            });
        }, 150); // Reveal a new node every 150ms

        return () => clearInterval(revealInterval);
    }, [isLoading, nodes.length]);

    // Update node opacities based on reveal count
    useEffect(() => {
        nodesRef.current.forEach(node => {
            if (node.revealOrder < revealedCount) {
                // Smoothly fade in
                node.opacity = Math.min(1, node.opacity + 0.15);
            }
        });

        // Update animation progress for edges
        if (nodes.length > 0) {
            setAnimationProgress(Math.min(1, revealedCount / nodes.length));
        }
    }, [revealedCount, nodes.length]);

    // Initialize graph when opened
    useEffect(() => {
        if (isOpen) {
            buildGraph();
        }
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isOpen, buildGraph]);

    // Force simulation
    useEffect(() => {
        if (!isOpen || isLoading) return;

        const simulate = () => {
            const nodes = nodesRef.current;
            const edges = edgesRef.current;
            const canvas = canvasRef.current;
            if (!canvas) return;

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            // Apply forces
            nodes.forEach((node, i) => {
                if (node.isDragging) return;

                let fx = 0;
                let fy = 0;

                // Repulsion from other nodes
                nodes.forEach((other, j) => {
                    if (i === j) return;
                    const dx = node.x - other.x;
                    const dy = node.y - other.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = REPULSION_STRENGTH / (dist * dist);
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                });

                // Attraction along edges
                edges.forEach(edge => {
                    let other: GraphNode | undefined;
                    if (edge.source === node.id) {
                        other = nodes.find(n => n.id === edge.target);
                    } else if (edge.target === node.id) {
                        other = nodes.find(n => n.id === edge.source);
                    }
                    if (other) {
                        const dx = other.x - node.x;
                        const dy = other.y - node.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > MIN_DISTANCE) {
                            fx += dx * ATTRACTION_STRENGTH;
                            fy += dy * ATTRACTION_STRENGTH;
                        }
                    }
                });

                // Center gravity
                fx += (centerX - node.x) * CENTER_GRAVITY;
                fy += (centerY - node.y) * CENTER_GRAVITY;

                // Update velocity with damping
                node.vx = (node.vx + fx) * DAMPING;
                node.vy = (node.vy + fy) * DAMPING;

                // Clamp velocity to prevent wild oscillations
                const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
                if (speed > MAX_VELOCITY) {
                    node.vx = (node.vx / speed) * MAX_VELOCITY;
                    node.vy = (node.vy / speed) * MAX_VELOCITY;
                }

                // Stop very small movements to let the graph settle
                if (Math.abs(node.vx) < VELOCITY_THRESHOLD) node.vx = 0;
                if (Math.abs(node.vy) < VELOCITY_THRESHOLD) node.vy = 0;

                // Update position
                node.x += node.vx;
                node.y += node.vy;
            });

            setNodes([...nodes]);
            animationRef.current = requestAnimationFrame(simulate);
        };

        animationRef.current = requestAnimationFrame(simulate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isOpen, isLoading]);

    // Draw graph on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const container = containerRef.current;
        if (container) {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        }

        // Clear canvas
        ctx.fillStyle = theme === 'dark' ? '#111827' : '#f9fafb';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(pan.x + canvas.width / 2, pan.y + canvas.height / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);

        // Draw edges - only between revealed nodes
        edges.forEach((edge) => {
            const source = nodes.find(n => n.id === edge.source);
            const target = nodes.find(n => n.id === edge.target);
            if (!source || !target) return;

            // Only draw edge if both nodes are revealed
            if (source.revealOrder >= revealedCount || target.revealOrder >= revealedCount) return;

            // Edge opacity based on the later-revealed node's opacity
            const edgeOpacity = Math.min(source.opacity, target.opacity);
            if (edgeOpacity <= 0) return;

            const isHighlighted = hoveredNode === source.id || hoveredNode === target.id;

            ctx.globalAlpha = edgeOpacity;
            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            ctx.strokeStyle = isHighlighted
                ? accentColor
                : theme === 'dark' ? 'rgba(156, 163, 175, 0.3)' : 'rgba(107, 114, 128, 0.3)';
            ctx.lineWidth = isHighlighted ? 2 : 1;
            ctx.stroke();
            ctx.globalAlpha = 1;
        });

        // Draw nodes - only show revealed nodes with their opacity
        nodes.forEach((node) => {
            // Skip nodes that haven't been revealed yet
            if (node.revealOrder >= revealedCount) return;

            // Smoothly update opacity
            const targetOpacity = 1;
            node.opacity = Math.min(targetOpacity, node.opacity + 0.08);

            if (node.opacity <= 0) return;

            const isHighlighted = hoveredNode === node.id;
            const isConnected = hoveredNode && edges.some(
                e => (e.source === hoveredNode && e.target === node.id) ||
                    (e.target === hoveredNode && e.source === node.id)
            );
            const isDimmed = hoveredNode && !isHighlighted && !isConnected;

            // Node size based on connections, scaled by opacity for pop-in effect
            const baseSize = 8 + Math.min(node.connections * 2, 12);
            const scaleEffect = 0.5 + (node.opacity * 0.5); // Scale from 50% to 100%
            const size = baseSize * scaleEffect * (isHighlighted ? 1.3 : 1);

            ctx.globalAlpha = node.opacity;

            // Draw node glow
            if (isHighlighted && node.opacity > 0.5) {
                const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size * 2);
                gradient.addColorStop(0, `${accentColor}40`);
                gradient.addColorStop(1, 'transparent');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(node.x, node.y, size * 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
            ctx.fillStyle = isDimmed
                ? (theme === 'dark' ? 'rgba(75, 85, 99, 0.5)' : 'rgba(156, 163, 175, 0.5)')
                : isHighlighted || isConnected
                    ? accentColor
                    : theme === 'dark' ? '#6b7280' : '#9ca3af';
            ctx.fill();

            // Draw node border
            ctx.strokeStyle = theme === 'dark' ? '#1f2937' : '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw label
            if ((isHighlighted || zoom > 0.7) && node.opacity > 0.5) {
                ctx.font = `${isHighlighted ? 'bold ' : ''}${12 / zoom}px Inter, sans-serif`;
                ctx.fillStyle = isDimmed
                    ? (theme === 'dark' ? 'rgba(156, 163, 175, 0.5)' : 'rgba(107, 114, 128, 0.5)')
                    : theme === 'dark' ? '#e5e7eb' : '#374151';
                ctx.textAlign = 'center';
                ctx.fillText(node.name, node.x, node.y + size + 14);
            }

            ctx.globalAlpha = 1;
        });

        ctx.restore();
    }, [nodes, edges, zoom, pan, hoveredNode, animationProgress, accentColor, theme, revealedCount]);


    // Mouse event handlers
    const getMousePos = useCallback((e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - pan.x - canvas.width / 2) / zoom + canvas.width / 2;
        const y = (e.clientY - rect.top - pan.y - canvas.height / 2) / zoom + canvas.height / 2;
        return { x, y };
    }, [zoom, pan]);

    const findNodeAtPos = useCallback((pos: { x: number; y: number }) => {
        // Only find nodes that have been revealed
        return nodes.find(node => {
            if (node.revealOrder >= revealedCount || node.opacity < 0.3) return false;
            const size = 8 + Math.min(node.connections * 2, 12);
            const dx = node.x - pos.x;
            const dy = node.y - pos.y;
            return Math.sqrt(dx * dx + dy * dy) < size + 5;
        });
    }, [nodes, revealedCount]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const pos = getMousePos(e);
        const node = findNodeAtPos(pos);

        if (node) {
            setDraggedNode(node.id);
            const nodeRef = nodesRef.current.find(n => n.id === node.id);
            if (nodeRef) {
                nodeRef.isDragging = true;
            }
        } else {
            setIsPanning(true);
        }
        setLastMousePos({ x: e.clientX, y: e.clientY });
    }, [getMousePos, findNodeAtPos]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const pos = getMousePos(e);

        if (draggedNode) {
            const node = nodesRef.current.find(n => n.id === draggedNode);
            if (node) {
                node.x = pos.x;
                node.y = pos.y;
                node.vx = 0;
                node.vy = 0;
            }
        } else if (isPanning) {
            setPan(prev => ({
                x: prev.x + e.clientX - lastMousePos.x,
                y: prev.y + e.clientY - lastMousePos.y,
            }));
            setLastMousePos({ x: e.clientX, y: e.clientY });
        } else {
            const node = findNodeAtPos(pos);
            setHoveredNode(node?.id || null);
        }
    }, [draggedNode, isPanning, lastMousePos, getMousePos, findNodeAtPos]);

    const handleMouseUp = useCallback(() => {
        if (draggedNode) {
            const node = nodesRef.current.find(n => n.id === draggedNode);
            if (node) {
                node.isDragging = false;
            }
        }
        setDraggedNode(null);
        setIsPanning(false);
    }, [draggedNode]);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        const pos = getMousePos(e);
        const node = findNodeAtPos(pos);
        if (node) {
            onNavigateToFile(node.id);
            onClose();
        }
    }, [getMousePos, findNodeAtPos, onNavigateToFile, onClose]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(prev => Math.max(0.2, Math.min(3, prev * delta)));
    }, []);

    // Resize handler
    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (canvas && container) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const resetView = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    // Stats
    const stats = useMemo(() => ({
        totalNodes: nodes.length,
        totalEdges: edges.length,
        connectedNodes: nodes.filter(n => n.connections > 0).length,
    }), [nodes, edges]);

    if (!isOpen) return null;


    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className={clsx(
                        "relative w-[90vw] h-[85vh] rounded-2xl overflow-hidden",
                        "bg-gray-50 dark:bg-gray-900",
                        "border border-gray-200 dark:border-gray-700",
                        "shadow-2xl"
                    )}
                >
                    {/* Header */}
                    <div className={clsx(
                        "absolute top-0 left-0 right-0 z-10",
                        "flex items-center justify-between px-6 py-4",
                        "bg-gradient-to-b from-gray-50 dark:from-gray-900 to-transparent"
                    )}>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                Linked Notes Graph
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {stats.totalNodes} files • {stats.totalEdges} connections • {stats.connectedNodes} linked
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setZoom(z => Math.min(3, z * 1.2))}
                                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                                title="Zoom In"
                            >
                                <ZoomIn className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setZoom(z => Math.max(0.2, z * 0.8))}
                                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                                title="Zoom Out"
                            >
                                <ZoomOut className="w-5 h-5" />
                            </button>
                            <button
                                onClick={resetView}
                                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                                title="Reset View"
                            >
                                <Maximize2 className="w-5 h-5" />
                            </button>
                            <button
                                onClick={buildGraph}
                                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                                title="Refresh Graph"
                            >
                                <RefreshCw className="w-5 h-5" />
                            </button>
                            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                                title="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Canvas */}
                    <div ref={containerRef} className="w-full h-full">
                        <canvas
                            ref={canvasRef}
                            className={clsx(
                                "w-full h-full",
                                draggedNode ? "cursor-grabbing" : hoveredNode ? "cursor-pointer" : "cursor-grab"
                            )}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onDoubleClick={handleDoubleClick}
                            onWheel={handleWheel}
                        />
                    </div>

                    {/* Loading overlay */}
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 dark:bg-gray-900/80">
                            <div className="flex flex-col items-center gap-3">
                                <div
                                    className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                                    style={{ borderColor: accentColor, borderTopColor: 'transparent' }}
                                />
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    Building graph...
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Hovered node info */}
                    {hoveredNode && !draggedNode && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={clsx(
                                "absolute bottom-6 left-6 px-4 py-3 rounded-xl",
                                "bg-white dark:bg-gray-800",
                                "border border-gray-200 dark:border-gray-700",
                                "shadow-lg"
                            )}
                        >
                            {(() => {
                                const node = nodes.find(n => n.id === hoveredNode);
                                if (!node) return null;
                                const Icon = getFileIcon(node.type);
                                return (
                                    <div className="flex items-center gap-3">
                                        <Icon className="w-5 h-5" style={{ color: accentColor }} />
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-white">
                                                {node.name}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {node.connections} connection{node.connections !== 1 ? 's' : ''} • Double-click to open
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </motion.div>
                    )}

                    {/* Legend */}
                    <div className={clsx(
                        "absolute bottom-6 right-6 px-4 py-3 rounded-xl",
                        "bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm",
                        "border border-gray-200 dark:border-gray-700",
                        "text-xs text-gray-500 dark:text-gray-400"
                    )}>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <FileCode className="w-3.5 h-3.5" />
                                <span>Notebook</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <PenTool className="w-3.5 h-3.5" />
                                <span>Board</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5" />
                                <span>Note</span>
                            </div>
                        </div>
                    </div>

                    {/* Zoom indicator */}
                    <div className={clsx(
                        "absolute top-20 right-6 px-3 py-1.5 rounded-lg",
                        "bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm",
                        "border border-gray-200 dark:border-gray-700",
                        "text-sm text-gray-600 dark:text-gray-300"
                    )}>
                        {Math.round(zoom * 100)}%
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
