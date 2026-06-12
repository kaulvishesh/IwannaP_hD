import React, { useState, useEffect, useRef, useMemo } from 'react';

// Lightweight sound engine replicating GlyphsLabs micro-interactions
let audioCtx = null;
const playTone = (freq, dur, vol, type = 'sine', sweepFreq = null) => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (sweepFreq) {
      // Rapid frequency sweep to produce a "crunchy" click pop
      osc.frequency.exponentialRampToValueAtTime(sweepFreq, audioCtx.currentTime + dur * 0.35);
    }
    
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch (err) {
    console.warn("Audio playback blocked or failed:", err);
  }
};

const playHoverSound = () => playTone(1200, 0.012, 0.008, 'triangle', 700);
const playClickSound = () => {
  playTone(800, 0.03, 0.025, 'triangle', 150);
  setTimeout(() => playTone(1600, 0.015, 0.012, 'sine'), 10);
};
const playSuccessSound = () => {
  playTone(523.25, 0.12, 0.02, 'sine', 1046.5);
  setTimeout(() => playTone(659.25, 0.12, 0.02, 'sine', 1318.5), 50);
  setTimeout(() => playTone(783.99, 0.22, 0.02, 'sine', 1568.0), 100);
};

// Redesigned SupervisorCard with self-contained tabs
function SupervisorCard({ prof, onOpenEmail, playHoverSound, playClickSound }) {
  const [activeTab, setActiveTab] = useState('outreach'); // 'outreach', 'papers', 'deepdive'

  const score = prof.match_analysis?.score || 0;
  
  // Custom color based on compatibility score
  let scoreColor = '#EF4444'; // default red
  if (score >= 80) scoreColor = '#10B981'; // emerald green
  else if (score >= 60) scoreColor = '#6366F1'; // indigo
  else if (score >= 40) scoreColor = '#F59E0B'; // amber/orange

  return (
    <div className="card prof-card">
      <div className="prof-card-header">
        <div className="prof-meta-container">
          <h4 className="prof-name">{prof.name}</h4>
          <span className="prof-uni">{prof.university}</span>
          {prof.department_or_lab && <span className="prof-lab">{prof.department_or_lab}</span>}
        </div>
        <div className="prof-match-badge-v2" style={{ backgroundColor: `${scoreColor}12`, color: scoreColor, border: `1px solid ${scoreColor}30` }}>
          {score}% Match
        </div>
      </div>

      <div className="prof-stats">
        <div className="prof-stat-item">
          <span className="stat-label">Citations</span>
          <span className="stat-value">{prof.citations || '—'}</span>
        </div>
        <div className="prof-stat-item">
          <span className="stat-label">H-Index</span>
          <span className="stat-value">{prof.h_index || '—'}</span>
        </div>
        <div className="prof-stat-item">
          <span className="stat-label">Works</span>
          <span className="stat-value">{prof.works_count || '—'}</span>
        </div>
      </div>

      <div className="prof-divider" />

      {/* Internal Card Navigation Tabs */}
      <div className="card-tabs">
        <button 
          className={`card-tab-btn ${activeTab === 'outreach' ? 'active' : ''}`}
          onClick={() => { playClickSound(); setActiveTab('outreach'); }}
          onPointerOver={playHoverSound}
        >
          🎯 Match Info
        </button>
        <button 
          className={`card-tab-btn ${activeTab === 'papers' ? 'active' : ''}`}
          onClick={() => { playClickSound(); setActiveTab('papers'); }}
          onPointerOver={playHoverSound}
        >
          📚 Papers ({prof.recent_papers?.length || 0})
        </button>
        <button 
          className={`card-tab-btn ${activeTab === 'deepdive' ? 'active' : ''}`}
          onClick={() => { playClickSound(); setActiveTab('deepdive'); }}
          onPointerOver={playHoverSound}
        >
          🔎 Deep Dive
        </button>
      </div>

      {/* Tab Content Panes */}
      <div className="card-tab-content">
        {activeTab === 'outreach' && (
          <div className="tab-pane-outreach animate-fade-in">
            <div className="compatibility-section">
              <div className="prof-section-title">Research Compatibility</div>
              <p className="tab-text overlap-text">
                {prof.match_analysis?.research_overlap || "Analyzing overlap..."}
              </p>
            </div>
            
            {prof.match_analysis?.custom_research_direction && (
              <div className="direction-section" style={{ marginTop: '14px' }}>
                <div className="prof-section-title">Proposed Direction</div>
                <p className="tab-text direction-text" style={{ fontStyle: 'italic' }}>
                  {prof.match_analysis.custom_research_direction}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'papers' && (
          <div className="tab-pane-papers animate-fade-in">
            <div className="prof-section-title">Recent Publications (OpenAlex)</div>
            {prof.recent_papers && prof.recent_papers.length > 0 ? (
              <ul className="prof-publications">
                {prof.recent_papers.map((paper, idx) => (
                  <li key={idx} className="prof-pub-item">
                    <span className="prof-pub-title">"{paper.title}"</span>
                    <span className="prof-pub-meta">
                      Year: {paper.publication_year} | Citations: {paper.cited_by_count || 0} | Source: {paper.journal || 'Unknown/Conference'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="tab-text-empty">No indexed publications found in OpenAlex.</p>
            )}
          </div>
        )}

        {activeTab === 'deepdive' && (
          <div className="tab-pane-deepdive animate-fade-in">
            <div className="prof-section-title">Public Sentiment & Social Media Evaluation</div>
            {prof.deep_dive ? (
              <div className="deep-dive-grid">
                <div className="deep-dive-item" onPointerOver={playHoverSound}>
                  <div className="deep-dive-header">
                    <span className="deep-dive-label">🌐 Social Presence</span>
                    <span className="deep-dive-score">{prof.deep_dive.social_presence?.score || 0}/10</span>
                  </div>
                  <div className="deep-dive-bar-bg">
                    <div className="deep-dive-bar-fill" style={{ width: `${(prof.deep_dive.social_presence?.score || 0) * 10}%` }} />
                  </div>
                  <p className="deep-dive-desc">{prof.deep_dive.social_presence?.description}</p>
                </div>

                <div className="deep-dive-item" onPointerOver={playHoverSound}>
                  <div className="deep-dive-header">
                    <span className="deep-dive-label">💬 Student Testimony</span>
                    <span className="deep-dive-score">{prof.deep_dive.student_testimony?.score || 0}/10</span>
                  </div>
                  <div className="deep-dive-bar-bg">
                    <div className="deep-dive-bar-fill" style={{ width: `${(prof.deep_dive.student_testimony?.score || 0) * 10}%` }} />
                  </div>
                  <p className="deep-dive-desc">{prof.deep_dive.student_testimony?.description}</p>
                </div>

                <div className="deep-dive-item" onPointerOver={playHoverSound}>
                  <div className="deep-dive-header">
                    <span className="deep-dive-label">🎓 Careers & Placements</span>
                    <span className="deep-dive-score">{prof.deep_dive.career_placements?.score || 0}/10</span>
                  </div>
                  <div className="deep-dive-bar-bg">
                    <div className="deep-dive-bar-fill" style={{ width: `${(prof.deep_dive.career_placements?.score || 0) * 10}%` }} />
                  </div>
                  <p className="deep-dive-desc">{prof.deep_dive.career_placements?.description}</p>
                </div>

                <div className="deep-dive-item" onPointerOver={playHoverSound}>
                  <div className="deep-dive-header">
                    <span className="deep-dive-label">⚖️ Beliefs & Opinions</span>
                    <span className="deep-dive-score">{prof.deep_dive.personal_beliefs?.score || 0}/10</span>
                  </div>
                  <div className="deep-dive-bar-bg">
                    <div className="deep-dive-bar-fill" style={{ width: `${(prof.deep_dive.personal_beliefs?.score || 0) * 10}%` }} />
                  </div>
                  <p className="deep-dive-desc">{prof.deep_dive.personal_beliefs?.description}</p>
                </div>
              </div>
            ) : (
              <p className="tab-text-empty">No deep-dive sentiment files cached.</p>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', gap: '12px' }}>
        <button 
          className="btn" 
          style={{ padding: '10px 16px', fontSize: '0.85rem' }}
          onClick={() => onOpenEmail(prof)}
          onPointerOver={playHoverSound}
        >
          Draft Outreach Proposal
        </button>
        
        {prof.website && (
          <a 
            href={prof.website} 
            target="_blank" 
            rel="noreferrer" 
            className="btn btn-secondary"
            style={{ padding: '10px 16px', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', width: 'auto' }}
            onPointerOver={playHoverSound}
            onClick={playClickSound}
          >
            Lab Link
          </a>
        )}
      </div>
    </div>
  );
}

// Force layout solver for node clustering
function computeForceLayout(nodesObj, edges, width = 750, height = 480) {
  if (!nodesObj || Object.keys(nodesObj).length === 0) return [];
  const nodeKeys = Object.keys(nodesObj);
  const layoutNodes = nodeKeys.map((key, i) => {
    const angle = (i / nodeKeys.length) * Math.PI * 2;
    const radius = Math.min(width, height) * 0.35;
    return {
      id: key,
      label: nodesObj[key].label,
      properties: nodesObj[key].properties,
      x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 10,
      y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 10,
    };
  });

  const nodeMap = {};
  layoutNodes.forEach(node => {
    nodeMap[node.id] = node;
  });

  const iterations = 100;
  const k = Math.sqrt((width * height) / (layoutNodes.length || 1)) * 0.8;

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion
    for (let i = 0; i < layoutNodes.length; i++) {
      const u = layoutNodes[i];
      for (let j = i + 1; j < layoutNodes.length; j++) {
        const v = layoutNodes[j];
        const dx = u.x - v.x;
        const dy = u.y - v.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 220) {
          const force = (k * k) / dist;
          const fx = (dx / dist) * force * 0.12;
          const fy = (dy / dist) * force * 0.12;
          u.x += fx;
          u.y += fy;
          v.x -= fx;
          v.y -= fy;
        }
      }
    }

    // Attraction
    edges.forEach(edge => {
      const u = nodeMap[edge.source];
      const v = nodeMap[edge.target];
      if (u && v) {
        const dx = u.x - v.x;
        const dy = u.y - v.y;
        const dist = Math.hypot(dx, dy) || 1;
        const force = (dist * dist) / k;
        const fx = (dx / dist) * force * 0.08;
        const fy = (dy / dist) * force * 0.08;
        u.x -= fx;
        u.y -= fy;
        v.x += fx;
        v.y += fy;
      }
    });

    // Constraints & Gravity
    layoutNodes.forEach(node => {
      const dx = width / 2 - node.x;
      const dy = height / 2 - node.y;
      node.x += dx * 0.015;
      node.y += dy * 0.015;
      node.x = Math.max(30, Math.min(width - 30, node.x));
      node.y = Math.max(30, Math.min(height - 30, node.y));
    });
  }

  return layoutNodes;
}

function MemoryGraphView({ memory, playClickSound, playHoverSound }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedNode, setDraggedNode] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const svgRef = useRef(null);

  const width = isExpanded ? 1200 : 850;
  const height = isExpanded ? 650 : 500;

  useEffect(() => {
    if (memory && memory.nodes && Object.keys(memory.nodes).length > 0) {
      const computed = computeForceLayout(memory.nodes, memory.edges, width, height);
      setNodes(computed);
    } else {
      setNodes([]);
    }
  }, [memory, width, height]);

  const coordsMap = useMemo(() => {
    const map = {};
    nodes.forEach(n => {
      map[n.id] = { x: n.x, y: n.y };
    });
    return map;
  }, [nodes]);

  const neighborNodeIds = useMemo(() => {
    if (!hoveredNode) return new Set();
    const neighbors = new Set([hoveredNode.id]);
    memory.edges.forEach(e => {
      if (e.source === hoveredNode.id) neighbors.add(e.target);
      if (e.target === hoveredNode.id) neighbors.add(e.source);
    });
    return neighbors;
  }, [hoveredNode, memory.edges]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.filter(n => {
      const name = (n.properties?.name || n.id).toLowerCase();
      const label = n.label.toLowerCase();
      return name.includes(q) || label.includes(q);
    });
  }, [nodes, searchQuery]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  const visibleEdges = useMemo(() => {
    return memory.edges.filter(edge => {
      return coordsMap[edge.source] && coordsMap[edge.target];
    });
  }, [memory.edges, coordsMap]);

  const handleMouseDown = (e, node) => {
    playClickSound();
    setSelectedNode(node);
    setDraggedNode(node);
  };

  const handleMouseMove = (e) => {
    if (!draggedNode || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const boundedX = Math.max(30, Math.min(width - 30, x));
    const boundedY = Math.max(30, Math.min(height - 30, y));

    setNodes(prev => prev.map(n => {
      if (n.id === draggedNode.id) {
        const updated = { ...n, x: boundedX, y: boundedY };
        setSelectedNode(updated);
        return updated;
      }
      return n;
    }));
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
  };

  useEffect(() => {
    if (draggedNode) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggedNode]);

  const getNodeColor = (label) => {
    switch (label) {
      case 'Candidate': return 'var(--gl-black)';
      case 'Interest': return '#8B5CF6';
      case 'University': return '#10B981';
      case 'Professor': return '#F59E0B';
      default: return '#6D6D6D';
    }
  };

  const connections = useMemo(() => {
    if (!selectedNode) return [];
    return memory.edges
      .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
      .map(e => {
        const otherId = e.source === selectedNode.id ? e.target : e.source;
        const otherNode = memory.nodes[otherId];
        return {
          relation: e.relation,
          node: otherNode,
          isSource: e.source === selectedNode.id
        };
      });
  }, [selectedNode, memory]);

  return (
    <div className="memory-dashboard-container animate-fade-in">
      <div className="memory-controls-bar">
        <input 
          type="text" 
          placeholder="Filter nodes by name or entity type..." 
          className="input-text graph-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {memory.updated_at && (
          <span className="memory-timestamp">
            Last Sync: {new Date(memory.updated_at).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className={`memory-layout-grid ${isExpanded ? 'grid-expanded' : ''}`}>
        <div className="card graph-card" style={{ padding: '12px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
            <button 
              className="btn btn-secondary" 
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.75rem', textTransform: 'none', backgroundColor: 'var(--gl-card-bg)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => { playClickSound(); setIsExpanded(!isExpanded); }}
              onPointerOver={playHoverSound}
            >
              {isExpanded ? '🗗 Collapse View' : '🗖 Expand View'}
            </button>
          </div>

          <svg 
            ref={svgRef} 
            viewBox={`0 0 ${width} ${height}`} 
            className="graph-svg"
            style={{ width: '100%', height: 'auto', display: 'block', maxHeight: isExpanded ? '650px' : '500px', transition: 'max-height 0.3s ease' }}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--gl-gray)" opacity="0.4" />
              </marker>
            </defs>

            {visibleEdges.map((edge, idx) => {
              const from = coordsMap[edge.source];
              const to = coordsMap[edge.target];
              if (!from || !to) return null;
              
              const isSelected = selectedNode && (selectedNode.id === edge.source || selectedNode.id === edge.target);
              
              // Hover highlight logic
              const isGraphHovered = hoveredNode !== null;
              const isEdgeConnectedToHover = hoveredNode && (hoveredNode.id === edge.source || hoveredNode.id === edge.target);
              
              const isSearching = searchQuery.trim().length > 0;
              const isHighlighted = isSearching 
                ? filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
                : (isGraphHovered ? isEdgeConnectedToHover : isSelected);

              let edgeOpacity = 0.25;
              if (isSearching) {
                edgeOpacity = isHighlighted ? 0.95 : 0.1;
              } else if (isGraphHovered) {
                edgeOpacity = isEdgeConnectedToHover ? 0.95 : 0.05;
              } else if (isSelected) {
                edgeOpacity = 0.95;
              }

              return (
                <g key={idx}>
                  <line 
                    x1={from.x} 
                    y1={from.y} 
                    x2={to.x} 
                    y2={to.y} 
                    className={isHighlighted ? "flow-line" : ""}
                    stroke={isHighlighted ? 'var(--gl-black)' : 'var(--gl-gray)'}
                    strokeWidth={isHighlighted ? 2.5 : 1.2}
                    strokeOpacity={edgeOpacity}
                    markerEnd="url(#arrow)"
                    style={{ transition: 'stroke-opacity 0.2s ease, stroke-width 0.2s ease, stroke 0.2s ease' }}
                  />
                  {isSelected && (
                    <text 
                      x={(from.x + to.x) / 2} 
                      y={(from.y + to.y) / 2 - 5}
                      fontSize="9"
                      fill="var(--gl-gray)"
                      textAnchor="middle"
                      className="edge-label"
                      style={{ pointerEvents: 'none', userSelect: 'none', fontWeight: 'bold' }}
                    >
                      {edge.relation}
                    </text>
                  )}
                </g>
              );
            })}

            {nodes.map((node) => {
              const isSelected = selectedNode && selectedNode.id === node.id;
              const isSearching = searchQuery.trim().length > 0;
              const isFiltered = isSearching && !filteredNodeIds.has(node.id);
              
              // Hover highlight logic
              const isGraphHovered = hoveredNode !== null;
              const isNeighbor = neighborNodeIds.has(node.id);
              
              let nodeOpacity = 1;
              if (isFiltered) {
                nodeOpacity = 0.15;
              } else if (isGraphHovered && !isNeighbor) {
                nodeOpacity = 0.2;
              }

              const nodeColor = getNodeColor(node.label);

              return (
                <g 
                  key={node.id} 
                  transform={`translate(${node.x}, ${node.y})`}
                  style={{ cursor: 'pointer', transition: draggedNode?.id === node.id ? 'none' : 'transform 0.1s ease' }}
                  onMouseDown={(e) => handleMouseDown(e, node)}
                  onPointerOver={() => { playHoverSound(); setHoveredNode(node); }}
                  onPointerOut={() => setHoveredNode(null)}
                >
                  {/* Rotating orbital grids for hovered or selected node */}
                  {(isSelected || (hoveredNode && hoveredNode.id === node.id)) && (
                    <>
                      <circle 
                        r="34" 
                        fill="none" 
                        stroke={nodeColor} 
                        strokeWidth="1.2" 
                        strokeDasharray="5,4" 
                        className="node-orbit"
                        style={{ opacity: nodeOpacity * 0.7 }}
                      />
                      <circle 
                        r="28" 
                        fill="none" 
                        stroke={nodeColor} 
                        strokeWidth="0.8" 
                        strokeDasharray="3,5" 
                        className="node-orbit-counter"
                        style={{ opacity: nodeOpacity * 0.5 }}
                      />
                    </>
                  )}
                  {/* Diamond shape representing a stellar space coordinate */}
                  <polygon 
                    points={isSelected ? "0,-22 22,0 0,22 -22,0" : "0,-16 16,0 0,16 -16,0"}
                    fill={nodeColor} 
                    stroke="var(--gl-light)" 
                    strokeWidth="3.2"
                    style={{ 
                      opacity: nodeOpacity,
                      filter: isSelected ? 'drop-shadow(0px 4px 12px rgba(0,0,0,0.3))' : 'drop-shadow(0px 2px 6px rgba(0,0,0,0.15))',
                      transition: 'points 0.2s ease, opacity 0.2s ease, fill 0.2s ease'
                    }}
                  />
                  <text
                    y="28"
                    textAnchor="middle"
                    fontSize="10.5"
                    fontWeight={isSelected ? 'bold' : '600'}
                    fill="var(--gl-black)"
                    style={{ 
                      opacity: nodeOpacity,
                      pointerEvents: 'none',
                      userSelect: 'none',
                      fontFamily: 'var(--font-sans)',
                      transition: 'opacity 0.2s ease'
                    }}
                  >
                    {node.properties?.name || node.id}
                  </text>
                  {isSelected && (
                    <text
                      y="-24"
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="bold"
                      fill={nodeColor}
                      style={{ pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                      {node.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="graph-instructions">
            <span>💡 Click & drag nodes to organize. Hover to highlight connections. Select to inspect relations.</span>
          </div>
        </div>

        <div className="card detail-inspector-card">
          {selectedNode ? (
            <div className="animate-fade-in">
              <span className="hero-label" style={{ color: getNodeColor(selectedNode.label), fontWeight: 'bold' }}>
                {selectedNode.label} Entity
              </span>
              <h3 className="inspector-title">{selectedNode.properties?.name || selectedNode.id}</h3>
              
              <div className="prof-divider" style={{ margin: '16px 0' }} />

              <div className="inspector-properties">
                {selectedNode.label === 'Candidate' && (
                  <div className="prop-row">
                    <span className="prop-key">Academic Stage</span>
                    <span className="prop-value">{selectedNode.properties?.academic_level || '—'}</span>
                  </div>
                )}

                {selectedNode.label === 'Professor' && (
                  <>
                    <div className="prop-row">
                      <span className="prop-key">Department</span>
                      <span className="prop-value">{selectedNode.properties?.department || '—'}</span>
                    </div>
                    <div className="prop-row">
                      <span className="prop-key">Citations</span>
                      <span className="prop-value">{selectedNode.properties?.citations || '—'}</span>
                    </div>
                    <div className="prop-row">
                      <span className="prop-key">H-Index</span>
                      <span className="prop-value">{selectedNode.properties?.h_index || '—'}</span>
                    </div>
                  </>
                )}

                {selectedNode.label === 'University' && (
                  <div className="prop-row">
                    <span className="prop-key">University Name</span>
                    <span className="prop-value">{selectedNode.properties?.name || '—'}</span>
                  </div>
                )}

                {selectedNode.label === 'Interest' && (
                  <div className="prop-row">
                    <span className="prop-key">Research Field</span>
                    <span className="prop-value">{selectedNode.properties?.name || '—'}</span>
                  </div>
                )}
              </div>

              <h4 className="relations-header">Active Memory Relations</h4>
              {connections.length > 0 ? (
                <ul className="relations-list">
                  {connections.map((conn, idx) => {
                    if (!conn.node) return null;
                    const nodeColor = getNodeColor(conn.node.label);
                    return (
                      <li key={idx} className="relation-item">
                        <span className="relation-badge" style={{ borderLeft: `3px solid ${nodeColor}` }}>
                          {conn.relation}
                        </span>
                        <div 
                          className="relation-dest" 
                          onClick={() => { 
                            playClickSound(); 
                            const targetNode = nodes.find(n => n.id === conn.node.id);
                            if (targetNode) setSelectedNode(targetNode);
                          }}
                        >
                          <strong>{conn.node.properties?.name || conn.node.id}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--gl-gray)', marginLeft: '6px' }}>({conn.node.label})</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="tab-text-empty" style={{ fontSize: '0.8rem' }}>No relationships mapped for this node.</p>
              )}
            </div>
          ) : (
            <div className="inspector-placeholder">
              <span>🔎 Click any node in the Knowledge Graph to inspect properties and memory relations.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [splashFade, setSplashFade] = useState(false);
  const [searchRunning, setSearchRunning] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState('directory'); // 'directory' or 'memory'
  const [memory, setMemory] = useState({ nodes: {}, edges: [], updated_at: null });
  
  // Data state
  const [uploadedFile, setUploadedFile] = useState('');
  const [candidateProfile, setCandidateProfile] = useState(null);
  const [supervisors, setSupervisors] = useState([]);
  const [selectedProf, setSelectedProf] = useState(null);
  const [editedEmailBody, setEditedEmailBody] = useState('');
  const [editedEmailSubject, setEditedEmailSubject] = useState('');
  
  // Logs console state
  const [logs, setLogs] = useState([
    { text: 'ScholarFlow Supervisor Agent ready.', type: 'greet' },
    { text: 'Upload your academic resume to launch search...', type: 'gray' }
  ]);
  
  const consoleEndRef = useRef(null);
  const splashCanvasRef = useRef(null);

  // Load theme and initial candidate profile
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const fetchMemory = () => {
    fetch("http://localhost:8000/api/memory")
      .then(res => {
        if (!res.ok) throw new Error("Memory API failed");
        return res.json();
      })
      .then(data => {
        setMemory(data);
      })
      .catch(err => {
        console.warn("No memory graph fetched:", err);
      });
  };

  useEffect(() => {
    // Fetch cached matches if present
    fetch("http://localhost:8000/api/supervisors")
      .then(res => res.json())
      .then(data => {
        if (data.candidate && data.candidate.name) {
          setCandidateProfile(data.candidate);
          setSupervisors(data.matches || []);
          addLog("Loaded cached supervisor finder matches from supervisor_matches.json", "log");
        }
      })
      .catch(err => {
        console.warn("No supervisor matches fetched:", err);
      });

    fetchMemory();
  }, []);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Canvas glitch splash loader animation
  useEffect(() => {
    if (!showSplash) return;
    const canvas = splashCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    
    // Abstract grid symbol particles representing ScholarFlow logo (cap/cube structure)
    const particlePoints = [
      { x: 0, y: -20 }, { x: -30, y: 0 }, { x: 30, y: 0 }, { x: 0, y: 20 }, // diamond core
      { x: -60, y: 0 }, { x: 60, y: 0 }, // extremities
      { x: -30, y: -40 }, { x: 30, y: -40 }, // upper horns
      { x: 0, y: -60 }, // apex
      { x: 0, y: 60 } // bottom tassel
    ];
    
    const particles = particlePoints.map(p => {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.max(w, h) * (0.6 + Math.random() * 0.4);
      return {
        tx: w / 2 + p.x * 2.5,
        ty: h / 2 + p.y * 2.5,
        x: w / 2 + Math.cos(angle) * dist,
        y: h / 2 + Math.sin(angle) * dist,
        char: "◇◈◆♦"[Math.floor(Math.random() * 4)],
        delay: Math.random() * 20
      };
    });

    let frame = 0;
    let convergeDuration = 60;
    let glitchDuration = 30;
    let holdDuration = 10;
    
    const drawAnimation = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#F2F2F2';
      ctx.font = "700 12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let allConverged = true;
      
      particles.forEach((p, idx) => {
        if (frame > p.delay) {
          const t = Math.min(1, (frame - p.delay) / convergeDuration);
          const ease = 1 - Math.pow(1 - t, 4); // Quartic ease out
          p.x = p.x + (p.tx - p.x) * ease;
          p.y = p.y + (p.ty - p.y) * ease;
          if (t < 1) allConverged = false;
        } else {
          allConverged = false;
        }
        ctx.fillText(p.char, p.x, p.y);
      });
      
      // Draw text
      if (frame > 40) {
        const textFade = Math.min(1, (frame - 40) / 30);
        ctx.fillStyle = `rgba(242, 242, 242, ${textFade})`;
        ctx.font = "600 14px 'Space Grotesk', sans-serif";
        ctx.fillText("SCHOLARFLOW", w / 2, h / 2 + 190);
        ctx.font = "400 10px 'JetBrains Mono', monospace";
        ctx.fillStyle = `rgba(109, 109, 109, ${textFade})`;
        ctx.fillText("AGENTIC RESEARCH HUB", w / 2, h / 2 + 215);
      }
      
      frame++;
      
      if (allConverged && frame > convergeDuration + holdDuration) {
        // Trigger Glitch phase
        let glitchFrame = 0;
        const drawGlitch = () => {
          ctx.clearRect(0, 0, w, h);
          const flash = 1 - (glitchFrame / glitchDuration);
          const split = 4 * flash;
          
          ctx.font = "700 12px 'JetBrains Mono', monospace";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          if (flash > 0.05) {
            ctx.fillStyle = `rgba(255, 0, 0, ${flash * 0.8})`;
            particles.forEach(p => ctx.fillText(p.char, p.tx + split, p.ty));
            
            ctx.fillStyle = `rgba(0, 0, 255, ${flash * 0.8})`;
            particles.forEach(p => ctx.fillText(p.char, p.tx - split, p.ty));
          }
          
          ctx.fillStyle = '#F2F2F2';
          particles.forEach(p => {
            const mutatedChar = Math.random() < 0.15 * (1 - flash) 
              ? "!<>-_/\\|:;=+*^?"[Math.floor(Math.random() * 15)] 
              : p.char;
            ctx.fillText(mutatedChar, p.tx, p.ty);
          });
          
          ctx.fillStyle = `rgba(242, 242, 242, 0.95)`;
          ctx.font = "600 14px 'Space Grotesk', sans-serif";
          ctx.fillText("SCHOLARFLOW", w / 2, h / 2 + 190);
          ctx.font = "400 10px 'JetBrains Mono', monospace";
          ctx.fillStyle = `rgba(109, 109, 109, 0.95)`;
          ctx.fillText("AGENTIC RESEARCH HUB", w / 2, h / 2 + 215);
          
          glitchFrame++;
          if (glitchFrame < glitchDuration) {
            requestAnimationFrame(drawGlitch);
          } else {
            setSplashFade(true);
            setTimeout(() => {
              setShowSplash(false);
              playSuccessSound();
            }, 800);
          }
        };
        requestAnimationFrame(drawGlitch);
      } else {
        requestAnimationFrame(drawAnimation);
      }
    };
    
    requestAnimationFrame(drawAnimation);
    
    const handleResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showSplash]);

  const addLog = (text, type = 'log') => {
    setLogs(prev => [...prev, { text, type }]);
  };

  // Trigger file upload and backend parsing
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    playClickSound();
    setUploadedFile(file.name);
    addLog(`Uploading file: ${file.name}...`, 'cmd');

    const formData = new FormData();
    formData.append("file", file);

    fetch("http://localhost:8000/api/upload-resume", {
      method: "POST",
      body: formData
    })
      .then(res => {
        if (!res.ok) throw new Error("Upload failed");
        return res.json();
      })
      .then(data => {
        addLog(`File successfully uploaded & saved to: ${data.saved_path}`, 'log');
        // Trigger Search automatically
        triggerSupervisorSearch(data.saved_path);
      })
      .catch(err => {
        addLog(`Upload error: ${err.message}`, 'error');
      });
  };

  // Trigger search pipeline via WebSockets
  const triggerSupervisorSearch = (savedPath) => {
    setSearchRunning(true);
    setLogs([]);
    addLog(`Connecting to ws://localhost:8000/ws/run-search`, 'h');
    
    const ws = new WebSocket("ws://localhost:8000/ws/run-search");
    
    ws.onopen = () => {
      addLog(`WebSocket connection open. Sending start request for resume path: ${savedPath}`, 'log');
      ws.send(JSON.stringify({ resume_filename: savedPath }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        addLog(data.message, 'log');
      } else if (data.type === 'status') {
        addLog(`[Status] ${data.message}`, 'h');
      } else if (data.type === 'complete') {
        setSearchRunning(false);
        setCandidateProfile(data.data.candidate);
        setSupervisors(data.data.matches);
        addLog(`Pipeline complete! Found and parsed ${data.data.matches.length} matching supervisors.`, 'greet');
        playSuccessSound();
        fetchMemory();
        ws.close();
      } else if (data.type === 'error') {
        setSearchRunning(false);
        addLog(`[Pipeline Error] ${data.message}`, 'error');
        ws.close();
      }
    };

    ws.onerror = (err) => {
      setSearchRunning(false);
      addLog(`WebSocket connection error. Make sure FastAPI server is running on port 8000.`, 'error');
    };

    ws.onclose = () => {
      setSearchRunning(false);
      addLog("WebSocket connection closed.", 'gray');
    };
  };

  // Email draft editor drawer
  const openEmailModal = (prof) => {
    playClickSound();
    setSelectedProf(prof);
    setEditedEmailSubject(prof.match_analysis.email_subject);
    setEditedEmailBody(prof.match_analysis.email_body);
  };

  const closeEmailModal = () => {
    playClickSound();
    setSelectedProf(null);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(editedEmailBody);
    playSuccessSound();
    alert("Email body copied to clipboard!");
  };

  return (
    <>
      {/* Splash Screen */}
      {showSplash && (
        <div className={`gl-splash ${splashFade ? 'slide-up' : ''}`}>
          <canvas ref={splashCanvasRef} className="gl-splash-canvas" />
          <div className="gl-splash-fallback">INITIALIZING SYSTEM...</div>
        </div>
      )}

      {/* Main Layout */}
      <div id="root">
        <header className="app-header">
          <div className="logo-container" onClick={() => { playClickSound(); }}>
            <span className="logo-dot"></span>
            ScholarFlow
            <span className="logo-subtitle">Supervisor Agent</span>
          </div>
          
          <ul className="nav-links">
            <li>
              <button 
                className={`nav-btn ${activeMainTab === 'directory' ? 'active' : ''}`}
                onClick={() => { playClickSound(); setActiveMainTab('directory'); }}
              >
                📁 Directory
              </button>
            </li>
            <li>
              <button 
                className={`nav-btn ${activeMainTab === 'memory' ? 'active' : ''}`}
                onClick={() => { playClickSound(); setActiveMainTab('memory'); }}
              >
                🧠 Agent Memory
              </button>
            </li>
            <li>
              <button className="theme-toggle" onClick={() => { playClickSound(); setDarkMode(!darkMode); }}>
                {darkMode ? '☀️ LIGHT' : '🌙 DARK'}
              </button>
            </li>
          </ul>
        </header>

        <main className="main-content">
          {/* Hero Header */}
          <section className="hero-section">
            <span className="hero-label">Autonomous Academic Agent</span>
            <h1 className="hero-title">Find Your <em>Research Supervisor</em></h1>
            <p className="hero-description">
              Upload your academic resume, portfolio, or statement of purpose. ScholarFlow will autonomously parse your profile, 
              conduct a global web search using Google grounding, fetch publication indexes from OpenAlex, evaluate compatibility, 
              and write tailored cold email drafts.
            </p>
          </section>

          {/* Unified Dashboard Grid */}
          <div className="dashboard-grid">
            
            {/* Sidebar Column: Intake, Profile, & Live Logs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Controls card */}
              <div className="card">
                <h3 className="card-title">Intake & Controls</h3>
                
                <div className="form-group">
                  <span className="form-label">Step 1: Upload Portfolio / Resume</span>
                  <label className="file-uploader">
                    <input 
                      type="file" 
                      accept=".pdf,.txt,.md" 
                      onChange={handleFileUpload} 
                      style={{ display: 'none' }} 
                    />
                    <div className="file-uploader-icon">📂</div>
                    <div className="file-uploader-text">
                      {uploadedFile ? uploadedFile : "Drag & drop PDF/TXT or Click to browse"}
                    </div>
                  </label>
                </div>

                {candidateProfile && (
                  <div style={{ marginTop: '24px', animation: 'fadeIn 0.4s ease-out' }}>
                    <span className="form-label">Parsed Academic Profile</span>
                    <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>{candidateProfile.name}</p>
                    <p style={{ color: 'var(--gl-gray)', fontSize: '0.85rem' }}>Stage: {candidateProfile.academic_level}</p>
                    
                    <span className="form-label" style={{ marginTop: '16px' }}>Research Domains</span>
                    <div className="profile-pill-container">
                      {candidateProfile.research_interests.map((interest, idx) => (
                        <span key={idx} className="profile-pill">{interest}</span>
                      ))}
                    </div>
                  </div>
                )}

                {uploadedFile && (
                  <button 
                    className="btn" 
                    style={{ marginTop: '24px' }}
                    onClick={() => triggerSupervisorSearch(uploadedFile)}
                    disabled={searchRunning}
                  >
                    {searchRunning ? 'Searching...' : 'Re-Run Search Pipeline'}
                  </button>
                )}
              </div>

              {/* Integrated Sidebar Terminal (Visual Command Center) */}
              <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '380px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`console-pulse-dot ${searchRunning ? 'running' : ''}`} />
                    Agent Logs Terminal
                  </h4>
                  <button 
                    onClick={() => { playClickSound(); setLogs([{ text: 'Console cleared.', type: 'gray' }]); }}
                    className="btn btn-secondary" 
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.7rem', textTransform: 'none' }}
                  >
                    Clear
                  </button>
                </div>
                <div style={{ flex: 1, backgroundColor: '#090d16', borderRadius: '8px', padding: '14px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', lineHeight: '1.45', color: '#c5c9db' }}>
                  {logs.map((log, idx) => (
                    <div key={idx} className={`console-line console-${log.type}`} style={{ marginBottom: '5px', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                      {log.text}
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>
              </div>

            </div>

            {/* Main Column: directory or memory graph */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {activeMainTab === 'directory' ? (
                <>
                  <h3 className="card-title" style={{ marginBottom: '0px' }}>
                    {supervisors.length > 0 ? `Matched Supervisors (${supervisors.length})` : "Matched Directory"}
                  </h3>
                  
                  {supervisors.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '80px', color: 'var(--gl-gray)', display: 'flex', flexDirection: 'column', justify: 'center', alignItems: 'center', minHeight: '350px' }}>
                      <span style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</span>
                      Awaiting candidate portfolio upload to begin search...
                    </div>
                  ) : (
                    <div className="results-grid">
                      {supervisors.map((prof) => (
                        <SupervisorCard 
                          key={prof.id} 
                          prof={prof} 
                          onOpenEmail={openEmailModal} 
                          playHoverSound={playHoverSound} 
                          playClickSound={playClickSound} 
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h3 className="card-title" style={{ marginBottom: '0px' }}>
                    Knowledge Memory Graph
                  </h3>
                  <MemoryGraphView 
                    memory={memory} 
                    playClickSound={playClickSound} 
                    playHoverSound={playHoverSound} 
                  />
                </>
              )}
            </div>

          </div>
        </main>

        {/* Email outreach proposal modal */}
        {selectedProf && (
          <div className="email-modal animate-fade-in">
            <div className="email-modal-content">
              <div className="email-modal-header">
                <span className="hero-label">Custom Outreach Writer</span>
                <button className="email-close" onClick={closeEmailModal}>×</button>
              </div>

              <div>
                <h3 className="prof-name">Cold Outreach to {selectedProf.name}</h3>
                <span className="prof-uni">{selectedProf.university}</span>
              </div>

              <div className="email-meta-input">
                <div>
                  <strong>To:</strong> {selectedProf.email || "No email parsed (Use website contact page)"}
                </div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <strong>Subject:</strong> 
                  <input 
                    type="text" 
                    className="input-text" 
                    style={{ padding: '6px 12px', fontSize: '0.85rem' }} 
                    value={editedEmailSubject}
                    onChange={(e) => setEditedEmailSubject(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <span className="form-label">Email Body</span>
                <textarea 
                  className="email-body-editor"
                  value={editedEmailBody}
                  onChange={(e) => setEditedEmailBody(e.target.value)}
                />
              </div>

              <div className="email-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={handleCopyToClipboard}
                  onPointerOver={playHoverSound}
                >
                  Copy Content
                </button>
                <a 
                  href={`mailto:${selectedProf.email || ''}?subject=${encodeURIComponent(editedEmailSubject)}&body=${encodeURIComponent(editedEmailBody)}`}
                  className="btn"
                  style={{ textDecoration: 'none' }}
                  onPointerOver={playHoverSound}
                  onClick={() => { playClickSound(); closeEmailModal(); }}
                >
                  Send via Mail Client
                </a>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
