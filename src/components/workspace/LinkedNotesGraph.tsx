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
const REPULSION_STRENGTH = 15000;      // Massive repulsion for huge spacing
const ATTRACTION_STRENGTH = 0.003;     // Very weak attraction
const DAMPING = 0.75;                  // More damping to settle faster
const CENTER_GRAVITY = 0.002;          // Base gravity (will be modified by connections)
const MIN_DISTANCE = 500;              // Very large minimum distance
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
    const [filterType, setFilterType] = useState<FileType | null>(null); // null = show all
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

                // Center gravity - stronger for nodes with more connections
                const connectionMultiplier = 1 + (node.connections * 0.8); // More connections = stronger pull to center
                fx += (centerX - node.x) * CENTER_GRAVITY * connectionMultiplier;
                fy += (centerY - node.y) * CENTER_GRAVITY * connectionMultiplier;

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

        // Clear canvas with background
        ctx.fillStyle = theme === 'dark' ? '#0f1419' : '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw infinite grid pattern (before transform so it scales with zoom)
        ctx.save();

        // Grid settings
        const baseGridSize = 40;
        const gridSize = baseGridSize * zoom;
        const gridColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.3)' : 'rgba(203, 213, 225, 0.5)';
        const majorGridColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(148, 163, 184, 0.4)';

        // Calculate grid offset based on pan
        const offsetX = (pan.x % gridSize + gridSize) % gridSize;
        const offsetY = (pan.y % gridSize + gridSize) % gridSize;

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;

        // Draw vertical lines
        for (let x = offsetX; x < canvas.width; x += gridSize) {
            const worldX = (x - pan.x - canvas.width / 2) / zoom;
            const isMajor = Math.abs(Math.round(worldX / baseGridSize) % 5) === 0;
            ctx.strokeStyle = isMajor ? majorGridColor : gridColor;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = offsetY; y < canvas.height; y += gridSize) {
            const worldY = (y - pan.y - canvas.height / 2) / zoom;
            const isMajor = Math.abs(Math.round(worldY / baseGridSize) % 5) === 0;
            ctx.strokeStyle = isMajor ? majorGridColor : gridColor;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        ctx.restore();

        // Apply transform for nodes and edges
        ctx.save();
        ctx.translate(pan.x + canvas.width / 2, pan.y + canvas.height / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);

        // Draw edges FIRST (so they appear under nodes)
        edges.forEach((edge) => {
            const source = nodes.find(n => n.id === edge.source);
            const target = nodes.find(n => n.id === edge.target);
            if (!source || !target) return;

            // Only draw edge if both nodes are revealed
            if (source.revealOrder >= revealedCount || target.revealOrder >= revealedCount) return;

            // Check if edge involves filtered-out nodes
            const isEdgeFiltered = filterType !== null &&
                (source.type !== filterType || target.type !== filterType);

            // Edge opacity based on the later-revealed node's opacity
            let edgeOpacity = Math.min(source.opacity, target.opacity);
            if (isEdgeFiltered) edgeOpacity *= 0.2; // Dim filtered edges
            if (edgeOpacity <= 0) return;

            const isHighlighted = hoveredNode === source.id || hoveredNode === target.id;

            ctx.globalAlpha = edgeOpacity;
            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            ctx.strokeStyle = isHighlighted && !isEdgeFiltered
                ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.35)')
                : theme === 'dark' ? 'rgba(156, 163, 175, 0.4)' : 'rgba(107, 114, 128, 0.4)';
            ctx.lineWidth = isHighlighted && !isEdgeFiltered ? 2.5 : 1.5;
            ctx.stroke();
            ctx.globalAlpha = 1;
        });

        // Draw nodes AFTER edges (so nodes appear on top)
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
            const isDimmedByHover = hoveredNode && !isHighlighted && !isConnected;

            // Check if this node is filtered out by type filter
            const isFilteredOut = filterType !== null && node.type !== filterType;
            const isDimmed = isDimmedByHover || isFilteredOut;

            // Get the file type color for this node
            const nodeColor = getFileTypeColor(node.type);

            // Icon size based on connections, scaled by opacity for pop-in effect
            const baseSize = 24 + Math.min(node.connections * 4, 16); // 30% larger
            const scaleEffect = 0.5 + (node.opacity * 0.5);
            const size = baseSize * scaleEffect * (isHighlighted ? 1.2 : 1);

            ctx.globalAlpha = node.opacity * (isFilteredOut ? 0.3 : 1);

            // Draw glow for highlighted nodes
            if (isHighlighted && node.opacity > 0.5 && !isFilteredOut) {
                const glowGradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size * 1.5);
                glowGradient.addColorStop(0, `${nodeColor}40`);
                glowGradient.addColorStop(0.6, `${nodeColor}15`);
                glowGradient.addColorStop(1, 'transparent');
                ctx.fillStyle = glowGradient;
                ctx.beginPath();
                ctx.arc(node.x, node.y, size * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw file type icon
            const iconColor = isFilteredOut
                ? (theme === 'dark' ? '#4b5563' : '#9ca3af')
                : isDimmed
                    ? (theme === 'dark' ? '#6b7280' : '#9ca3af')
                    : nodeColor;

            ctx.strokeStyle = iconColor;
            ctx.fillStyle = iconColor;
            ctx.lineWidth = isHighlighted ? 2.5 : 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const halfSize = size / 2;
            const iconOffsetY = -size * 0.2; // Move icons up by 20%

            // Draw different icons based on file type
            if (node.type === 'exec') {
                // FileCode icon - document with code brackets
                const x = node.x - halfSize;
                const y = node.y - halfSize + iconOffsetY;
                const w = size;
                const h = size;

                // Document outline
                ctx.beginPath();
                ctx.moveTo(x + w * 0.15, y + h * 0.05);
                ctx.lineTo(x + w * 0.6, y + h * 0.05);
                ctx.lineTo(x + w * 0.85, y + h * 0.2);
                ctx.lineTo(x + w * 0.85, y + h * 0.95);
                ctx.lineTo(x + w * 0.15, y + h * 0.95);
                ctx.closePath();
                ctx.stroke();

                // Code brackets < >
                ctx.beginPath();
                ctx.moveTo(x + w * 0.42, y + h * 0.4);
                ctx.lineTo(x + w * 0.28, y + h * 0.55);
                ctx.lineTo(x + w * 0.42, y + h * 0.7);
                ctx.moveTo(x + w * 0.58, y + h * 0.4);
                ctx.lineTo(x + w * 0.72, y + h * 0.55);
                ctx.lineTo(x + w * 0.58, y + h * 0.7);
                ctx.stroke();

            } else if (node.type === 'board') {
                // PenTool icon - pen/stylus
                const x = node.x - halfSize;
                const y = node.y - halfSize + iconOffsetY;
                const w = size;
                const h = size;

                ctx.beginPath();
                // Pen body (diagonal rectangle)
                ctx.moveTo(x + w * 0.7, y + h * 0.1);
                ctx.lineTo(x + w * 0.9, y + h * 0.3);
                ctx.lineTo(x + w * 0.35, y + h * 0.85);
                ctx.lineTo(x + w * 0.15, y + h * 0.65);
                ctx.closePath();
                ctx.stroke();

                // Pen tip
                ctx.beginPath();
                ctx.moveTo(x + w * 0.15, y + h * 0.65);
                ctx.lineTo(x + w * 0.35, y + h * 0.85);
                ctx.lineTo(x + w * 0.1, y + h * 0.95);
                ctx.closePath();
                ctx.stroke();

            } else {
                // FileText icon - document with lines (for notes)
                const x = node.x - halfSize;
                const y = node.y - halfSize + iconOffsetY;
                const w = size;
                const h = size;

                // Document outline
                ctx.beginPath();
                ctx.moveTo(x + w * 0.15, y + h * 0.05);
                ctx.lineTo(x + w * 0.6, y + h * 0.05);
                ctx.lineTo(x + w * 0.85, y + h * 0.2);
                ctx.lineTo(x + w * 0.85, y + h * 0.95);
                ctx.lineTo(x + w * 0.15, y + h * 0.95);
                ctx.closePath();
                ctx.stroke();

                // Text lines
                ctx.beginPath();
                ctx.moveTo(x + w * 0.28, y + h * 0.4);
                ctx.lineTo(x + w * 0.72, y + h * 0.4);
                ctx.moveTo(x + w * 0.28, y + h * 0.55);
                ctx.lineTo(x + w * 0.72, y + h * 0.55);
                ctx.moveTo(x + w * 0.28, y + h * 0.7);
                ctx.lineTo(x + w * 0.55, y + h * 0.7);
                ctx.stroke();
            }

            // Draw label
            if ((isHighlighted || zoom > 0.7) && node.opacity > 0.5) {
                ctx.font = `${isHighlighted ? 'bold ' : ''}${12 / zoom}px Inter, sans-serif`;
                ctx.textAlign = 'center';

                // Measure text for highlight background
                const textMetrics = ctx.measureText(node.name);
                const textWidth = textMetrics.width;
                const textHeight = 14 / zoom;
                const textX = node.x;
                const textY = node.y + halfSize + 13;

                // Draw rotated highlight rectangle behind text
                if (!isDimmed && !isFilteredOut) {
                    const highlightColor = theme === 'dark' ? 'rgba(217, 169, 99, 0.25)' : 'rgba(237, 189, 119, 0.35)';
                    const paddingX = 6 / zoom;
                    const paddingY = 4 / zoom;
                    const rectWidth = textWidth + paddingX * 2;
                    const rectHeight = textHeight + paddingY * 2;
                    const cornerRadius = 3 / zoom;

                    ctx.save();
                    ctx.translate(textX, textY - textHeight / 2 + 2);
                    ctx.rotate(-5 * Math.PI / 180); // Rotate -10 degrees (anti-clockwise)

                    // Draw rounded rectangle
                    ctx.fillStyle = highlightColor;
                    ctx.beginPath();
                    const rx = -rectWidth / 2;
                    const ry = -rectHeight / 2;
                    ctx.moveTo(rx + cornerRadius, ry);
                    ctx.lineTo(rx + rectWidth - cornerRadius, ry);
                    ctx.quadraticCurveTo(rx + rectWidth, ry, rx + rectWidth, ry + cornerRadius);
                    ctx.lineTo(rx + rectWidth, ry + rectHeight - cornerRadius);
                    ctx.quadraticCurveTo(rx + rectWidth, ry + rectHeight, rx + rectWidth - cornerRadius, ry + rectHeight);
                    ctx.lineTo(rx + cornerRadius, ry + rectHeight);
                    ctx.quadraticCurveTo(rx, ry + rectHeight, rx, ry + rectHeight - cornerRadius);
                    ctx.lineTo(rx, ry + cornerRadius);
                    ctx.quadraticCurveTo(rx, ry, rx + cornerRadius, ry);
                    ctx.closePath();
                    ctx.fill();

                    ctx.restore();
                }

                // Main text (drawn after highlight, not rotated)
                ctx.fillStyle = isDimmed || isFilteredOut
                    ? (theme === 'dark' ? 'rgba(156, 163, 175, 0.5)' : 'rgba(107, 114, 128, 0.5)')
                    : theme === 'dark' ? '#f3f4f6' : '#1f2937';
                ctx.fillText(node.name, textX, textY);
            }

            ctx.globalAlpha = 1;
        });

        ctx.restore();
    }, [nodes, edges, zoom, pan, hoveredNode, animationProgress, accentColor, theme, revealedCount, filterType]);


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

    // Count nodes by type
    const typeCounts = useMemo(() => ({
        exec: nodes.filter(n => n.type === 'exec').length,
        board: nodes.filter(n => n.type === 'board').length,
        note: nodes.filter(n => n.type === 'note').length,
    }), [nodes]);

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
                                const nodeColor = getFileTypeColor(node.type);
                                return (
                                    <div className="flex items-center gap-3">
                                        <Icon className="w-5 h-5" style={{ color: nodeColor }} />
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

                    {/* Legend - Clickable to filter */}
                    <div className={clsx(
                        "absolute bottom-6 right-6 px-4 py-3 rounded-xl",
                        "bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm",
                        "border border-gray-200 dark:border-gray-700",
                        "text-xs shadow-lg"
                    )}>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setFilterType(filterType === 'exec' ? null : 'exec')}
                                className={clsx(
                                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all",
                                    filterType === 'exec'
                                        ? "bg-blue-500/20 ring-2 ring-blue-500/50"
                                        : filterType !== null
                                            ? "opacity-40 hover:opacity-70"
                                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                                )}
                                title="Click to filter notebooks"
                            >
                                <span className="font-semibold min-w-[1rem] text-center" style={{ color: '#3b82f6' }}>{typeCounts.exec}</span>
                                <FileCode className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
                                <span style={{ color: '#3b82f6' }}>Notebook</span>
                            </button>
                            <button
                                onClick={() => setFilterType(filterType === 'board' ? null : 'board')}
                                className={clsx(
                                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all",
                                    filterType === 'board'
                                        ? "bg-purple-500/20 ring-2 ring-purple-500/50"
                                        : filterType !== null
                                            ? "opacity-40 hover:opacity-70"
                                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                                )}
                                title="Click to filter boards"
                            >
                                <span className="font-semibold min-w-[1rem] text-center" style={{ color: '#a855f7' }}>{typeCounts.board}</span>
                                <PenTool className="w-3.5 h-3.5" style={{ color: '#a855f7' }} />
                                <span style={{ color: '#a855f7' }}>Board</span>
                            </button>
                            <button
                                onClick={() => setFilterType(filterType === 'note' ? null : 'note')}
                                className={clsx(
                                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all",
                                    filterType === 'note'
                                        ? "bg-green-500/20 ring-2 ring-green-500/50"
                                        : filterType !== null
                                            ? "opacity-40 hover:opacity-70"
                                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                                )}
                                title="Click to filter notes"
                            >
                                <span className="font-semibold min-w-[1rem] text-center" style={{ color: '#22c55e' }}>{typeCounts.note}</span>
                                <FileText className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                                <span style={{ color: '#22c55e' }}>Note</span>
                            </button>
                        </div>
                        {filterType && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-center">
                                <span className="text-gray-500 dark:text-gray-400">
                                    Filtering: {filterType === 'exec' ? 'Notebooks' : filterType === 'board' ? 'Boards' : 'Notes'}
                                </span>
                            </div>
                        )}
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
