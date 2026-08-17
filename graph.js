// --- GRAPH RENDER ENGINE ---
const arrowColors = ['#2ecc71', '#e74c3c', '#3498db', '#f1c40f', '#9b59b6'];

function renderNodes() {
    const container = document.getElementById('nodes-container');
    container.innerHTML = '';
    data.nodes.forEach(node => {
        const el = document.createElement('div');
        el.className = 'node';
        if (selectedNodeIds.has(node.id)) el.classList.add('selected'); // Highlight if selected
        
        el.id = node.id; 
        el.style.left = `${node.x}px`; 
        el.style.top = `${node.y}px`;
        
        const ownerColor = getColor(node.ownerId);
        el.style.borderTopColor = ownerColor;
        
        const ownerName = getName(data.people, node.ownerId) || 'Unassigned';
        const prereqNames = (node.prereqIds || []).map(id => getName(data.items, id)).filter(n => n !== 'Unknown').join(', ');

        let html = `<div class="node-core">
            <div class="node-owner" style="color: ${ownerColor}">${ownerName}</div>
            <div class="node-desc">${node.shortDesc || 'New Action'}</div>
            ${prereqNames ? `<div class="node-req">In: ${prereqNames}</div>` : ''}
        `;

        if (!node.isDecision) {
            const outputNames = (node.outputIds || []).map(id => getName(data.items, id)).filter(n => n !== 'Unknown').join(', ');
            if (outputNames) html += `<div class="node-output">Out: ${outputNames}</div>`;
            html += `</div>`;
        } else {
            html += `</div>`;
            html += `<div class="node-decision-opts">`;
            (node.options || []).forEach((opt, idx) => {
                const optColor = arrowColors[idx % arrowColors.length];
                const optInNames = (opt.prereqIds || []).map(id => getName(data.items, id)).filter(n => n !== 'Unknown').join(', ');
                const optOutNames = (opt.outputIds || []).map(id => getName(data.items, id)).filter(n => n !== 'Unknown').join(', ');
                
                html += `<div class="node-opt-row" data-opt-id="${opt.id}">
                    <div style="font-weight:bold; margin-bottom:2px;"><span style="color:${optColor}">▶</span> ${opt.label || 'Option'}</div>
                    ${optInNames ? `<div style="font-size: 0.8em; color: #888;">In: ${optInNames}</div>` : ''}
                    ${optOutNames ? `<div style="font-size: 0.8em; color: var(--accent);">Out: ${optOutNames}</div>` : ''}
                </div>`;
            });
            html += `</div>`;
        }
        
        el.innerHTML = html;
        
        el.addEventListener('click', (e) => { 
            // Only open if we didn't just finish a drag AND we aren't shift-clicking
            if (!hasDragged && !e.shiftKey && typeof openNodeModal === 'function') {
                openNodeModal(node.id); 
            }
        });
        
        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            
            // Handle Shift+Click Selection
            if (e.shiftKey) {
                if (selectedNodeIds.has(node.id)) {
                    selectedNodeIds.delete(node.id); // Toggle off
                } else {
                    selectedNodeIds.add(node.id); // Toggle on
                }
                renderNodes();
            } else {
                // If clicking an unselected node, clear others. If clicking a selected one, keep group.
                if (!selectedNodeIds.has(node.id)) {
                    selectedNodeIds.clear();
                    selectedNodeIds.add(node.id);
                    renderNodes();
                }
            }

            draggingItem = { type: 'node', id: node.id };
            e.stopPropagation();
        });
        container.appendChild(el);
    });
}

