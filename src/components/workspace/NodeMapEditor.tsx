import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap,
    Box,
    GitBranch,
    CheckCircle,
    Cpu,
    Search,
    Trash2,
    MousePointer2,
    Copy,
} from 'lucide-react';
import clsx from 'clsx';

// --- Types ---

type NodeType = 'trigger' | 'action' | 'condition' | 'output' | 'agent' | 'note';

interface NodeData {
    id: string;
    type: NodeType;
    label: string;
    description?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    inputs: string[];
    outputs: string[];
    data?: any;
    color?: string;
}

interface EdgeData {
    id: string;
    source: string;
    target: string;
}

interface NodeMapData {
    nodes: NodeData[];
    edges: EdgeData[];
    viewport: { x: number; y: number; zoom: number };
}

interface NodeMapEditorProps {
    contentId: string;
    filePath?: string;
    initialContent?: string;
    onSave?: (content: string) => void;
}

// --- Constants & Presets ---

const NODE_TYPES: Record<NodeType, { label: string; color: string; solidColor: string; icon: any; description: string }> = {
    trigger: {
        label: 'Trigger',
        color: 'from-emerald-400 to-emerald-600',
        solidColor: '#10b981',
        icon: Zap,
        description: 'Starts a workflow (e.g., On Click, On Time)'
    },
    action: {
        label: 'Action',
        color: 'from-blue-400 to-blue-600',
        solidColor: '#3b82f6',
        icon: Box,
        description: 'Performs a task or operation'
    },
    condition: {
        label: 'Condition',
        color: 'from-amber-400 to-amber-600',
        solidColor: '#f59e0b',
        icon: GitBranch,
        description: 'Splits flow based on logic'
    },
    output: {
        label: 'Output',
        color: 'from-purple-400 to-purple-600',
        solidColor: '#a855f7',
        icon: CheckCircle,
        description: 'Final result or exit point'
    },
    agent: {
        label: 'Agent',
        color: 'from-rose-400 to-rose-600',
        solidColor: '#f43f5e',
        icon: Cpu,
        description: 'AI Agent or complex subprocess'
    },
    note: {
        label: 'Note',
        color: 'from-gray-400 to-gray-600',
        solidColor: '#6b7280',
        icon: MousePointer2,
        description: 'Annotation or comment'
    }
};

const INITIAL_DATA: NodeMapData = {
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
};

// --- Optimized Connection Line Component ---
const ConnectionLine = React.memo(({
    start,
    end,
    gradientId,
    onContextMenu
}: {
    start: { x: number; y: number };
    end: { x: number; y: number };
    gradientId?: string;
    onContextMenu?: (e: React.MouseEvent) => void;
}) => {
    const deltaX = Math.abs(end.x - start.x);
    const controlPointOffset = Math.max(deltaX * 0.5, 50);
    const path = `M ${start.x} ${start.y} C ${start.x + controlPointOffset} ${start.y}, ${end.x - controlPointOffset} ${end.y}, ${end.x} ${end.y}`;

    return (
        <path
            d={path}
            fill="none"
            stroke={gradientId ? `url(#${gradientId})` : "url(#gradient-line)"}
            strokeWidth="3"
            strokeLinecap="round"
            className="opacity-60 transition-opacity duration-150 hover:opacity-100 cursor-pointer"
            style={{ pointerEvents: onContextMenu ? 'stroke' : 'none' }}
            onContextMenu={onContextMenu}
        />
    );
});

ConnectionLine.displayName = 'ConnectionLine';

