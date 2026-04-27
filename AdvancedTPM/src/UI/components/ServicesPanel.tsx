import React, { useMemo } from 'react';
// React hooks are provided by the environment. Do not import to avoid duplicate type declarations.
import './ServicesPanel.css';

interface ServiceInfo {
  id: number;
  name: string;
  type?: string;
  category?: string;
  budget: number;
  fee: number;
  upkeep: number;
  efficiency: number;
  coverage: number;
  capacity: number;
  usage: number;
}

const SERVICE_CATEGORIES = ['All', 'Utilities', 'Emergency', 'Networks', 'Transportation', 'Parks', 'Communications', 'Other'];

const getServiceCategory = (name: string): string => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('electric') || lower.includes('water') || lower.includes('sewage') || lower.includes('garbage')) return 'Utilities';
  if (lower.includes('health') || lower.includes('death') || lower.includes('fire') || lower.includes('police') || lower.includes('disaster')) return 'Emergency';
  if (lower.includes('road')) return 'Networks';
  if (lower.includes('transport') || lower.includes('bus') || lower.includes('tram') || lower.includes('train') || lower.includes('metro') || lower.includes('taxi') || lower.includes('harbor') || lower.includes('airport')) return 'Transportation';
  if (lower.includes('park') || lower.includes('recreation') || lower.includes('plaza') || lower.includes('tourism')) return 'Parks';
  if (lower.includes('post') || lower.includes('telecom')) return 'Communications';
  if (lower.includes('education') || lower.includes('research') || lower.includes('admin')) return 'Other';
  return 'Other';
};

const parseServicesData = (payload: string): ServiceInfo[] => {
  if (!payload) return [];
  try {
    const arr = JSON.parse(payload);
    if (!Array.isArray(arr)) return [];
    return arr.map((s: any) => ({
      id: Number(s.id) || 0,
      name: String(s.name || ''),
      type: String(s.type || ''),
      category: String(s.category || ''),
      budget: Number(s.budget) || 0,
      fee: Number(s.fee) || 0,
      upkeep: Number(s.upkeep) || 0,
      efficiency: Number(s.efficiency) || 0,
      coverage: Number(s.coverage) || 0,
      capacity: Number(s.capacity) || 0,
      usage: Number(s.usage) || 0,
    }));
  } catch {
    return [];
  }
};