function drawLine(linkId, startX, startY, endX, endY, color) {
    const knees = data.knees[linkId] || [];
    const svg = document.getElementById('connections-canvas');

    let pathData = `M ${startX} ${startY}`;
    knees.forEach(knee => pathData += ` L ${knee.x} ${knee.y}`);
    pathData += ` L ${endX} ${endY}`;

    const markerId = `arrowhead-${color.replace('#', '')}`;
    if (!document.getElementById(markerId)) {
        svg.innerHTML += `
        <defs>
            <marker id="${markerId}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="${color}" />
            </marker>
        </defs>`;
    }

    const visPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    visPath.setAttribute('d', pathData); 
    visPath.setAttribute('class', 'connection-path');
    visPath.setAttribute('stroke', color);
    visPath.setAttribute('marker-end', `url(#${markerId})`);
    
    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', pathData); 
    hitPath.setAttribute('class', 'connection-hitbox');
    
    hitPath.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const rect = document.getElementById('graph-transform-layer').getBoundingClientRect();
        const x = (e.clientX - rect.left) / graphScale;
        const y = (e.clientY - rect.top) / graphScale;
        if (!data.knees[linkId]) data.knees[linkId] = [];
        data.knees[linkId].push({ x: x, y: y });
        renderConnections();
    });

    svg.appendChild(visPath); svg.appendChild(hitPath);

    knees.forEach((knee, index) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', knee.x); circle.setAttribute('cy', knee.y);
        circle.setAttribute('r', 5); circle.setAttribute('class', 'knee-point');
        circle.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            draggingItem = { type: 'knee', linkId: linkId, index: index };
            e.stopPropagation();
        });
        circle.addEventListener('contextmenu', (e) => {
            e.preventDefault(); e.stopPropagation();
            data.knees[linkId].splice(index, 1);
            renderConnections();
        });
        svg.appendChild(circle);
    });
}

function renderConnections() {
    const svg = document.getElementById('connections-canvas');
    svg.innerHTML = ''; 

    data.nodes.forEach(source => {
        data.nodes.forEach(target => {
            if (source.id === target.id) return;
            
            let srcBundles = [];
            if (!source.isDecision) {
                srcBundles.push({ subId: 'main', ids: source.outputIds || [], startY: 40, color: 'var(--line-color)' });
            } else {
                (source.options || []).forEach((opt, idx) => {
                    let optY = 40;
                    const srcEl = document.getElementById(source.id);
                    if (srcEl) {
                        const optEl = srcEl.querySelector(`.node-opt-row[data-opt-id="${opt.id}"]`);
                        if (optEl) optY = optEl.offsetTop + (optEl.offsetHeight / 2);
                    }
                    srcBundles.push({ subId: opt.id, ids: opt.outputIds || [], startY: optY, color: arrowColors[idx % arrowColors.length] });
                });
            }

            let tgtBundles = [];
            tgtBundles.push({ subId: 'main', ids: target.prereqIds || [], endY: 40 });
            if (target.isDecision) {
                (target.options || []).forEach(opt => {
                    let optY = 40;
                    const tgtEl = document.getElementById(target.id);
                    if (tgtEl) {
                        const optEl = tgtEl.querySelector(`.node-opt-row[data-opt-id="${opt.id}"]`);
                        if (optEl) optY = optEl.offsetTop + (optEl.offsetHeight / 2);
                    }
                    tgtBundles.push({ subId: opt.id, ids: opt.prereqIds || [], endY: optY });
                });
            }

            srcBundles.forEach(src => {
                tgtBundles.forEach(tgt => {
                    if (src.ids.some(id => tgt.ids.includes(id))) {
                        const linkId = `${source.id}_${src.subId}-${target.id}_${tgt.subId}`;
                        drawLine(linkId, source.x + 180, source.y + src.startY, target.x - 5, target.y + tgt.endY, src.color);
                    }
                });
            });
        });
    });
}

// --- ZOOM & PAN & SELECT LOGIC ---
let graphScale = 1;
let graphPanX = 0;
let graphPanY = 0;
const transformLayer = document.getElementById('graph-transform-layer');
const workspaceGraph = document.getElementById('workspace-graph');
let draggingItem = null; 
let isPanning = false;
let hasDragged = false;
let selectedNodeIds = new Set(); // Stores our multi-selected nodes