// --- Optimized Node Component ---
const Node = React.memo(({
    node,
    isSelected,
    isPotentialTarget,
    edges,
    onMouseDown,
    onMouseUp,
    onContextMenu,
    onStartConnection,
    onLabelChange,
    onDeleteConnections
}: {
    node: NodeData;
    isSelected: boolean;
    isPotentialTarget: boolean;
    edges: EdgeData[];
    onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
    onMouseUp: (e: React.MouseEvent, nodeId: string) => void;
    onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
    onStartConnection: (e: React.MouseEvent, nodeId: string) => void;
    onLabelChange: (nodeId: string, label: string) => void;
    onDeleteConnections: (nodeId: string, isOutput: boolean, x: number, y: number, count: number) => void;
}) => {
    const TypeIcon = NODE_TYPES[node.type].icon;

    // Find connections for this node
    const outputConnections = edges.filter(e => e.source === node.id);
    const inputConnections = edges.filter(e => e.target === node.id);

    const handlePortContextMenu = (e: React.MouseEvent, isOutput: boolean) => {
        e.preventDefault();
        e.stopPropagation();

        const connections = isOutput ? outputConnections : inputConnections;
        if (connections.length > 0) {
            onDeleteConnections(node.id, isOutput, e.clientX, e.clientY, connections.length);
        }
    };

    return (
        <motion.div
            key={node.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
                scale: isPotentialTarget ? 1.05 : 1,
                opacity: 1,
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={clsx(
                "absolute rounded-2xl p-[2px] cursor-pointer",
                isSelected || isPotentialTarget ? "z-50" : "z-10"
            )}
            style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                boxShadow: isPotentialTarget
                    ? "0 0 0 2px #3b82f6, 0 10px 25px -5px rgba(0, 0, 0, 0.1)"
                    : isSelected
                        ? "0 0 0 3px rgba(0, 0, 0, 0.8), 0 10px 20px -3px rgba(0, 0, 0, 0.4)"
                        : "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
            }}
            onMouseDown={(e) => onMouseDown(e, node.id)}
            onMouseUp={(e) => onMouseUp(e, node.id)}
            onContextMenu={(e) => onContextMenu(e, node.id)}
        >
            <div className={clsx(
                "absolute inset-0 rounded-2xl bg-gradient-to-br opacity-80",
                NODE_TYPES[node.type].color
            )} />

            <div className="absolute inset-[2px] bg-[#111] rounded-[14px] flex items-center p-3 gap-3 select-none">
                <div className={clsx(
                    "w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br text-white shadow-lg",
                    NODE_TYPES[node.type].color
                )}>
                    <TypeIcon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <input
                        value={node.label}
                        onChange={(e) => onLabelChange(node.id, e.target.value)}
                        className="bg-transparent text-sm font-semibold text-gray-100 w-full outline-none placeholder-gray-500"
                        placeholder="Node Name"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="text-[10px] text-gray-500 truncate mt-0.5 font-medium tracking-wide uppercase">
                        {NODE_TYPES[node.type].label}
                    </div>
                </div>

                <div
                    className="w-4 h-4 rounded-full bg-gray-600 hover:bg-blue-400 cursor-crosshair ml-auto -mr-5 border-4 border-[#0a0a0a] transition-colors"
                    onMouseDown={(e) => onStartConnection(e, node.id)}
                    onContextMenu={(e) => handlePortContextMenu(e, true)}
                    title={outputConnections.length > 0 ? `${outputConnections.length} outgoing connection(s) - Right-click to delete` : 'Drag to connect'}
                />
            </div>

            <div
                className="absolute top-1/2 -left-3 w-4 h-4 rounded-full bg-gray-600 border-4 border-[#0a0a0a] -translate-y-1/2 hover:bg-blue-400 transition-colors cursor-pointer"
                onContextMenu={(e) => handlePortContextMenu(e, false)}
                title={inputConnections.length > 0 ? `${inputConnections.length} incoming connection(s) - Right-click to delete` : 'Input port'}
            />
        </motion.div>
    );
});

Node.displayName = 'Node';