const ServicesPanel: React.FC<{ servicesBrowserData?: string }> = ({ servicesBrowserData = '' }) => {
  const services = React.useMemo(() => parseServicesData(servicesBrowserData), [servicesBrowserData]);
  const [categoryFilter, setCategoryFilter] = React.useState('All');
  const [searchText, setSearchText] = React.useState('');

  const bodyRef = React.useRef<HTMLDivElement | null>(null);
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const thumbRef = React.useRef<HTMLDivElement | null>(null);
  const [thumbTop, setThumbTop] = React.useState(0);
  const [thumbHeight, setThumbHeight] = React.useState(48);

  const updateScrollbar = React.useCallback(() => {
    const body = bodyRef.current;
    const track = trackRef.current;
    if (!body || !track) return;
    const visible = body.clientHeight;
    const total = body.scrollHeight || 1;
    try {
      const bodyRect = body.getBoundingClientRect();
      const wrapper = body.parentElement || body;
      const wrapperRect = wrapper.getBoundingClientRect();
      track.style.top = `${Math.max(0, bodyRect.top - wrapperRect.top)}px`;
      track.style.height = `${body.clientHeight}px`;
    } catch {}
    if (visible >= total) { try { track.style.display = 'none'; } catch {} return; }
    try { track.style.display = 'block'; } catch {}
    const ratio = Math.max(0.03, Math.min(1, visible / total));
    const trackHeight = track.clientHeight;
    const thumbH = Math.max(16, Math.round(trackHeight * ratio));
    const maxScroll = total - visible;
    const top = maxScroll > 0 ? Math.round((body.scrollTop / maxScroll) * (trackHeight - thumbH)) : 0;
    setThumbHeight(thumbH);
    setThumbTop(top);
  }, []);

  React.useLayoutEffect(() => { updateScrollbar(); }, [services.length, categoryFilter, searchText, updateScrollbar]);

  React.useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const mo = new MutationObserver(() => updateScrollbar());
    mo.observe(body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [bodyRef.current, updateScrollbar]);

  React.useEffect(() => {
    let dragging = false;
    let startY = 0;
    let startTop = 0;
    const thumb = thumbRef.current;
    const track = trackRef.current;
    const body = bodyRef.current;
    if (!thumb || !track || !body) return;
    const onDown = (ev: any) => {
      try { if (ev.stopPropagation) ev.stopPropagation(); } catch {}
      dragging = true; startY = ev.clientY || 0; startTop = thumbTop;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      ev.preventDefault();
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragging) return;
      const dy = ev.clientY - startY;
      const maxTop = track.clientHeight - thumbHeight;
      const newTop = Math.max(0, Math.min(maxTop, startTop + dy));
      const maxScroll = body.scrollHeight - body.clientHeight;
      body.scrollTop = maxScroll > 0 ? Math.round((newTop / (track.clientHeight - thumbHeight)) * maxScroll) : 0;
      setThumbTop(newTop);
    };
    const onUp = () => { dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); updateScrollbar(); };
    try { thumb.addEventListener('pointerdown', onDown as any); } catch {}
    try { thumb.addEventListener('mousedown', onDown as any); } catch {}
    return () => { try { thumb.removeEventListener('mousedown', onDown as any); } catch {} };
  }, [thumbTop, thumbHeight, updateScrollbar]);

  const filtered = React.useMemo(() => {
    let list = services;
    if (categoryFilter !== 'All') {
      list = list.filter((s) => (s.category || getServiceCategory(s.name)) === categoryFilter);
    }
    if (searchText) {
      const lower = searchText.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(lower) || (s.type || '').toLowerCase().includes(lower));
    }
    return list;
  }, [services, categoryFilter, searchText]);

  if (services.length === 0) {
    // If the binding exists but contains no parsed services, show a helpful debug payload
    if (servicesBrowserData && servicesBrowserData.length > 0) {
      return (
        <div className="svc-panel">
          <div className="svc-panel-empty">No services parsed from payload. Raw payload shown below for debugging.</div>
          <pre className="svc-debug-payload">{servicesBrowserData}</pre>
        </div>
      );
    }
    return <div className="svc-panel-empty">Service data will appear when the simulation is running.</div>;
  }

  return (
    <div className="svc-panel">
      {/* Filters — outside scroll, always visible */}
      <div className="svc-filters">
        <div className="svc-category-tabs">
          {SERVICE_CATEGORIES.map((c) => (
            <button
              key={c}
              className={`svc-category-tab${categoryFilter === c ? ' svc-category-active' : ''}`}
              onClick={() => setCategoryFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="svc-controls">
          <input
            className="svc-search"
            placeholder="Search services..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value || '')}
          />
        </div>
      </div>

      {/* Table: sticky header + scrollable body */}
      <div className="svc-table">
        <div className="svc-table-header">
          <div className="svc-col-name">Service</div>
          <div className="svc-col-category">Category</div>
          <div className="svc-col-budget">Budget%</div>
          <div className="svc-col-fee">Fee%</div>
          <div className="svc-col-eff">Eff</div>
          <div className="svc-col-coverage">Coverage</div>
          <div className="svc-col-cap">Capacity</div>
          <div className="svc-col-usage">Usage</div>
          <div className="svc-col-upkeep">Upkeep</div>
        </div>
        <div className="svc-scroll-wrap">
          <div ref={bodyRef} className="svc-table-body" onScroll={updateScrollbar}>
            {filtered.map((s) => (
              <div key={`${s.id}-${s.name}`} className="svc-table-row">
                <div className="svc-col-name">{s.name || `Service ${s.id}`}</div>
                <div className="svc-col-category">{s.category || getServiceCategory(s.name)}</div>
                <div className="svc-col-budget"
                  style={{ color: s.budget > 0 && s.budget < 80 ? '#e88c3a' : s.budget >= 100 ? '#8bdb46' : 'rgba(255,255,255,0.7)' }}>
                  {s.budget.toFixed(0)}%
                </div>
                <div className="svc-col-fee"
                  style={{ color: s.fee > 80 ? '#e05050' : s.fee > 50 ? '#e88c3a' : 'rgba(255,255,255,0.7)' }}>
                  {s.fee.toFixed(0)}%
                </div>
                <div className="svc-col-eff"
                  style={{ color: s.efficiency >= 0.8 ? '#8bdb46' : s.efficiency >= 0.5 ? '#e88c3a' : '#e05050' }}>
                  {(s.efficiency * 100).toFixed(0)}%
                </div>
                <div className="svc-col-coverage">{s.coverage.toFixed(1)}</div>
                <div className="svc-col-cap">{s.capacity.toFixed(0)}</div>
                <div className="svc-col-usage">{s.usage.toFixed(0)}</div>
                <div className="svc-col-upkeep">{s.upkeep.toFixed(0)}</div>
              </div>
            ))}
          </div>
          <div ref={trackRef} className="svc-scrollbar-track" aria-hidden>
            <div ref={thumbRef} className="svc-scrollbar-thumb" style={{ top: `${thumbTop}px`, height: `${thumbHeight}px` }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServicesPanel;
