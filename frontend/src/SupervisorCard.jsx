import React, { useState } from 'react';

export default function SupervisorCard({ 
  prof, 
  onOpenEmail, 
  playHoverSound, 
  playClickSound, 
  isFlatCard = false 
}) {
  const [activeTab, setActiveTab] = useState('outreach'); // 'outreach', 'papers', 'deepdive'

  const score = prof.match_analysis?.score || 0;
  
  // Custom color based on compatibility score
  let scoreColor = '#EF4444'; // default red
  if (score >= 80) scoreColor = '#10B981'; // emerald green
  else if (score >= 60) scoreColor = '#6366F1'; // indigo
  else if (score >= 40) scoreColor = '#F59E0B'; // amber/orange

  const renderContent = () => {
    return (
      <>
        <div className="prof-card-header">
          <div className="prof-meta-container">
            <h4 className="prof-name">{prof.name}</h4>
            <span className="prof-uni">{prof.university}</span>
            {prof.department_or_lab && <span className="prof-lab">{prof.department_or_lab}</span>}
          </div>
          {!isFlatCard && (
            <div className="prof-match-badge-v2" style={{ backgroundColor: `${scoreColor}12`, color: scoreColor, border: `1px solid ${scoreColor}30` }}>
              {score}% Match
            </div>
          )}
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
        <div className="card-tab-content" style={{ minHeight: '140px' }}>
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
                <ul className="prof-publications" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  {prof.recent_papers.map((paper, idx) => (
                    <li key={idx} className="prof-pub-item" style={{ marginBottom: '8px' }}>
                      <span className="prof-pub-title" style={{ fontWeight: 600, fontSize: '0.82rem' }}>"{paper.title}"</span>
                      <span className="prof-pub-meta" style={{ fontSize: '0.72rem', color: 'var(--gl-gray)', display: 'block', marginTop: '2px' }}>
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

        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--gl-border)', display: 'flex', gap: '12px' }}>
          <button 
            className="btn" 
            style={{ padding: '10px 16px', fontSize: '0.85rem', width: 'auto' }}
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
              style={{ padding: '10px 16px', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'auto' }}
              onPointerOver={playHoverSound}
              onClick={playClickSound}
            >
              Lab Link
            </a>
          )}
        </div>
      </>
    );
  };

  if (isFlatCard) {
    return (
      <div className="prof-card-inner-flat" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="card prof-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', overflow: 'hidden' }}>
      {renderContent()}
    </div>
  );
}
