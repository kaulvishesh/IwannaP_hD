import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function CosmicMap3D({
  memory,
  supervisors,
  selectedNode,
  setSelectedNode,
  hoveredNode,
  setHoveredNode,
  searchQuery,
  getNodeColor,
  playClickSound,
  playHoverSound,
  darkMode
}) {
  const mountRef = useRef(null);
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);

  // Store interactive states in refs to prevent WebGL teardown and view resets
  const selectedNodeRef = useRef(selectedNode);
  const hoveredNodeRef = useRef(hoveredNode);
  const searchQueryRef = useRef(searchQuery);

  useEffect(() => { selectedNodeRef.current = selectedNode; }, [selectedNode]);
  useEffect(() => { hoveredNodeRef.current = hoveredNode; }, [hoveredNode]);
  useEffect(() => { searchQueryRef.current = searchQuery; }, [searchQuery]);

  // Group database nodes
  const { interests, universities, professors, candidate } = useMemo(() => {
    let candidate = null;
    const interests = [];
    const universities = [];
    const professors = [];

    if (memory && memory.nodes) {
      Object.keys(memory.nodes).forEach(key => {
        const node = memory.nodes[key];
        if (node.label === 'Candidate') candidate = node;
        else if (node.label === 'Interest') interests.push(node);
        else if (node.label === 'University') universities.push(node);
        else if (node.label === 'Professor') professors.push(node);
      });
    }
    return { interests, universities, professors, candidate };
  }, [memory]);

  // Orbit ring setups
  const orbitConfig = useMemo(() => {
    return {
      Interest: { radius: 6, speed: 1.25, color: '#8B5CF6' },
      University: { radius: 11, speed: 0.75, color: '#10B981' },
      Professor: { radius: 17, speed: 0.4, color: '#F59E0B' }
    };
  }, []);

  // Compute search matches dynamically
  const filteredNodeIds = useMemo(() => {
    const ids = new Set();
    if (!memory || !memory.nodes) return ids;
    const q = searchQuery.trim().toLowerCase();
    
    Object.keys(memory.nodes).forEach(key => {
      const node = memory.nodes[key];
      const name = (node.properties?.name || node.id).toLowerCase();
      const label = node.label.toLowerCase();
      if (!q || name.includes(q) || label.includes(q)) {
        ids.add(node.id);
      }
    });
    return ids;
  }, [memory, searchQuery]);

  // Keep ref of filtered node IDs for animation loop closure
  const filteredNodeIdsRef = useRef(filteredNodeIds);
  useEffect(() => { filteredNodeIdsRef.current = filteredNodeIds; }, [filteredNodeIds]);

  // Main 3D Scene Effect (Only re-runs on memory DB changes or light/dark toggles)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 16, 26);
    cameraRef.current = camera;

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // Transparent to reveal theme gradient
    container.appendChild(renderer.domElement);

    // 3. OrbitControls (Preserved between state modifications)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 4;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Keep camera above orbital floor
    controlsRef.current = controls;

    // 4. Lights: Central PointLight simulating solar emissions
    const ambientLight = new THREE.AmbientLight(
      darkMode ? 0x0f1524 : 0xdddddd, 
      darkMode ? 0.45 : 0.85
    );
    scene.add(ambientLight);

    // High intensity solar light source in the center
    const solarLight = new THREE.PointLight(
      darkMode ? 0xffaa33 : 0x888888, 
      darkMode ? 5.2 : 1.8, 
      70, 
      0.4
    );
    solarLight.position.set(0, 0, 0);
    scene.add(solarLight);

    // 5. Cosmic Starfield Drift
    const starCount = darkMode ? 1500 : 500;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starColorBase = darkMode ? new THREE.Color(0xffffff) : new THREE.Color(0x6d6d6d);

    for (let i = 0; i < starCount * 3; i += 3) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 45 + Math.random() * 55; // Shell from 45 to 100

      starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = r * Math.cos(phi);

      const luminance = 0.4 + Math.random() * 0.6;
      starColors[i] = starColorBase.r * luminance;
      starColors[i + 1] = starColorBase.g * luminance;
      starColors[i + 2] = starColorBase.b * luminance;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true
    });

    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // 6. Volumetric Planetary Dust Disc Rings (Replacing solid line guides)
    const dustGroup = new THREE.Group();
    scene.add(dustGroup);

    const buildDustRing = (radius, count, colorHex) => {
      const dustGeom = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const baseColor = new THREE.Color(colorHex);

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
        const r = radius + (Math.random() - 0.5) * 0.32; // width thickness of ring
        positions[i * 3] = Math.cos(angle) * r;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 0.08; // slight height variance
        positions[i * 3 + 2] = Math.sin(angle) * r;

        const luminance = 0.4 + Math.random() * 0.6;
        colors[i * 3] = baseColor.r * luminance;
        colors[i * 3 + 1] = baseColor.g * luminance;
        colors[i * 3 + 2] = baseColor.b * luminance;
      }

      dustGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      dustGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const dustMat = new THREE.PointsMaterial({
        size: 0.085,
        vertexColors: true,
        transparent: true,
        opacity: darkMode ? 0.4 : 0.2,
        sizeAttenuation: true
      });

      const dustPoints = new THREE.Points(dustGeom, dustMat);
      dustGroup.add(dustPoints);
      return dustPoints;
    };

    const dustRingInner = buildDustRing(6, 220, '#8B5CF6');
    const dustRingMiddle = buildDustRing(11, 380, '#10B981');
    const dustRingOuter = buildDustRing(17, 550, '#F59E0B');

    // 7. Central Glowing Sun Core (Candidate Center Node)
    const sunColor = darkMode ? 0xffeaad : 0x212121;
    const sunGeom = new THREE.SphereGeometry(0.85, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: sunColor });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    scene.add(sunMesh);

    // Glowing Corona Halo Shell (Volumetric Source representation)
    const coronaColor = darkMode ? 0xff9900 : 0x666666;
    const coronaGeom = new THREE.SphereGeometry(1.65, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: coronaColor,
      transparent: true,
      opacity: darkMode ? 0.16 : 0.08,
      blending: THREE.AdditiveBlending
    });
    const coronaMesh = new THREE.Mesh(coronaGeom, coronaMat);
    scene.add(coronaMesh);

    // Decorative flat spinning grid ring
    const sunRingGeom = new THREE.RingGeometry(1.2, 1.25, 32);
    sunRingGeom.rotateX(Math.PI / 2);
    const sunRingMat = new THREE.MeshBasicMaterial({
      color: sunColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25
    });
    const sunRing = new THREE.Mesh(sunRingGeom, sunRingMat);
    scene.add(sunRing);

    // 8. Billboard Label Texture cache
    const labelCache = {};
    const textHexColor = darkMode ? '#F2F2F2' : '#212121';

    const getOrCreateLabelSprite = (text, typeColor) => {
      const cacheKey = `${text}_${textHexColor}`;
      if (labelCache[cacheKey]) return labelCache[cacheKey].clone();

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 512, 128);

      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Type Badge label (interest, prof, uni)
      ctx.font = "bold 20px 'JetBrains Mono', monospace";
      ctx.fillStyle = typeColor;
      ctx.fillText(text.length > 20 ? text.slice(0, 18) + ".." : text, 256, 35);

      // Main Node text
      ctx.font = "bold 28px 'Space Grotesk', sans-serif";
      ctx.fillStyle = textHexColor;
      ctx.fillText(text, 256, 75);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;

      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      });

      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(4, 1, 1);

      labelCache[cacheKey] = sprite;
      return sprite;
    };

    // 9. Node coordinates setup
    const nodeGroup = new THREE.Group();
    scene.add(nodeGroup);

    const interactiveNodeMeshes = [];
    const nodeMeshesMap = {};

    const buildNode3D = (node, groupIndex, groupTotal) => {
      const label = node.label;
      const config = orbitConfig[label];
      if (!config) return;

      const nodeColorVal = new THREE.Color(config.color);

      let geom;
      if (label === 'Interest') {
        geom = new THREE.OctahedronGeometry(0.32);
      } else if (label === 'University') {
        geom = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      } else {
        geom = new THREE.IcosahedronGeometry(0.38);
      }

      // Phong material react to light source from center Sun
      const mat = new THREE.MeshPhongMaterial({
        color: nodeColorVal,
        shininess: 90,
        emissive: nodeColorVal,
        emissiveIntensity: 0.08
      });

      const coreMesh = new THREE.Mesh(geom, mat);
      
      const collisionGeom = new THREE.SphereGeometry(0.6, 8, 8);
      const collisionMat = new THREE.MeshBasicMaterial({ visible: false });
      const containerMesh = new THREE.Mesh(collisionGeom, collisionMat);
      containerMesh.add(coreMesh);
      
      containerMesh.userData = { node };
      
      // Wireframe cage
      const cageGeom = new THREE.SphereGeometry(0.52, 6, 6);
      const cageMat = new THREE.MeshBasicMaterial({
        color: nodeColorVal,
        wireframe: true,
        transparent: true,
        opacity: 0.15
      });
      const cageMesh = new THREE.Mesh(cageGeom, cageMat);
      containerMesh.add(cageMesh);

      // Create Floating text labels
      const displayName = node.properties?.name || node.id;
      const labelSprite = getOrCreateLabelSprite(displayName, config.color);
      labelSprite.position.set(0, 0.85, 0);
      containerMesh.add(labelSprite);

      nodeGroup.add(containerMesh);
      interactiveNodeMeshes.push(containerMesh);

      const baseAngle = (groupIndex / (groupTotal || 1)) * Math.PI * 2;

      nodeMeshesMap[node.id] = {
        container: containerMesh,
        core: coreMesh,
        cage: cageMesh,
        labelSprite,
        baseAngle,
        config,
        nodeId: node.id
      };
    };

    interests.forEach((n, idx) => buildNode3D(n, idx, interests.length));
    universities.forEach((n, idx) => buildNode3D(n, idx, universities.length));
    professors.forEach((n, idx) => buildNode3D(n, idx, professors.length));

    if (candidate) {
      sunMesh.userData = { node: candidate };
      interactiveNodeMeshes.push(sunMesh);
      nodeMeshesMap[candidate.id] = {
        container: sunMesh,
        core: sunMesh,
        cage: sunRing,
        labelSprite: null,
        baseAngle: 0,
        config: { radius: 0 },
        nodeId: candidate.id
      };
    }

    // 10. Links & Edge lines setup
    const edgeGroup = new THREE.Group();
    scene.add(edgeGroup);

    const edgeMeshes = [];

    if (memory && memory.edges) {
      memory.edges.forEach(edge => {
        const lineGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0)
        ]);

        const lineMat = new THREE.LineBasicMaterial({
          color: darkMode ? 0xffffff : 0x212121,
          transparent: true,
          opacity: 0.15
        });

        const lineMesh = new THREE.Line(lineGeom, lineMat);
        edgeGroup.add(lineMesh);

        const pulseGeom = new THREE.SphereGeometry(0.065, 8, 8);
        const pulseMat = new THREE.MeshBasicMaterial({
          color: 0xF59E0B,
          transparent: true,
          opacity: 0
        });
        const pulseMesh = new THREE.Mesh(pulseGeom, pulseMat);
        edgeGroup.add(pulseMesh);

        edgeMeshes.push({
          lineMesh,
          pulseMesh,
          pulseT: Math.random(),
          sourceId: edge.source,
          targetId: edge.target,
          edgeData: edge
        });
      });
    }

    // 11. Mouse Raycast selection
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-9999, -9999);

    const onPointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (event) => {
      let startX = event.clientX;
      let startY = event.clientY;

      const onPointerUp = (upEvent) => {
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        const dx = Math.abs(upEvent.clientX - startX);
        const dy = Math.abs(upEvent.clientY - startY);
        if (dx > 4 || dy > 4) return; // Ignore drag clicks

        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(interactiveNodeMeshes);
        if (intersects.length > 0) {
          const clickedObj = intersects[0].object;
          const node = clickedObj.userData.node;
          if (node) {
            playClickSound();
            setSelectedNode(node);
          }
        }
      };
      renderer.domElement.addEventListener('pointerup', onPointerUp);
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    let lastHoveredId = null;
    let orbitAngle = 0;
    let frameId = null;

    // 12. Main 60fps Animation Loop
    const animate = () => {
      orbitAngle += 0.0018;

      // Deep space starry field rotation drift
      starField.rotation.y += 0.0001;
      starField.rotation.x += 0.00005;

      // Dust Rings slow rotation
      dustRingInner.rotation.y += 0.0007;
      dustRingMiddle.rotation.y -= 0.0003;
      dustRingOuter.rotation.y += 0.00012;

      // Animate solar corona halo scale pulse
      const coronaScale = 1.0 + Math.sin(orbitAngle * 4.5) * 0.12;
      coronaMesh.scale.set(coronaScale, coronaScale, coronaScale);

      // Node mesh calculations using refs to read updated selection/hover states
      Object.keys(nodeMeshesMap).forEach(key => {
        const item = nodeMeshesMap[key];
        if (item.nodeId === candidate?.id) {
          item.core.rotation.y += 0.003;
          item.cage.rotation.z -= 0.002;
          const scale = 1 + Math.sin(orbitAngle * 4) * 0.04;
          item.core.scale.set(scale, scale, scale);
          return;
        }

        const angle = item.baseAngle + orbitAngle * item.config.speed;
        const radius = item.config.radius;

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = Math.sin(angle * 2.5 + item.baseAngle) * 0.45;

        item.container.position.set(x, y, z);

        item.core.rotation.y += 0.008;
        item.core.rotation.x += 0.004;
        item.cage.rotation.y -= 0.005;
        item.cage.rotation.z += 0.003;

        // Visual checks reading from active Refs instead of lexical closure
        const isSelected = selectedNodeRef.current && selectedNodeRef.current.id === item.nodeId;
        const isHovered = hoveredNodeRef.current && hoveredNodeRef.current.id === item.nodeId;
        const isSearching = searchQueryRef.current.trim().length > 0;
        const isSearchMatch = filteredNodeIdsRef.current.has(item.nodeId);

        let targetScale = 1;
        let opacity = 1;

        if (isSearching) {
          opacity = isSearchMatch ? 1.0 : 0.15;
        } else if (hoveredNodeRef.current) {
          const isNeighbor = item.nodeId === hoveredNodeRef.current.id || 
            memory.edges.some(e => 
              (e.source === hoveredNodeRef.current.id && e.target === item.nodeId) || 
              (e.target === hoveredNodeRef.current.id && e.source === item.nodeId)
            );
          opacity = isNeighbor ? 1.0 : 0.18;
        }

        if (isSelected) {
          targetScale = 1.35;
          item.cage.visible = true;
          item.cage.material.opacity = 0.55 + Math.sin(orbitAngle * 6) * 0.2;
          const cageScale = 1.25 + Math.sin(orbitAngle * 6) * 0.1;
          item.cage.scale.set(cageScale, cageScale, cageScale);
        } else if (isHovered) {
          targetScale = 1.2;
          item.cage.visible = true;
          item.cage.material.opacity = 0.4;
          item.cage.scale.set(1.15, 1.15, 1.15);
        } else {
          item.cage.visible = isSelected || isHovered;
        }

        item.core.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
        item.core.material.opacity = THREE.MathUtils.lerp(item.core.material.opacity, opacity, 0.1);
        if (item.labelSprite) {
          item.labelSprite.material.opacity = THREE.MathUtils.lerp(item.labelSprite.material.opacity, opacity, 0.15);
        }
      });

      // Hover checks
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(interactiveNodeMeshes);
      if (intersects.length > 0) {
        const hoveredObj = intersects[0].object;
        const node = hoveredObj.userData.node;
        if (node) {
          if (lastHoveredId !== node.id) {
            playHoverSound();
            lastHoveredId = node.id;
            setHoveredNode(node);
          }
          renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        if (lastHoveredId !== null) {
          lastHoveredId = null;
          setHoveredNode(null);
        }
        renderer.domElement.style.cursor = 'default';
      }

      // Constellation lines & data flows
      edgeMeshes.forEach(edge => {
        const sourceMesh = nodeMeshesMap[edge.sourceId];
        const targetMesh = nodeMeshesMap[edge.targetId];

        if (sourceMesh && targetMesh) {
          const sourcePos = new THREE.Vector3();
          const targetPos = new THREE.Vector3();
          
          sourceMesh.container.getWorldPosition(sourcePos);
          targetMesh.container.getWorldPosition(targetPos);

          const points = [sourcePos, targetPos];
          edge.lineMesh.geometry.setFromPoints(points);
          edge.lineMesh.geometry.attributes.position.needsUpdate = true;

          const isSearching = searchQueryRef.current.trim().length > 0;
          const activeSelected = selectedNodeRef.current;
          const activeHovered = hoveredNodeRef.current;

          const isHighlighted = isSearching 
            ? filteredNodeIdsRef.current.has(edge.sourceId) && filteredNodeIdsRef.current.has(edge.targetId)
            : (activeSelected ? (activeSelected.id === edge.sourceId || activeSelected.id === edge.targetId) : false) || 
              (activeHovered ? (activeHovered.id === edge.sourceId || activeHovered.id === edge.targetId) : false);

          let targetOpacity = 0.15;

          if (isSearching) {
            targetOpacity = isHighlighted ? 0.8 : 0.04;
          } else if (activeHovered) {
            const connectedToHover = activeHovered.id === edge.sourceId || activeHovered.id === edge.targetId;
            targetOpacity = connectedToHover ? 0.85 : 0.03;
          } else if (activeSelected) {
            const connectedToSelect = activeSelected.id === edge.sourceId || activeSelected.id === edge.targetId;
            targetOpacity = connectedToSelect ? 0.9 : 0.08;
          }

          edge.lineMesh.material.opacity = THREE.MathUtils.lerp(edge.lineMesh.material.opacity, targetOpacity, 0.1);
          edge.lineMesh.material.color.setHex(isHighlighted ? (darkMode ? 0xffffff : 0x212121) : 0x888888);

          if (isHighlighted || (activeSelected === null && activeHovered === null && !isSearching)) {
            edge.pulseMesh.visible = true;
            edge.pulseMesh.material.opacity = THREE.MathUtils.lerp(edge.pulseMesh.material.opacity, isHighlighted ? 0.95 : 0.35, 0.15);

            edge.pulseT = (edge.pulseT + (isHighlighted ? 0.008 : 0.0045)) % 1.0;
            const lerpedPos = new THREE.Vector3().lerpVectors(sourcePos, targetPos, edge.pulseT);
            edge.pulseMesh.position.copy(lerpedPos);
            
            const targetLabel = targetMesh.container.userData.node?.label;
            const targetColorHex = orbitConfig[targetLabel]?.color || '#F59E0B';
            edge.pulseMesh.material.color.setStyle(targetColorHex);
          } else {
            edge.pulseMesh.material.opacity = THREE.MathUtils.lerp(edge.pulseMesh.material.opacity, 0.0, 0.2);
            if (edge.pulseMesh.material.opacity < 0.02) {
              edge.pulseMesh.visible = false;
            }
          }
        }
      });

      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      starGeometry.dispose();
      starMaterial.dispose();
      sunGeom.dispose();
      sunMat.dispose();
      sunRingGeom.dispose();
      sunRingMat.dispose();
      coronaGeom.dispose();
      coronaMat.dispose();
      
      orbitGridGroup.children.forEach(c => {
        c.geometry.dispose();
        c.material.dispose();
      });
      interactiveNodeMeshes.forEach(mesh => {
        mesh.geometry.dispose();
        mesh.material.dispose();
        mesh.children.forEach(c => {
          if (c.geometry) c.geometry.dispose();
          if (c.material) {
            if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
            else c.material.dispose();
          }
        });
      });
      edgeMeshes.forEach(e => {
        e.lineMesh.geometry.dispose();
        e.lineMesh.material.dispose();
        e.pulseMesh.geometry.dispose();
        e.pulseMesh.material.dispose();
      });

      Object.keys(labelCache).forEach(k => {
        labelCache[k].material.map.dispose();
        labelCache[k].material.dispose();
      });

      renderer.dispose();
    };
  }, [memory, darkMode]); // Re-runs ONLY when knowledge memory changes or dark/light theme is toggled. Selection/Search changes do not reset view!

  // Camera helpers
  const zoomIn = () => {
    if (controlsRef.current && cameraRef.current) {
      playClickSound();
      const camera = cameraRef.current;
      const target = controlsRef.current.target;
      const direction = new THREE.Vector3().subVectors(camera.position, target).normalize();
      const distance = camera.position.distanceTo(target);
      const newDist = Math.max(controlsRef.current.minDistance, distance - 4);
      camera.position.copy(target).addScaledVector(direction, newDist);
    }
  };

  const zoomOut = () => {
    if (controlsRef.current && cameraRef.current) {
      playClickSound();
      const camera = cameraRef.current;
      const target = controlsRef.current.target;
      const direction = new THREE.Vector3().subVectors(camera.position, target).normalize();
      const distance = camera.position.distanceTo(target);
      const newDist = Math.min(controlsRef.current.maxDistance, distance + 4);
      camera.position.copy(target).addScaledVector(direction, newDist);
    }
  };

  const resetCamera = () => {
    if (controlsRef.current && cameraRef.current) {
      playClickSound();
      cameraRef.current.position.set(0, 16, 26);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {/* HUD Navigation */}
      <div className="three-hud-controls animate-fade-in" style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        gap: '8px',
        backgroundColor: 'var(--gl-card-bg)',
        border: '1px solid var(--gl-border)',
        borderRadius: '24px',
        padding: '6px 14px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
      }}>
        <button 
          onClick={zoomIn}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            color: 'var(--gl-black)',
            padding: '4px 8px',
            fontFamily: 'var(--font-mono)'
          }}
          title="Zoom In"
        >
          ➕
        </button>
        <button 
          onClick={zoomOut}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            color: 'var(--gl-black)',
            padding: '4px 8px',
            fontFamily: 'var(--font-mono)'
          }}
          title="Zoom Out"
        >
          ➖
        </button>
        <button 
          onClick={resetCamera}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.75rem',
            color: 'var(--gl-black)',
            padding: '4px 8px',
            fontWeight: 'bold',
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-mono)'
          }}
          title="Reset Camera"
        >
          ⟲ RESET
        </button>
      </div>
    </div>
  );
}
