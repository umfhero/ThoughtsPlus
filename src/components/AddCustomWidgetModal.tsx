import React, { useState, useEffect } from 'react';
import { CustomWidgetConfig } from '../types';
import { saveWidgetConfig } from '../utils/customWidgetManager';
import { X, Play, Save, Check, Upload, Activity, DollarSign, Cloud, Rocket, Globe, Cpu, Database, BarChart2 } from 'lucide-react';
import clsx from 'clsx';

interface AddCustomWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
}

const PRESETS = [
    {
        name: 'NASA Near Earth Objects',
        url: `https://api.nasa.gov/neo/rest/v1/feed?start_date={TODAY}&end_date={TODAY}&api_key=${import.meta.env.VITE_NASA_API_KEY || 'DEMO_KEY'}`,
        dataKey: 'element_count',
        xKey: 'date', 
        isAccumulative: true,
        yKey: 'element_count',
        icon: 'Rocket'
    },
    {
        name: 'Bitcoin Price (CoinGecko)',
        url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
        dataKey: '',
        xKey: 'date',
        yKey: 'bitcoin.usd',
        isAccumulative: true,
        icon: 'DollarSign'
    },
    {
        name: 'International Space Station Location',
        url: 'https://api.open-notify.org/iss-now.json',
        dataKey: '',
        xKey: 'timestamp',
        yKey: 'iss_position.latitude', 
        isAccumulative: true,
        icon: 'Globe'
    }
];

const ICONS = {
    Activity, DollarSign, Cloud, Rocket, Globe, Cpu, Database, BarChart2
};