function updateGraphTransform() {
    transformLayer.style.transform = `translate(${graphPanX}px, ${graphPanY}px) scale(${graphScale})`;
}

window.addEventListener('mousedown', (e) => {
    hasDragged = false; // reset drag tracker
    if (e.target === workspaceGraph || e.target === document.getElementById('connections-canvas')) {
        if (e.button === 0 || e.button === 1) {
            isPanning = true;
            // Clear selection if clicking the background without holding shift
            if (e.button === 0 && !e.shiftKey) {
                selectedNodeIds.clear();
                renderNodes();
            }
        }
    }
});

window.addEventListener('mousemove', (e) => {
    if (isPanning) {
        hasDragged = true;
        graphPanX += e.movementX; graphPanY += e.movementY; updateGraphTransform(); return;
    }
    
    if (!draggingItem) return;
    hasDragged = true;

    if (draggingItem.type === 'node') {
        const dx = e.movementX / graphScale;
        const dy = e.movementY / graphScale;
        
        // If dragging a selected node, move ALL selected nodes
        if (selectedNodeIds.has(draggingItem.id)) {
            selectedNodeIds.forEach(id => {
                const node = data.nodes.find(n => n.id === id);
                if (node) { node.x += dx; node.y += dy; }
            });
        } else {
            // Fallback if dragging an unselected node
            const node = data.nodes.find(n => n.id === draggingItem.id);
            if (node) { node.x += dx; node.y += dy; }
        }
        
        renderNodes(); renderConnections(); 
        
    } else if (draggingItem.type === 'knee') {
        const knee = data.knees[draggingItem.linkId][draggingItem.index];
        knee.x += e.movementX / graphScale; knee.y += e.movementY / graphScale; renderConnections();
    }
});

window.addEventListener('mouseup', () => { 
    draggingItem = null; 
    isPanning = false; 
});

workspaceGraph.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * zoomIntensity);
    const rect = transformLayer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    graphScale *= zoom;
    graphPanX -= mouseX * (zoom - 1);
    graphPanY -= mouseY * (zoom - 1);
    updateGraphTransform();
}, { passive: false });

document.getElementById('btn-zoom-in').addEventListener('click', () => { graphScale *= 1.2; updateGraphTransform(); });
document.getElementById('btn-zoom-out').addEventListener('click', () => { graphScale *= 0.8; updateGraphTransform(); });

function centerAndFitGraph() {
    if (data.nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    data.nodes.forEach(n => {
        if (n.x < minX) minX = n.x; if (n.y < minY) minY = n.y;
        if (n.x > maxX) maxX = n.x; if (n.y > maxY) maxY = n.y;
    });

    const graphWidth = (maxX - minX) + 200;
    const graphHeight = (maxY - minY) + 100;
    const viewportWidth = workspaceGraph.clientWidth;
    const viewportHeight = workspaceGraph.clientHeight;

    const scaleX = viewportWidth / graphWidth;
    const scaleY = viewportHeight / graphHeight;
    graphScale = Math.min(scaleX, scaleY) * 0.9;
    if (graphScale > 1) graphScale = 1; 

    graphPanX = (viewportWidth - (graphWidth * graphScale)) / 2 - (minX * graphScale);
    graphPanY = (viewportHeight - (graphHeight * graphScale)) / 2 - (minY * graphScale);
    updateGraphTransform();
}
document.getElementById('btn-center-fit').addEventListener('click', centerAndFitGraph);

workspaceGraph.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.node') || e.target.classList.contains('connection-hitbox')) return;
    e.preventDefault();
    const rect = transformLayer.getBoundingClientRect();
    data.nodes.push({
        id: generateId(), x: (e.clientX - rect.left) / graphScale - 90, y: (e.clientY - rect.top) / graphScale - 40,
        ownerId: '', shortDesc: 'New Action', longDesc: '', prereqIds: [], outputIds: [], isDecision: false, options: []
    });
    if(typeof renderAll === 'function') renderAll();
});