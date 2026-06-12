import React, { useState, useMemo } from 'react';
import SupervisorCard from './SupervisorCard';

export default function DirectoryDashboard({
  supervisors,
  openEmailModal,
  playClickSound,
  playHoverSound,
  darkMode,
  activeMainTab,
  setActiveMainTab,
  children // This will be the MemoryGraphView component passed from parent
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [selectedUni, setSelectedUni] = useState('ALL');
  const [sortBy, setSortBy] = useState('score-desc');
  const [viewLayout, setViewLayout] = useState('grid'); // 'grid' or 'list'
  const [expandedRows, setExpandedRows] = useState({}); // Track expanded rows in list view

  // Dynamic statistics calculations
  const stats = useMemo(() => {
    if (!supervisors || supervisors.length === 0) {
      return { count: 0, peakScore: 0, avgHIndex: 0, totalCitations: 0, uniqueUnis: 0 };
    }

    const count = supervisors.length;
    const scores = supervisors.map(s => s.match_analysis?.score || 0);
    const peakScore = Math.max(...scores);

    const hIndices = supervisors.map(s => parseInt(s.h_index)).filter(h => !isNaN(h));
    const avgHIndex = hIndices.length > 0 ? Math.round(hIndices.reduce((a, b) => a + b, 0) / hIndices.length) : '—';

    const uniqueUnis = new Set(supervisors.map(s => s.university).filter(Boolean)).size;

    const citationValues = supervisors
      .map(s => parseInt(s.citations?.toString().replace(/,/g, '')))
      .filter(c => !isNaN(c));
    const totalCitations = citationValues.reduce((a, b) => a + b, 0);

    return { count, peakScore, avgHIndex, totalCitations, uniqueUnis };
  }, [supervisors]);

  // Extract all unique universities for the filter dropdown
  const universityOptions = useMemo(() => {
    if (!supervisors) return [];
    const unis = supervisors.map(s => s.university).filter(Boolean);
    return ['ALL', ...Array.from(new Set(unis))];
  }, [supervisors]);

  // Filter & Sort Logic
  const filteredAndSortedSupervisors = useMemo(() => {
    if (!supervisors) return [];

    let result = supervisors.filter(prof => {
      // 1. Text Search matching name, university, department, or research direction
      const q = searchQuery.toLowerCase();
      const nameMatch = (prof.name || '').toLowerCase().includes(q);
      const uniMatch = (prof.university || '').toLowerCase().includes(q);
      const deptMatch = (prof.department_or_lab || '').toLowerCase().includes(q);
      const overlapMatch = (prof.match_analysis?.research_overlap || '').toLowerCase().includes(q);
      
      const textMatch = nameMatch || uniMatch || deptMatch || overlapMatch;

      // 2. Score slider filter
      const score = prof.match_analysis?.score || 0;
      const scoreMatch = score >= minScore;

      // 3. University dropdown filter
      const uniFilterMatch = selectedUni === 'ALL' || prof.university === selectedUni;

      return textMatch && scoreMatch && uniFilterMatch;
    });

    // Sort matching profiles
    result.sort((a, b) => {
      if (sortBy === 'score-desc') {
        return (b.match_analysis?.score || 0) - (a.match_analysis?.score || 0);
      }
      if (sortBy === 'score-asc') {
        return (a.match_analysis?.score || 0) - (b.match_analysis?.score || 0);
      }
      if (sortBy === 'citations-desc') {
        const cA = parseInt(a.citations?.toString().replace(/,/g, '')) || 0;
        const cB = parseInt(b.citations?.toString().replace(/,/g, '')) || 0;
        return cB - cA;
      }
      if (sortBy === 'hindex-desc') {
        const hA = parseInt(a.h_index) || 0;
        const hB = parseInt(b.h_index) || 0;
        return hB - hA;
      }
      if (sortBy === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });

    return result;
  }, [supervisors, searchQuery, minScore, selectedUni, sortBy]);

  const toggleRowExpansion = (id) => {
    playClickSound();
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const resetFilters = () => {
    playClickSound();
    setSearchQuery('');
    setMinScore(0);
    setSelectedUni('ALL');
    setSortBy('score-desc');
  };

  return (
    <div className="directory-dashboard-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Dynamic CSS styles injected inside component */}
      <style>{`
        .stats-hud {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          width: 100%;
        }
        @media(min-width: 768px) {
          .stats-hud {
            grid-template-columns: repeat(5, 1fr);
          }
        }
        .stat-card-v2 {
          background-color: var(--gl-card-bg);
          border: 1px solid var(--gl-border);
          border-radius: 12px;
          padding: 18px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          backdrop-filter: blur(20px);
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.03);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .stat-card-v2:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.06);
          border-color: var(--gl-black);
        }
        .stat-title-v2 {
          font-size: 0.72rem;
          color: var(--gl-gray);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-family: var(--font-mono);
          font-weight: 600;
        }
        .stat-value-v2 {
          font-size: 1.45rem;
          font-weight: 800;
          color: var(--gl-black);
          font-family: var(--font-heading);
        }
        .stat-footer-v2 {
          font-size: 0.65rem;
          color: var(--gl-gray);
        }

        .filter-hud-card {
          background-color: var(--gl-card-bg);
          border: 1px solid var(--gl-border);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          backdrop-filter: blur(20px);
        }
        .filter-grid-v2 {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media(min-width: 992px) {
          .filter-grid-v2 {
            grid-template-columns: 2fr 1fr 1fr 1.2fr;
          }
        }

        .workspace-tabs-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--gl-border);
          padding-bottom: 12px;
          margin-top: 8px;
        }
        .tab-btn-v2 {
          background: none;
          border: none;
          padding: 8px 16px;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--gl-gray);
          cursor: pointer;
          position: relative;
          transition: color 0.3s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tab-btn-v2.active {
          color: var(--gl-black);
        }
        .tab-btn-v2.active::after {
          content: '';
          position: absolute;
          bottom: -13px;
          left: 0;
          width: 100%;
          height: 2px;
          background-color: var(--gl-black);
        }

        .layout-toggle-container {
          display: flex;
          background-color: var(--gl-border);
          padding: 3px;
          border-radius: 8px;
        }
        .layout-toggle-btn {
          background: none;
          border: none;
          padding: 6px 12px;
          font-size: 0.76rem;
          font-weight: 600;
          color: var(--gl-gray);
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s ease;
        }
        .layout-toggle-btn.active {
          background-color: var(--gl-light);
          color: var(--gl-black);
          box-shadow: 0 2px 6px rgba(0,0,0,0.06);
        }

        /* Accordion List View Styles */
        .list-view-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .list-row-item {
          background-color: var(--gl-card-bg);
          border: 1px solid var(--gl-border);
          border-radius: 10px;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .list-row-item:hover {
          border-color: var(--gl-black);
        }
        .list-row-header {
          padding: 16px 20px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          gap: 12px;
          user-select: none;
        }
        .list-row-main-info {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
          min-width: 280px;
        }
        .list-row-score-badge {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.95rem;
          font-family: var(--font-mono);
        }
        .list-row-meta {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .list-row-name {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--gl-black);
        }
        .list-row-subtext {
          font-size: 0.78rem;
          color: var(--gl-gray);
        }
        .list-row-stats-group {
          display: flex;
          gap: 18px;
          font-size: 0.8rem;
        }
        .list-row-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .list-row-stat-val {
          font-weight: 700;
          color: var(--gl-black);
        }
        .list-row-stat-lbl {
          font-size: 0.65rem;
          color: var(--gl-gray);
          text-transform: uppercase;
        }
        .list-row-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .list-row-chevron {
          font-size: 1.1rem;
          color: var(--gl-gray);
          transition: transform 0.3s ease;
        }
        .list-row-chevron.expanded {
          transform: rotate(180deg);
        }

        .list-row-body-drawer {
          border-top: 1px solid var(--gl-border);
          background-color: rgba(0, 0, 0, 0.015);
          animation: slideDown 0.3s ease-out;
        }
        body.dark-mode .list-row-body-drawer {
          background-color: rgba(255, 255, 255, 0.01);
        }
        .list-row-body-inner {
          padding: 24px;
        }

        @keyframes slideDown {
          from { height: 0; opacity: 0; }
          to { height: auto; opacity: 1; }
        }
      `}</style>

      {/* 1. Academic Analytics HUD Widgets */}
      <section className="stats-hud">
        <div className="stat-card-v2" onPointerOver={playHoverSound}>
          <span className="stat-title-v2">Supervisors Matched</span>
          <span className="stat-value-v2">#{stats.count}</span>
          <span className="stat-footer-v2">Total candidate links</span>
        </div>

        <div className="stat-card-v2" onPointerOver={playHoverSound}>
          <span className="stat-title-v2">Peak Match Score</span>
          <span className="stat-value-v2" style={{ color: stats.peakScore >= 80 ? '#10B981' : '#F59E0B' }}>
            {stats.peakScore > 0 ? `${stats.peakScore}%` : '—'}
          </span>
          <span className="stat-footer-v2">Highest compatibility</span>
        </div>

        <div className="stat-card-v2" onPointerOver={playHoverSound}>
          <span className="stat-title-v2">Average H-Index</span>
          <span className="stat-value-v2">{stats.avgHIndex}</span>
          <span className="stat-footer-v2">Citation frequency rating</span>
        </div>

        <div className="stat-card-v2" onPointerOver={playHoverSound}>
          <span className="stat-title-v2">Total Citation Pool</span>
          <span className="stat-value-v2">{stats.totalCitations > 0 ? stats.totalCitations.toLocaleString() : '—'}</span>
          <span className="stat-footer-v2">Matched scholar footprint</span>
        </div>

        <div className="stat-card-v2" onPointerOver={playHoverSound}>
          <span className="stat-title-v2">Institutions</span>
          <span className="stat-value-v2">{stats.uniqueUnis}</span>
          <span className="stat-footer-v2">Unique universities represented</span>
        </div>
      </section>

      {/* 2. Advanced Filters & Search HUD */}
      <section className="filter-hud-card">
        <div className="filter-grid-v2">
          {/* Text search input */}
          <div className="form-group" style={{ margin: 0 }}>
            <span className="form-label" style={{ fontSize: '0.7rem' }}>Search Matches</span>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input-text"
                placeholder="Search name, university, keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingRight: '30px' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gl-gray)', fontSize: '0.9rem' }}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Min Score slider */}
          <div className="form-group" style={{ margin: 0 }}>
            <span className="form-label" style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Min Match Score</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{minScore}%</strong>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => setMinScore(parseInt(e.target.value))}
              style={{
                width: '100%',
                height: '6px',
                background: 'var(--gl-border)',
                outline: 'none',
                accentColor: 'var(--gl-black)',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* Institution Filter Dropdown */}
          <div className="form-group" style={{ margin: 0 }}>
            <span className="form-label" style={{ fontSize: '0.7rem' }}>Filter by Institution</span>
            <select
              value={selectedUni}
              onChange={(e) => setSelectedUni(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--gl-border)',
                backgroundColor: 'var(--gl-light)',
                color: 'var(--gl-black)',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {universityOptions.map((uni, idx) => (
                <option key={idx} value={uni}>
                  {uni === 'ALL' ? '🏫 All Universities' : uni}
                </option>
              ))}
            </select>
          </div>

          {/* Sorting Engine Dropdown */}
          <div className="form-group" style={{ margin: 0 }}>
            <span className="form-label" style={{ fontSize: '0.7rem' }}>Sort Directory</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--gl-border)',
                  backgroundColor: 'var(--gl-light)',
                  color: 'var(--gl-black)',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="score-desc">🏆 Compatibility Score (High → Low)</option>
                <option value="score-asc"> Compatibility Score (Low → High)</option>
                <option value="citations-desc">📚 Citation Impact (High → Low)</option>
                <option value="hindex-desc">📈 Scholar H-Index (High → Low)</option>
                <option value="name-asc">🔤 Alphabetical (A → Z)</option>
              </select>

              {(searchQuery || minScore > 0 || selectedUni !== 'ALL' || sortBy !== 'score-desc') && (
                <button
                  className="btn btn-secondary"
                  onClick={resetFilters}
                  style={{ width: 'auto', padding: '10px 14px', fontSize: '0.8rem' }}
                  title="Reset Filters"
                >
                  ⟲
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Navigation Tab Bar & Layout Toggles */}
      <section className="workspace-tabs-container">
        <div style={{ display: 'flex', gap: '16px' }}>
          <button
            className={`tab-btn-v2 ${activeMainTab === 'directory' ? 'active' : ''}`}
            onClick={() => { playClickSound(); setActiveMainTab('directory'); }}
          >
            📁 Supervisor matches ({filteredAndSortedSupervisors.length})
          </button>
          
          <button
            className={`tab-btn-v2 ${activeMainTab === 'memory' ? 'active' : ''}`}
            onClick={() => { playClickSound(); setActiveMainTab('memory'); }}
          >
            🧠 Subspace Memory Graph
          </button>
        </div>

        {activeMainTab === 'directory' && filteredAndSortedSupervisors.length > 0 && (
          <div className="layout-toggle-container">
            <button
              className={`layout-toggle-btn ${viewLayout === 'grid' ? 'active' : ''}`}
              onClick={() => { playClickSound(); setViewLayout('grid'); }}
            >
              ⊞ Grid
            </button>
            <button
              className={`layout-toggle-btn ${viewLayout === 'list' ? 'active' : ''}`}
              onClick={() => { playClickSound(); setViewLayout('list'); }}
            >
              ☰ List
            </button>
          </div>
        )}
      </section>

      {/* 4. Tab Context Panel Render */}
      <div className="tab-context-panel" style={{ flex: 1 }}>
        {activeMainTab === 'memory' ? (
          children // Render MemoryGraphView child
        ) : (
          /* Directory View */
          <>
            {filteredAndSortedSupervisors.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gl-gray)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <span style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🔍</span>
                <h4 style={{ color: 'var(--gl-black)', marginBottom: '8px', fontSize: '1.1rem' }}>No Matched Supervisors Found</h4>
                <p style={{ fontSize: '0.85rem', maxWidth: '400px' }}>
                  {supervisors.length === 0 
                    ? "Awaiting academic resume or portfolio upload. Use the sidebar controls to begin the autonomous matching pipeline." 
                    : "No matches satisfy your filter parameters. Try adjusting the search query, compatibility score slider, or reset your filters."}
                </p>
                {supervisors.length > 0 && (
                  <button className="btn" style={{ marginTop: '20px', width: 'auto', padding: '10px 20px' }} onClick={resetFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
            ) : viewLayout === 'grid' ? (
              /* Grid Layout Mode */
              <div className="results-grid">
                {filteredAndSortedSupervisors.map((prof) => (
                  <SupervisorCard
                    key={prof.id}
                    prof={prof}
                    onOpenEmail={openEmailModal}
                    playHoverSound={playHoverSound}
                    playClickSound={playClickSound}
                  />
                ))}
              </div>
            ) : (
              /* Accordion List Layout Mode */
              <div className="list-view-container">
                {filteredAndSortedSupervisors.map((prof) => {
                  const isExpanded = !!expandedRows[prof.id];
                  const score = prof.match_analysis?.score || 0;
                  
                  // Score-dependent color coding
                  let scoreColor = '#EF4444';
                  if (score >= 80) scoreColor = '#10B981';
                  else if (score >= 60) scoreColor = '#6366F1';
                  else if (score >= 40) scoreColor = '#F59E0B';

                  return (
                    <div key={prof.id} className="list-row-item">
                      {/* Accordion Row Header */}
                      <div className="list-row-header" onClick={() => toggleRowExpansion(prof.id)}>
                        <div className="list-row-main-info">
                          <div 
                            className="list-row-score-badge"
                            style={{ backgroundColor: `${scoreColor}10`, color: scoreColor, border: `1.5px solid ${scoreColor}40` }}
                          >
                            {score}%
                          </div>
                          <div className="list-row-meta">
                            <span className="list-row-name">{prof.name}</span>
                            <span className="list-row-subtext">
                              {prof.university} • <span style={{ fontStyle: 'italic' }}>{prof.department_or_lab || 'Department'}</span>
                            </span>
                          </div>
                        </div>

                        <div className="list-row-actions">
                          <div className="list-row-stats-group">
                            <div className="list-row-stat">
                              <span className="list-row-stat-val">{prof.citations || '—'}</span>
                              <span className="list-row-stat-lbl">Citations</span>
                            </div>
                            <div className="list-row-stat">
                              <span className="list-row-stat-val">{prof.h_index || '—'}</span>
                              <span className="list-row-stat-lbl">H-Index</span>
                            </div>
                            <div className="list-row-stat">
                              <span className="list-row-stat-val">{prof.recent_papers?.length || 0}</span>
                              <span className="list-row-stat-lbl">Papers</span>
                            </div>
                          </div>

                          <div className="list-row-chevron" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                            ▼
                          </div>
                        </div>
                      </div>

                      {/* Accordion Content Drawer */}
                      {isExpanded && (
                        <div className="list-row-body-drawer">
                          <div className="list-row-body-inner">
                            <SupervisorCard
                              prof={prof}
                              onOpenEmail={openEmailModal}
                              playHoverSound={playHoverSound}
                              playClickSound={playClickSound}
                              isFlatCard={true} // Skip rendering border/padding wrappers since list row handles it
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