export const AddCustomWidgetModal: React.FC<AddCustomWidgetModalProps> = ({ isOpen, onClose, onSave }) => {
    const [config, setConfig] = useState<Partial<CustomWidgetConfig>>({
        title: '',
        apiUrl: '',
        refreshInterval: 60,
        isAccumulative: false,
        xKey: '',
        yKey: '',
        color: '#3B82F6',
        dataKey: '',
        icon: 'Activity',
        iconType: 'lucide'
    });
    const [testResult, setTestResult] = useState<string>('');
    const [isTesting, setIsTesting] = useState(false);
    const [detectedKeys, setDetectedKeys] = useState<{arrays: string[], numbers: string[], dates: string[]} | null>(null);
    const [customIconPreview, setCustomIconPreview] = useState<string | null>(null);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setTestResult('');
            setDetectedKeys(null);
            setCustomIconPreview(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const analyzeJson = (json: any, prefix = ''): { arrays: string[], numbers: string[], dates: string[] } => {
        let arrays: string[] = [];
        let numbers: string[] = [];
        let dates: string[] = [];

        if (Array.isArray(json)) {
            arrays.push(prefix || 'root');
            // Analyze first item
            if (json.length > 0 && typeof json[0] === 'object') {
                const sub = analyzeJson(json[0], '');
                numbers = sub.numbers;
                dates = sub.dates;
            }
        } else if (typeof json === 'object' && json !== null) {
            Object.keys(json).forEach(key => {
                const value = json[key];
                const fullPath = prefix ? `${prefix}.${key}` : key;

                if (Array.isArray(value)) {
                    arrays.push(fullPath);
                    // Analyze first item of array
                    if (value.length > 0 && typeof value[0] === 'object') {
                        analyzeJson(value[0], ''); // Relative keys for array items
                        // We don't add these to the main lists directly as paths, 
                        // but we might want to know what keys are available inside the array.
                        // For simplicity, let's just look for numbers/dates in the root object 
                        // OR if we selected an array, we'll need to re-analyze its items.
                    }
                } else if (typeof value === 'number') {
                    numbers.push(fullPath);
                } else if (typeof value === 'string') {
                    // Simple date check
                    if (value.match(/^\d{4}-\d{2}-\d{2}/) || !isNaN(Date.parse(value))) {
                        dates.push(fullPath);
                    }
                } else if (typeof value === 'object') {
                    const sub = analyzeJson(value, fullPath);
                    arrays = [...arrays, ...sub.arrays];
                    numbers = [...numbers, ...sub.numbers];
                    dates = [...dates, ...sub.dates];
                }
            });
        }
        return { arrays, numbers, dates };
    };

    const handleTest = async () => {
        if (!config.apiUrl) return;
        setIsTesting(true);
        setDetectedKeys(null);
        
        // Replace placeholders
        let url = config.apiUrl;
        if (url.includes('{TODAY}')) {
            url = url.replace(/{TODAY}/g, new Date().toISOString().split('T')[0]);
        }

        try {
            const res = await fetch(url);
            const json = await res.json();
            setTestResult(JSON.stringify(json, null, 2));
            
            // Auto-detect
            const analysis = analyzeJson(json);
            setDetectedKeys(analysis);

            // Auto-select if empty
            if (!config.dataKey && analysis.arrays.length > 0) {
                setConfig(prev => ({ ...prev, dataKey: analysis.arrays[0] === 'root' ? '' : analysis.arrays[0] }));
            }
            // If accumulative (single value), look for numbers in root
            if (config.isAccumulative && !config.yKey && analysis.numbers.length > 0) {
                setConfig(prev => ({ ...prev, yKey: analysis.numbers[0] }));
            }

        } catch (e) {
            setTestResult('Error: ' + (e as Error).message);
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = () => {
        if (!config.title || !config.apiUrl || !config.yKey) {
            alert('Please fill in all required fields (Title, API URL, Y-Axis Key)');
            return;
        }

        const newConfig: CustomWidgetConfig = {
            id: `custom_${Date.now()}`,
            title: config.title!,
            apiUrl: config.apiUrl!,
            refreshInterval: config.refreshInterval || 60,
            isAccumulative: !!config.isAccumulative,
            xKey: config.xKey || 'date',
            yKey: config.yKey!,
            color: config.color || '#3B82F6',
            dataKey: config.dataKey,
            icon: config.icon,
            iconType: config.iconType
        };

        saveWidgetConfig(newConfig);
        onSave();
        onClose();
    };

    const handlePresetSelect = (preset: any) => {
        let url = preset.url;
        if (url.includes('{TODAY}')) {
            url = url.replace(/{TODAY}/g, new Date().toISOString().split('T')[0]);
        }
        setConfig({
            ...config,
            title: preset.name,
            apiUrl: url,
            dataKey: preset.dataKey,
            xKey: preset.xKey,
            yKey: preset.yKey,
            isAccumulative: preset.isAccumulative,
            icon: preset.icon
        });
    };

    const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setCustomIconPreview(base64);
                setConfig(prev => ({ ...prev, icon: base64, iconType: 'custom' }));
            };
            reader.readAsDataURL(file);
        }
    };

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Custom Widget</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Presets */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Presets</label>
                        <div className="flex flex-wrap gap-2">
                            {PRESETS.map(p => (
                                <button
                                    key={p.name}
                                    onClick={() => handlePresetSelect(p)}
                                    className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900 text-gray-700 dark:text-gray-300 rounded-full transition-colors border border-gray-200 dark:border-gray-600"
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Widget Title</label>
                            <input 
                                type="text" 
                                className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                value={config.title}
                                onChange={e => setConfig({...config, title: e.target.value})}
                                placeholder="My Stock Tracker"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Refresh Interval (min)</label>
                            <input 
                                type="number" 
                                className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                value={config.refreshInterval}
                                onChange={e => setConfig({...config, refreshInterval: Number(e.target.value)})}
                            />
                        </div>
                    </div>

                    {/* API Config */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API URL</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                value={config.apiUrl}
                                onChange={e => setConfig({...config, apiUrl: e.target.value})}
                                placeholder="https://api.example.com/data"
                            />
                            <button 
                                onClick={handleTest}
                                disabled={isTesting || !config.apiUrl}
                                className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isTesting ? <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" /> : <Play size={16} />}
                                Test & Detect
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Use {'{TODAY}'} for current date (YYYY-MM-DD).</p>
                    </div>

                    {/* Test Result */}
                    {testResult && (
                        <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-40">
                            <pre className="text-gray-800 dark:text-gray-300">{testResult.slice(0, 1000)}</pre>
                        </div>
                    )}

                    {/* Data Mapping */}
                    <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h3 className="font-medium text-gray-900 dark:text-white">Data Mapping</h3>
                        
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="accumulative"
                                checked={config.isAccumulative}
                                onChange={e => setConfig({...config, isAccumulative: e.target.checked})}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="accumulative" className="text-sm text-gray-700 dark:text-gray-300">
                                Accumulate History (Check this if API returns a single current value)
                            </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Data Array Path {config.isAccumulative && '(Optional)'}
                                </label>
                                {detectedKeys?.arrays.length ? (
                                    <select 
                                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        value={config.dataKey}
                                        onChange={e => setConfig({...config, dataKey: e.target.value})}
                                    >
                                        <option value="">Select Path...</option>
                                        {detectedKeys.arrays.map(k => (
                                            <option key={k} value={k === 'root' ? '' : k}>{k}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input 
                                        type="text" 
                                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        value={config.dataKey}
                                        onChange={e => setConfig({...config, dataKey: e.target.value})}
                                        placeholder="e.g. results.stats"
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    X Axis Key {config.isAccumulative && '(Ignored)'}
                                </label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    value={config.xKey}
                                    onChange={e => setConfig({...config, xKey: e.target.value})}
                                    placeholder="e.g. date"
                                    disabled={!!config.isAccumulative}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Y Axis Key</label>
                                {detectedKeys?.numbers.length ? (
                                    <select 
                                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        value={config.yKey}
                                        onChange={e => setConfig({...config, yKey: e.target.value})}
                                    >
                                        <option value="">Select Value...</option>
                                        {detectedKeys.numbers.map(k => (
                                            <option key={k} value={k}>{k}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input 
                                        type="text" 
                                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        value={config.yKey}
                                        onChange={e => setConfig({...config, yKey: e.target.value})}
                                        placeholder="e.g. value"
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Visuals */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Theme Color</label>
                            <div className="flex gap-2">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setConfig({...config, color: c})}
                                        className={clsx(
                                            "w-8 h-8 rounded-full transition-transform hover:scale-110",
                                            config.color === c ? "ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800" : ""
                                        )}
                                        style={{ backgroundColor: c }}
                                    >
                                        {config.color === c && <Check size={16} className="text-white mx-auto" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Icon</label>
                            <div className="flex gap-4 items-start">
                                <div className="grid grid-cols-4 gap-2">
                                    {Object.keys(ICONS).map(iconName => {
                                        // @ts-ignore
                                        const IconComp = ICONS[iconName];
                                        return (
                                            <button
                                                key={iconName}
                                                onClick={() => setConfig({...config, icon: iconName, iconType: 'lucide'})}
                                                className={clsx(
                                                    "p-2 rounded-lg border transition-colors",
                                                    config.icon === iconName && config.iconType === 'lucide'
                                                        ? "bg-blue-50 border-blue-500 text-blue-600"
                                                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                                                )}
                                            >
                                                <IconComp size={20} />
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <label className="cursor-pointer flex flex-col items-center justify-center w-16 h-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        {customIconPreview || (config.iconType === 'custom' && config.icon) ? (
                                            <img 
                                                src={customIconPreview || config.icon} 
                                                alt="Custom" 
                                                className="w-8 h-8 object-contain" 
                                            />
                                        ) : (
                                            <Upload size={20} className="text-gray-400" />
                                        )}
                                        <input type="file" className="hidden" accept="image/*" onChange={handleIconUpload} />
                                    </label>
                                    <span className="text-[10px] text-gray-500">Custom</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Save size={18} />
                        Save Widget
                    </button>
                </div>
            </div>
        </div>
    );
};
