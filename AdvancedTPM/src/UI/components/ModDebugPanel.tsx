import React, { useState, useEffect, useRef } from 'react';
import './ModDebugPanel.css';

interface InspectionResult {
    entity?: string;
    components?: string[];
    error?: string;
}

interface TypeSearchResult {
    name: string;
    isEnum: boolean;
    members: string;
}

interface ModDebugPanelProps {
    onClose?: () => void;
}

export const ModDebugPanel: React.FC<ModDebugPanelProps> = ({ onClose }) => {
    const [entityKey, setEntityKey] = useState('');
    const [inspection, setInspection] = useState<InspectionResult | null>(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState<TypeSearchResult[]>([]);
    const [status, setStatus] = useState('Idle');
    const [pos, setPos] = useState<{x:number;y:number}>(() => {
        try {
            const raw = localStorage.getItem('atpm.moddebug.pos');
            if (raw) return JSON.parse(raw);
        } catch {}
        return { x: 100, y: 100 };
    });

    const drag = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });

    useEffect(() => {
        const mm = (e: MouseEvent) => {
            if (!drag.current.active) return;
            const nx = drag.current.ox + (e.clientX - drag.current.sx);
            const ny = drag.current.oy + (e.clientY - drag.current.sy);
            setPos({ x: nx, y: ny });
        };
        const mu = () => {
            if (!drag.current.active) return;
            drag.current.active = false;
            try { localStorage.setItem('atpm.moddebug.pos', JSON.stringify(pos)); } catch {}
        };
        document.addEventListener('mousemove', mm);
        document.addEventListener('mouseup', mu);
        return () => {
            document.removeEventListener('mousemove', mm);
            document.removeEventListener('mouseup', mu);
        };
    }, [pos]);

    useEffect(() => {
        const sub1 = (window as any).engine.on('taxProduction.debugStatus', (s: string) => setStatus(s));
        const sub2 = (window as any).engine.on('taxProduction.inspectionResult', (r: string) => setInspection(JSON.parse(r)));
        const sub3 = (window as any).engine.on('taxProduction.typeSearchResults', (r: string) => setSearchResults(JSON.parse(r)));
        
        return () => {
            sub1.clear();
            sub2.clear();
            sub3.clear();
        };
    }, []);

    const doInspect = () => {
        (window as any).engine.trigger('taxProduction.inspectEntity', entityKey);
    };

    const doSearch = () => {
        (window as any).engine.trigger('taxProduction.searchTypes', searchKeyword);
    };



    return (
        <div className="mod-debug-panel" style={{ left: pos.x, top: pos.y }}>
            <div 
                className="header" 
                style={{ cursor: 'move' }} 
                onMouseDown={e => { 
                    e.stopPropagation(); 
                    e.preventDefault();
                    drag.current = { active: true, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }; 
                }}
            >
                <span>AdvancedTPM Diagnostic Tool</span>
                {onClose && <button className="close-btn" onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ cursor: 'pointer' }}>X</button>}
            </div>
            <div className="status">Status: {status}</div>
            
            <div className="section">
                <h3>Entity Inspector</h3>
                <div className="input-row">
                    <input value={entityKey} onChange={e => setEntityKey(e.target.value)} placeholder="Index,Version" />
                    <button onClick={doInspect}>Inspect</button>
                </div>
                {inspection && (
                    <div className="result">
                        {inspection.error ? (
                            <div className="error">{inspection.error}</div>
                        ) : (
                            <>
                                <div>Entity: {inspection.entity}</div>
                                <ul>
                                    {inspection.components?.map(c => <li key={c}>{c}</li>)}
                                </ul>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="section">
                <h3>Type Discovery (Game.dll)</h3>
                <div className="input-row">
                    <input value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} placeholder="Keyword..." />
                    <button onClick={doSearch}>Search</button>
                </div>
                <div className="search-results">
                    {searchResults.map((r, i) => (
                        <div key={i} className="type-item">
                            <strong>{r.name}</strong> {r.isEnum ? '(Enum)' : ''}
                            <div className="members">{r.members}</div>
                        </div>
                    ))}
                </div>
            </div>


        </div>
    );
};
