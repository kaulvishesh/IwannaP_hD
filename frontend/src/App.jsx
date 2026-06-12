import React, { useState, useEffect, useRef } from 'react';

// Lightweight sound engine replicating GlyphsLabs micro-interactions
let audioCtx = null;
const playTone = (freq, dur, vol, type = 'sine') => {
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
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch (err) {
    console.warn("Audio playback blocked or failed:", err);
  }
};

const playHoverSound = () => playTone(1100, 0.025, 0.015, 'sine');
const playClickSound = () => {
  playTone(660, 0.08, 0.04, 'sine');
  setTimeout(() => playTone(990, 0.04, 0.02, 'sine'), 30);
};
const playSuccessSound = () => {
  playTone(523.25, 0.15, 0.05, 'sine'); // C5
  setTimeout(() => playTone(659.25, 0.15, 0.05, 'sine'), 80); // E5
  setTimeout(() => playTone(783.99, 0.3, 0.05, 'sine'), 160); // G5
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

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [splashFade, setSplashFade] = useState(false);
  const [searchRunning, setSearchRunning] = useState(false);
  
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

            {/* Main Column: Supervisor Directory */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