// --- Main Editor Component ---
export function NodeMapEditor({ contentId, filePath, initialContent, onSave }: NodeMapEditorProps) {
    // State
    const [data, setData] = useState<NodeMapData>(() => {
        if (initialContent) {
            try {
                return JSON.parse(initialContent);
            } catch (e) {
                console.error("Failed to parse initial content", e);
                return INITIAL_DATA;
            }
        }
        return INITIAL_DATA;
    });

    const [isDraggingNode, setIsDraggingNode] = useState<string | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [connectingNode, setConnectingNode] = useState<string | null>(null);
    const [potentialTargetNode, setPotentialTargetNode] = useState<string | null>(null);
    const [connectionMousePos, setConnectionMousePos] = useState({ x: 0, y: 0 }); // For temp connection line
    const [showAddMenu, setShowAddMenu] = useState<{ x: number, y: number } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string | null } | null>(null);
    const [portMenu, setPortMenu] = useState<{ x: number; y: number; nodeId: string; isOutput: boolean; count: number } | null>(null);

    // Refs for performance - avoid state updates during drag/pan
    const containerRef = useRef<HTMLDivElement>(null);
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const mousePosRef = useRef({ x: 0, y: 0 }); // Canvas coordinates
    const isDraggingRef = useRef(false);
    const isPanningRef = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const currentFilePathRef = useRef<string | undefined>(filePath);

    // Update current file path ref when it changes
    useEffect(() => {
        currentFilePathRef.current = filePath;
    }, [filePath]);

    // Save callback - defined first so it can be used in effects
    const save = useCallback(async () => {
        // Don't save if we're currently loading or if file path doesn't match
        if (isLoading || !filePath || filePath !== currentFilePathRef.current) {
            console.log('Skipping save - loading or file path mismatch');
            return;
        }

        if (window.ipcRenderer) {
            try {
                setIsSaving(true);
                console.log('Saving NBM file:', filePath, 'Nodes:', data.nodes.length, 'Edges:', data.edges.length);
                const result = await window.ipcRenderer.invoke('save-workspace-file', {
                    filePath,
                    content: data  // Pass the object directly, not stringified
                });
                if (result.success) {
                    console.log('Save successful');
                } else {
                    console.error('Failed to save:', result.error);
                }
                setTimeout(() => setIsSaving(false), 500);
            } catch (e) {
                console.error('Save error:', e);
                setIsSaving(false);
            }
        }
        if (onSave) {
            onSave(JSON.stringify(data, null, 2));
        }
    }, [data, filePath, onSave, isLoading]);

    // Auto-save on data change (debounced)
    useEffect(() => {
        // Don't auto-save if we're loading or if there's no data
        if (isLoading || (!data.nodes.length && !data.edges.length)) {
            return;
        }

        const timer = setTimeout(() => {
            save();
        }, 300); // Auto-save after 300ms of inactivity (faster response)

        return () => clearTimeout(timer);
    }, [data, save, isLoading]);

    // Save functionality and keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                save();
            }
            if (e.key === 'Delete' && selectedNodes.size > 0) {
                deleteSelected();
            }
            if (e.key === 'Escape') {
                // Cancel connection or close add menu
                if (connectingNode) {
                    setConnectingNode(null);
                    setPotentialTargetNode(null);
                }
                if (showAddMenu) {
                    setShowAddMenu(null);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [data, onSave, selectedNodes, connectingNode, showAddMenu]);

    useEffect(() => {
        const closeMenu = () => setContextMenu(null);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    // Data Loading
    useEffect(() => {
        if (filePath && window.ipcRenderer) {
            const load = async () => {
                try {
                    setIsLoading(true);
                    console.log('Loading NBM file:', filePath);
                    const result = await window.ipcRenderer.invoke('load-workspace-file', filePath);
                    console.log('Load result:', result);
                    if (result && result.success && result.content) {
                        const content = result.content;
                        console.log('Loaded content - Nodes:', content.nodes?.length, 'Edges:', content.edges?.length);
                        if (content && Array.isArray(content.nodes)) {
                            setData(content);
                            currentFilePathRef.current = filePath;
                        }
                    } else {
                        console.error('Failed to load file:', result?.error);
                    }
                } catch (e) {
                    console.error('Error loading file:', e);
                } finally {
                    // Small delay to ensure state is settled before enabling auto-save
                    setTimeout(() => setIsLoading(false), 100);
                }
            };
            load();
        }
    }, [filePath, contentId]);

    // Optimized mouse position tracking using RAF
    const updateMousePosition = useCallback((clientX: number, clientY: number) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        mousePosRef.current = {
            x: (clientX - rect.left - data.viewport.x) / data.viewport.zoom,
            y: (clientY - rect.top - data.viewport.y) / data.viewport.zoom
        };
    }, [data.viewport.x, data.viewport.y, data.viewport.zoom]);

    // Event Handlers
    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const zoomSpeed = 0.001;
            const newZoom = Math.min(Math.max(0.1, data.viewport.zoom - e.deltaY * zoomSpeed), 3);
            setData(prev => ({
                ...prev,
                viewport: { ...prev.viewport, zoom: newZoom }
            }));
        } else {
            setData(prev => ({
                ...prev,
                viewport: {
                    ...prev.viewport,
                    x: prev.viewport.x - e.deltaX,
                    y: prev.viewport.y - e.deltaY
                }
            }));
        }
    }, [data.viewport.zoom]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            setIsPanning(true);
            isPanningRef.current = true;
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        } else if (e.button === 0 && e.target === containerRef.current) {
            setSelectedNodes(new Set());
            setShowAddMenu(null);
            setContextMenu(null);
        }
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        // The container is already transformed, so we just need to account for zoom
        // Don't subtract viewport.x/y as the rect already includes the transform
        const canvasX = (e.clientX - rect.left) / data.viewport.zoom;
        const canvasY = (e.clientY - rect.top) / data.viewport.zoom;

        // Update ref for other uses
        mousePosRef.current = { x: canvasX, y: canvasY };

        // Update connection line position if connecting - use the just-calculated position
        if (connectingNode) {
            setConnectionMousePos({ x: canvasX, y: canvasY });
        }

        if (isPanningRef.current) {
            const dx = e.clientX - lastMousePosRef.current.x;
            const dy = e.clientY - lastMousePosRef.current.y;
            setData(prev => ({
                ...prev,
                viewport: { ...prev.viewport, x: prev.viewport.x + dx, y: prev.viewport.y + dy }
            }));
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        }

        if (isDraggingRef.current && isDraggingNode) {
            const dx = (e.clientX - lastMousePosRef.current.x) / data.viewport.zoom;
            const dy = (e.clientY - lastMousePosRef.current.y) / data.viewport.zoom;

            setData(prev => ({
                ...prev,
                nodes: prev.nodes.map(n =>
                    n.id === isDraggingNode
                        ? { ...n, x: n.x + dx, y: n.y + dy }
                        : n
                )
            }));
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        }

        // Proximity check for connections - reduced sensitivity
        if (connectingNode) {
            let closestId: string | null = null;
            let minDistance = 80; // Reduced from 150 to 80 for less sensitive auto-connect

            data.nodes.forEach(node => {
                if (node.id === connectingNode) return;
                if (data.edges.some(edge =>
                    (edge.source === connectingNode && edge.target === node.id) ||
                    (edge.source === node.id && edge.target === connectingNode)
                )) return;

                const centerX = node.x + node.width / 2;
                const centerY = node.y + node.height / 2;
                const dist = Math.hypot(mousePosRef.current.x - centerX, mousePosRef.current.y - centerY);

                if (dist < minDistance) {
                    minDistance = dist;
                    closestId = node.id;
                }
            });

            if (closestId !== potentialTargetNode) {
                setPotentialTargetNode(closestId);
            }
        }
    }, [connectingNode, isDraggingNode, data.viewport.zoom, data.nodes, data.edges, potentialTargetNode, updateMousePosition]);

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        setIsPanning(false);
        isPanningRef.current = false;
        setIsDraggingNode(null);
        isDraggingRef.current = false;

        if (connectingNode) {
            if (potentialTargetNode) {
                addEdge(connectingNode, potentialTargetNode);
                setConnectingNode(null);
                setPotentialTargetNode(null);
                return;
            }

            if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
                // Store screen coordinates for menu positioning
                setShowAddMenu({ x: e.clientX, y: e.clientY });
                setSearchQuery('');
                return;
            }

            if (!showAddMenu) {
                setConnectingNode(null);
                setPotentialTargetNode(null);
            }
        }
    }, [connectingNode, potentialTargetNode, showAddMenu]);

    const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        if (e.button === 0) {
            setIsDraggingNode(nodeId);
            isDraggingRef.current = true;
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            setSelectedNodes(new Set([nodeId]));
        }
    }, []);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
            // Store screen coordinates for menu positioning
            setShowAddMenu({ x: e.clientX, y: e.clientY });
            setSearchQuery('');
        }
    }, []);

    const addNode = useCallback((type: NodeType, screenPos: { x: number, y: number }) => {
        // Convert screen coordinates to canvas coordinates
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Don't subtract viewport offset - rect already includes the transform
        const canvasX = (screenPos.x - rect.left) / data.viewport.zoom;
        const canvasY = (screenPos.y - rect.top) / data.viewport.zoom;

        const newNode: NodeData = {
            id: crypto.randomUUID(),
            type,
            label: `New ${NODE_TYPES[type].label}`,
            x: canvasX - 100, // Center the node (node width is 200, so -100 centers it)
            y: canvasY - 40,  // Center vertically (node height is 80, so -40 centers it)
            width: 200,
            height: 80,
            inputs: [],
            outputs: []
        };

        setData(prev => ({
            ...prev,
            nodes: [...prev.nodes, newNode]
        }));
        setShowAddMenu(null);

        if (connectingNode) {
            addEdge(connectingNode, newNode.id);
            setConnectingNode(null);
        }
    }, [connectingNode, data.viewport]);

    const addEdge = useCallback((sourceId: string, targetId: string) => {
        if (sourceId === targetId) return;

        setData(prev => {
            if (prev.edges.some(e => e.source === sourceId && e.target === targetId)) {
                return prev;
            }

            const newEdge: EdgeData = {
                id: crypto.randomUUID(),
                source: sourceId,
                target: targetId
            };

            return {
                ...prev,
                edges: [...prev.edges, newEdge]
            };
        });
    }, []);

    const deleteEdge = useCallback((edgeId: string) => {
        setData(prev => ({
            ...prev,
            edges: prev.edges.filter(e => e.id !== edgeId)
        }));
    }, []);

    const deleteConnections = useCallback((nodeId: string, isOutput: boolean, x: number, y: number, count: number) => {
        // Show port menu instead of immediately deleting
        setPortMenu({ x, y, nodeId, isOutput, count });
    }, []);

    const confirmDeleteConnections = useCallback((nodeId: string, isOutput: boolean) => {
        setData(prev => ({
            ...prev,
            edges: prev.edges.filter(e =>
                isOutput ? e.source !== nodeId : e.target !== nodeId
            )
        }));
        setPortMenu(null);
    }, []);

    const deleteSelected = useCallback(() => {
        setData(prev => {
            const newNodes = prev.nodes.filter(n => !selectedNodes.has(n.id));
            const newEdges = prev.edges.filter(e => !selectedNodes.has(e.source) && !selectedNodes.has(e.target));
            return { ...prev, nodes: newNodes, edges: newEdges };
        });
        setSelectedNodes(new Set());
    }, [selectedNodes]);

    const startConnection = useCallback((e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        e.preventDefault();
        setConnectingNode(nodeId);

        // Initialize connection mouse position with current mouse location
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            // Don't subtract viewport offset - rect already includes the transform
            const canvasX = (e.clientX - rect.left) / data.viewport.zoom;
            const canvasY = (e.clientY - rect.top) / data.viewport.zoom;
            mousePosRef.current = { x: canvasX, y: canvasY };
            setConnectionMousePos({ x: canvasX, y: canvasY });
        }
    }, [data.viewport]);

    const handleNodeMouseUp = useCallback((e: React.MouseEvent, targetId: string) => {
        e.stopPropagation();

        if (connectingNode) {
            addEdge(connectingNode, targetId);
            setConnectingNode(null);
            setPotentialTargetNode(null);
        }

        setIsDraggingNode(null);
        isDraggingRef.current = false;
    }, [connectingNode, addEdge]);

    const handleNodeContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
        e.preventDefault();
        e.stopPropagation();

        // Smart positioning - adjust if near edges
        const menuWidth = 224; // w-56 = 14rem = 224px
        const menuHeight = 400; // approximate max height
        const padding = 10;

        let x = e.clientX;
        let y = e.clientY;

        // Adjust if too close to right edge
        if (x + menuWidth + padding > window.innerWidth) {
            x = window.innerWidth - menuWidth - padding;
        }

        // Adjust if too close to bottom edge
        if (y + menuHeight + padding > window.innerHeight) {
            y = window.innerHeight - menuHeight - padding;
        }

        // Ensure not off top or left
        x = Math.max(padding, x);
        y = Math.max(padding, y);

        setContextMenu({
            x,
            y,
            nodeId
        });
    }, []);

    const handleLabelChange = useCallback((nodeId: string, label: string) => {
        setData(prev => ({
            ...prev,
            nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, label } : n)
        }));
    }, []);

    // Helper function to get port position (not memoized to avoid stale closures)
    const getPortPosition = (nodeId: string, isInput: boolean) => {
        const node = data.nodes.find(n => n.id === nodeId);
        if (!node) return { x: 0, y: 0 };

        if (isInput) {
            return { x: node.x, y: node.y + node.height / 2 };
        } else {
            return { x: node.x + node.width, y: node.y + node.height / 2 };
        }
    };

    // Memoized connection lines - recalculate when edges or nodes change
    const connectionLines = useMemo(() => {
        return data.edges.map(edge => {
            const sourceNode = data.nodes.find(n => n.id === edge.source);
            const targetNode = data.nodes.find(n => n.id === edge.target);

            if (!sourceNode || !targetNode) {
                return { id: edge.id, start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, gradientId: undefined, sourceNode: null, targetNode: null };
            }

            const start = {
                x: sourceNode.x + sourceNode.width,
                y: sourceNode.y + sourceNode.height / 2
            };
            const end = {
                x: targetNode.x,
                y: targetNode.y + targetNode.height / 2
            };

            const gradientId = `gradient-${edge.source}-${edge.target}`;
            return { id: edge.id, start, end, gradientId, sourceNode, targetNode };
        });
    }, [data.edges, data.nodes]);

    // Memoized temporary connection line - follows cursor
    const tempConnectionLine = useMemo(() => {
        if (!connectingNode) return null;

        const start = getPortPosition(connectingNode, false);
        const end = potentialTargetNode
            ? getPortPosition(potentialTargetNode, true)
            : connectionMousePos;

        return { start, end };
    }, [connectingNode, potentialTargetNode, connectionMousePos]);

    const filteredNodeTypes = useMemo(() =>
        (Object.entries(NODE_TYPES) as [NodeType, typeof NODE_TYPES[NodeType]][]).filter(([_, val]) =>
            val.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            val.description.toLowerCase().includes(searchQuery.toLowerCase())
        ),
        [searchQuery]
    );

    return (
        <div className="h-full w-full relative overflow-hidden bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white selection:bg-blue-500/30">
            {/* Dotted Background Pattern */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#d1d5db_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)]" />

            {/* SVG Layer for Connections */}
            <svg className="absolute inset-0 pointer-events-none w-full h-full z-0">
                <defs>
                    <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#60a5fa" />
                        <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                    {/* Dynamic gradients for each connection */}
                    {connectionLines.map(({ id, sourceNode, targetNode }) => {
                        if (!sourceNode || !targetNode) return null;
                        const sourceColor = NODE_TYPES[sourceNode.type].solidColor;
                        const targetColor = NODE_TYPES[targetNode.type].solidColor;
                        return (
                            <linearGradient key={id} id={`gradient-${sourceNode.id}-${targetNode.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={sourceColor} />
                                <stop offset="100%" stopColor={targetColor} />
                            </linearGradient>
                        );
                    })}
                </defs>
                <g style={{ transform: `translate(${data.viewport.x}px, ${data.viewport.y}px) scale(${data.viewport.zoom})` }}>
                    {connectionLines.map(({ id, start, end, gradientId }) => (
                        <ConnectionLine
                            key={id}
                            start={start}
                            end={end}
                            gradientId={gradientId}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (window.confirm('Delete this connection?')) {
                                    deleteEdge(id);
                                }
                            }}
                        />
                    ))}
                    {tempConnectionLine && (
                        <ConnectionLine start={tempConnectionLine.start} end={tempConnectionLine.end} />
                    )}
                </g>
            </svg>

            {/* Nodes Layer */}
            <div
                ref={containerRef}
                className="absolute inset-0 w-full h-full z-10 origin-top-left"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDoubleClick={handleDoubleClick}
                style={{
                    cursor: isPanning ? 'grabbing' : 'default',
                    transform: `translate(${data.viewport.x}px, ${data.viewport.y}px) scale(${data.viewport.zoom})`
                }}
            >
                <AnimatePresence>
                    {data.nodes.map(node => (
                        <Node
                            key={node.id}
                            node={node}
                            isSelected={selectedNodes.has(node.id)}
                            isPotentialTarget={potentialTargetNode === node.id}
                            edges={data.edges}
                            onMouseDown={handleNodeMouseDown}
                            onMouseUp={handleNodeMouseUp}
                            onContextMenu={handleNodeContextMenu}
                            onStartConnection={startConnection}
                            onLabelChange={handleLabelChange}
                            onDeleteConnections={deleteConnections}
                        />
                    ))}
                </AnimatePresence>
            </div>

            {/* Quick Add Menu */}
            <AnimatePresence>
                {showAddMenu && (
                    <>
                        {/* Backdrop to catch clicks */}
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => {
                                setShowAddMenu(null);
                                // Also cancel any active connection
                                if (connectingNode) {
                                    setConnectingNode(null);
                                    setPotentialTargetNode(null);
                                }
                            }}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.15 }}
                            className="fixed z-50 w-72 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                            style={{
                                left: showAddMenu.x,
                                top: showAddMenu.y,
                            }}
                        >
                            <div className="p-3 border-b border-white/5">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                                    <input
                                        autoFocus
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-black/20 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 outline-none border border-transparent focus:border-white/10 placeholder-gray-500"
                                        placeholder="Search nodes..."
                                    />
                                </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                                {filteredNodeTypes.map(([type, config]) => (
                                    <button
                                        key={type}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            addNode(type as NodeType, showAddMenu);
                                        }}
                                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group text-left"
                                    >
                                        <div className={clsx(
                                            "w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br text-white/90 shadow-sm",
                                            config.color
                                        )}>
                                            <config.icon size={16} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-200 group-hover:text-white">
                                                {config.label}
                                            </div>
                                            <div className="text-[10px] text-gray-500 group-hover:text-gray-400">
                                                {config.description}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                                {filteredNodeTypes.length === 0 && (
                                    <div className="p-4 text-center text-xs text-gray-500">
                                        No nodes found matching "{searchQuery}"
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Context Menu */}
            <AnimatePresence>
                {contextMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="fixed z-[100] w-56 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden"
                        style={{
                            left: contextMenu.x,
                            top: contextMenu.y,
                        }}
                    >
                        {contextMenu.nodeId ? (
                            <>
                                <div className="px-3 py-2 border-b border-white/5">
                                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Node Actions
                                    </div>
                                </div>
                                <div className="p-1.5">
                                    {/* Change Type Submenu */}
                                    <div className="mb-1">
                                        <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Change Type
                                        </div>
                                        {Object.entries(NODE_TYPES).map(([type, config]) => {
                                            const node = data.nodes.find(n => n.id === contextMenu.nodeId);
                                            const isCurrentType = node?.type === type;
                                            return (
                                                <button
                                                    key={type}
                                                    onClick={() => {
                                                        setData(prev => ({
                                                            ...prev,
                                                            nodes: prev.nodes.map(n =>
                                                                n.id === contextMenu.nodeId
                                                                    ? { ...n, type: type as NodeType }
                                                                    : n
                                                            )
                                                        }));
                                                        setContextMenu(null);
                                                    }}
                                                    disabled={isCurrentType}
                                                    className={clsx(
                                                        "w-full text-left px-3 py-1.5 text-sm rounded flex items-center gap-2 transition-colors",
                                                        isCurrentType
                                                            ? "text-gray-600 cursor-not-allowed"
                                                            : "text-gray-200 hover:bg-white/10"
                                                    )}
                                                >
                                                    <config.icon size={14} />
                                                    {config.label}
                                                    {isCurrentType && <span className="ml-auto text-xs">✓</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="h-px bg-white/5 my-1" />
                                    <button
                                        onClick={() => {
                                            const node = data.nodes.find(n => n.id === contextMenu.nodeId);
                                            if (node) {
                                                // Place duplicate below the current node (100px down)
                                                const newNode: NodeData = {
                                                    id: crypto.randomUUID(),
                                                    type: node.type,
                                                    label: `${node.label} (Copy)`,
                                                    x: node.x,
                                                    y: node.y + 100,
                                                    width: node.width,
                                                    height: node.height,
                                                    inputs: [],
                                                    outputs: []
                                                };
                                                setData(prev => ({
                                                    ...prev,
                                                    nodes: [...prev.nodes, newNode]
                                                }));
                                            }
                                            setContextMenu(null);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-white/10 rounded flex items-center gap-2"
                                    >
                                        <Copy size={14} /> Duplicate
                                    </button>
                                    <button
                                        onClick={() => {
                                            setData(prev => ({
                                                ...prev,
                                                nodes: prev.nodes.filter(n => n.id !== contextMenu.nodeId),
                                                edges: prev.edges.filter(e => e.source !== contextMenu.nodeId && e.target !== contextMenu.nodeId)
                                            }));
                                            setContextMenu(null);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded flex items-center gap-2"
                                    >
                                        <Trash2 size={14} /> Delete
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Add Node
                                </div>
                                {Object.entries(NODE_TYPES).map(([type, config]) => (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            const rect = containerRef.current?.getBoundingClientRect();
                                            if (rect) {
                                                const x = (contextMenu.x - rect.left - data.viewport.x) / data.viewport.zoom;
                                                const y = (contextMenu.y - rect.top - data.viewport.y) / data.viewport.zoom;
                                                addNode(type as NodeType, { x, y });
                                            }
                                            setContextMenu(null);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-white/10 rounded flex items-center gap-2"
                                    >
                                        <config.icon size={14} />
                                        {config.label}
                                    </button>
                                ))}
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Port Connection Menu */}
            <AnimatePresence>
                {portMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="fixed z-[100] w-64 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden"
                        style={{
                            left: portMenu.x,
                            top: portMenu.y,
                        }}
                    >
                        <div className="p-3">
                            <div className="text-sm text-gray-300 mb-3">
                                Delete {portMenu.count} {portMenu.isOutput ? 'outgoing' : 'incoming'} connection{portMenu.count > 1 ? 's' : ''}?
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => confirmDeleteConnections(portMenu.nodeId, portMenu.isOutput)}
                                    className="flex-1 px-3 py-2 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={() => setPortMenu(null)}
                                    className="flex-1 px-3 py-2 text-sm bg-white/5 text-gray-300 hover:bg-white/10 rounded transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bottom Right Toolbar */}
            <div className="absolute bottom-6 right-6 flex items-center gap-3">
                {/* Info */}
                <div className="bg-[#1a1a1a]/80 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 shadow-lg pointer-events-none">
                    <div className="flex items-center gap-3">
                        <div className="text-xs font-mono text-gray-400">
                            NBM v2.0 • Zoom: {(data.viewport.zoom * 100).toFixed(0)}%
                        </div>
                        {isSaving && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="text-xs font-medium text-emerald-400"
                            >
                                Saving...
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Delete Button */}
                <div className="bg-[#1a1a1a]/80 backdrop-blur-sm border border-white/10 rounded-full p-1.5 shadow-lg pointer-events-auto">
                    <button
                        onClick={deleteSelected}
                        disabled={selectedNodes.size === 0}
                        className="p-2 rounded-full hover:bg-red-500/20 text-white hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Delete Selected"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            {/* Hint Overlay */}
            {data.nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center space-y-2 opacity-30">
                        <MousePointer2 className="w-12 h-12 mx-auto" />
                        <div className="text-sm font-medium">Double-click to add a node</div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default NodeMapEditor;
