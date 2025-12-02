import { useState, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

export function DrawingPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(5);
    const [savedStatus, setSavedStatus] = useState('Saved');

    useEffect(() => {
        loadDrawing();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleResize = () => {
        // TODO: Handle resize without losing drawing data
    };

    const loadDrawing = async () => {
        try {
            // @ts-ignore
            const data = await window.ipcRenderer.invoke('get-drawing');
            if (data) {
                const img = new Image();
                img.src = data;
                img.onload = () => {
                    const canvas = canvasRef.current;
                    if (canvas) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(img, 0, 0);
                        }
                    }
                };
            }
        } catch (e) {
            console.error('Failed to load drawing', e);
        }
    };

    const saveDrawing = async () => {
        const canvas = canvasRef.current;
        if (canvas) {
            setSavedStatus('Saving...');
            const data = canvas.toDataURL();
            try {
                // @ts-ignore
                await window.ipcRenderer.invoke('save-drawing', data);
                setSavedStatus('Saved');
            } catch (e) {
                console.error('Failed to save drawing', e);
                setSavedStatus('Error saving');
            }
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                
                ctx.beginPath();
                ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                ctx.strokeStyle = color;
                ctx.lineWidth = brushSize;
                ctx.lineCap = 'round';
                setIsDrawing(true);
            }
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;

                ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                ctx.stroke();
            }
        }
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            saveDrawing();
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                saveDrawing();
            }
        }
    };

    return (
        <div className="h-full flex flex-col relative bg-gray-50 dark:bg-gray-900">
            <div className="absolute top-6 left-6 z-10">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Drawing Board</h1>
                <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    Sketch your ideas
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {savedStatus}
                    </span>
                </p>
            </div>

            <div className="flex-1 overflow-hidden relative cursor-crosshair">
                <canvas
                    ref={canvasRef}
                    width={1920}
                    height={1080}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    className="w-full h-full touch-none bg-white dark:bg-gray-800"
                />
            </div>

            {/* Floating Toolbar */}
            <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 flex items-center gap-6 z-20"
            >
                <div className="flex items-center gap-3">
                    <div 
                        className="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-gray-600 overflow-hidden cursor-pointer relative shadow-sm"
                        style={{ backgroundColor: color }}
                    >
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                    </div>
                </div>
                
                <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />

                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 uppercase">Size</span>
                    <input
                        type="range"
                        min="1"
                        max="50"
                        value={brushSize}
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        className="w-32 accent-blue-500"
                    />
                    <div 
                        className="rounded-full bg-gray-900 dark:bg-white"
                        style={{ width: Math.min(brushSize, 24), height: Math.min(brushSize, 24) }}
                    />
                </div>

                <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />

                <button
                    onClick={clearCanvas}
                    className="p-2 rounded-xl hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors"
                    title="Clear Canvas"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </motion.div>
        </div>
    );
}
