// --- GRAPH RENDER ENGINE & FILTERING ---
window.currentGraphFilter = { people: [], items: [], nodes: [] };

function isFilterEmpty(f) {
    return !f || (f.people.length === 0 && f.items.length === 0 && f.nodes.length === 0);
}

function nodeMatchesFilter(node, f) {
    if (isFilterEmpty(f)) return true;
    
    if (f.nodes.includes(node.id)) return true;
    if (node.ownerIds && node.ownerIds.some(id => f.people.includes(id))) return true;
    
    const nodeItems = new Set([
        ...(node.prereqIds || []),
        ...(node.outputIds || []),
        ...(node.options || []).flatMap(o => [...(o.prereqIds || []), ...(o.outputIds || [])])
    ]);
    
    if (f.items.some(id => nodeItems.has(id))) return true;
    
    return false;
}

function lineMatchesFilter(sourceId, targetId, intersectingItemIds, f) {
    if (isFilterEmpty(f)) return true;
    
    // If the line carries an item we are explicitly filtering for, it survives
    if (intersectingItemIds.some(id => f.items.includes(id))) return true;
    
    // If BOTH nodes survive the filter logic, the line connecting them survives
    const source = data.nodes.find(n => n.id === sourceId);
    const target = data.nodes.find(n => n.id === targetId);
    if (nodeMatchesFilter(source, f) && nodeMatchesFilter(target, f)) return true;
    
    return false;
}

const getOwnerGradient = (ownerIds) => {
    if (!ownerIds || ownerIds.length === 0) return '#444444';
    const sortedIds = [...ownerIds].sort((a, b) => {
        return (getName(data.people, a) || '').localeCompare(getName(data.people, b) || '');
    });
    if (sortedIds.length === 1) return getColor(sortedIds[0]);
    
    const pct = 100 / sortedIds.length;
    let gradient = 'linear-gradient(to right, ';
    sortedIds.forEach((id, i) => {
        const color = getColor(id);
        gradient += `${color} ${i * pct}%, ${color} ${(i + 1) * pct}%`;
        if (i < sortedIds.length - 1) gradient += ', ';
    });
    gradient += ')';
    return gradient;
};

function renderNodes() {
    const container = document.getElementById('nodes-container');
    container.innerHTML = '';
    
    data.nodes.forEach(node => {
        const el = document.createElement('div');
        el.className = 'node';
        if (selectedNodeIds.has(node.id)) el.classList.add('selected'); 
        
        // Dynamic Fading logic based on structured filter
        if (!nodeMatchesFilter(node, window.currentGraphFilter)) {
            el.classList.add('faded');
        }
        
        el.id = node.id; 
        el.style.left = `${node.x}px`; 
        el.style.top = `${node.y}px`;
        
        const sortedPrereqIds = [...(node.prereqIds || [])].sort((a, b) => getName(data.items, a).localeCompare(getName(data.items, b)));
        const sortedOutputIds = [...(node.outputIds || [])].sort((a, b) => getName(data.items, a).localeCompare(getName(data.items, b)));
        
        const ownerNames = (node.ownerIds || []).map(id => getName(data.people, id)).filter(n => n !== 'Unknown').sort((a, b) => a.localeCompare(b)).join(', ') || 'Unassigned';
        const prereqNames = getItemsHTMLList(sortedPrereqIds);

        let html = `
            <div class="node-color-bar" style="background: ${getOwnerGradient(node.ownerIds)}"></div>
            <div class="node-core">
            <div class="node-owner">${ownerNames}</div>
            <div class="node-desc">${node.shortDesc || 'New Action'}</div>
            ${prereqNames ? `<div class="node-req">In: ${prereqNames}</div>` : ''}
        `;

        if (!node.isDecision) {
            const outputNames = getItemsHTMLList(sortedOutputIds);
            if (outputNames) html += `<div class="node-output">Out: ${outputNames}</div>`;
            html += `</div>`;
        } else {
            html += `</div>`;
            html += `<div class="node-decision-opts">`;
            (node.options || []).forEach((opt) => {
                const sOptIn = [...(opt.prereqIds || [])].sort((a, b) => getName(data.items, a).localeCompare(getName(data.items, b)));
                const sOptOut = [...(opt.outputIds || [])].sort((a, b) => getName(data.items, a).localeCompare(getName(data.items, b)));
                
                html += `<div class="node-opt-row" data-opt-id="${opt.id}">
                    <div style="font-weight:bold; margin-bottom:2px;">▶ ${opt.label || 'Option'}</div>
                    ${sOptIn.length ? `<div style="font-size: 0.8em; margin-bottom:2px; color: var(--text-color);">In: ${getItemsHTMLList(sOptIn)}</div>` : ''}
                    ${sOptOut.length ? `<div style="font-size: 0.8em; margin-bottom:2px; color: var(--text-color);">Out: ${getItemsHTMLList(sOptOut)}</div>` : ''}
                </div>`;
            });
            html += `</div>`;
        }
        
        el.innerHTML = html;
        
        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; 
            if (e.shiftKey) {
                if (selectedNodeIds.has(node.id)) selectedNodeIds.delete(node.id);
                else selectedNodeIds.add(node.id);
                renderNodes();
            } else {
                if (!selectedNodeIds.has(node.id)) {
                    selectedNodeIds.clear();
                    selectedNodeIds.add(node.id);
                    renderNodes();
                }
            }
            draggingItem = { type: 'node', id: node.id };
            e.stopPropagation();
        });

        el.addEventListener('contextmenu', (e) => {
            e.preventDefault(); e.stopPropagation(); 
            if (typeof openNodeModal === 'function') openNodeModal(node.id); 
        });

        container.appendChild(el);
    });
}

function getDistanceToSegment(p, v, w) {
    const l2 = Math.pow(w.x - v.x, 2) + Math.pow(w.y - v.y, 2);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function drawLine(linkId, startX, startY, endX, endY, color, showArrowHead, isFaded) {
    const knees = data.knees[linkId] || [];
    const svg = document.getElementById('connections-canvas');

    let pathData = `M ${startX} ${startY}`;
    knees.forEach(knee => pathData += ` L ${knee.x} ${knee.y}`);
    pathData += ` L ${endX} ${endY}`;

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    if (isFaded) group.classList.add('faded');

    const visPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    visPath.setAttribute('d', pathData); 
    visPath.setAttribute('class', 'connection-path');
    visPath.setAttribute('stroke', color);
    visPath.style.pointerEvents = 'none'; 

    if (showArrowHead) {
        const markerId = `arrowhead-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
        if (!document.getElementById(markerId)) {
            svg.innerHTML += `
            <defs>
                <marker id="${markerId}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="${color}" />
                </marker>
            </defs>`;
        }
        visPath.setAttribute('marker-end', `url(#${markerId})`);
    }
    
    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', pathData); 
    hitPath.setAttribute('class', 'connection-hitbox');
    
    hitPath.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || !e.shiftKey) return;
        e.preventDefault(); e.stopPropagation();
        
        const rect = document.getElementById('graph-transform-layer').getBoundingClientRect();
        const clickP = { x: (e.clientX - rect.left) / graphScale, y: (e.clientY - rect.top) / graphScale };
        
        const points = [{ x: startX, y: startY }, ...knees, { x: endX, y: endY }];
        let minIndex = 0; let minDist = Infinity;

        for (let i = 0; i < points.length - 1; i++) {
            const dist = getDistanceToSegment(clickP, points[i], points[i+1]);
            if (dist < minDist) { minDist = dist; minIndex = i; }
        }
        if (!data.knees[linkId]) data.knees[linkId] = [];
        data.knees[linkId].splice(minIndex, 0, clickP);
        renderConnections();
    });

    group.appendChild(visPath); 
    group.appendChild(hitPath);
    svg.appendChild(group);

    knees.forEach((knee, index) => {
        const kneeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        kneeGroup.style.cursor = 'grab';

        const visCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        visCircle.setAttribute('cx', knee.x); visCircle.setAttribute('cy', knee.y);
        visCircle.setAttribute('r', 4); visCircle.setAttribute('fill', color);
        visCircle.style.pointerEvents = 'none';
        
        const hitCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hitCircle.setAttribute('cx', knee.x); hitCircle.setAttribute('cy', knee.y);
        hitCircle.setAttribute('r', 15); hitCircle.setAttribute('fill', 'transparent');
        hitCircle.style.pointerEvents = 'fill';

        kneeGroup.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation(); e.preventDefault();
            if (e.shiftKey) { data.knees[linkId].splice(index, 1); renderConnections(); } 
            else { draggingItem = { type: 'knee', linkId: linkId, index: index }; kneeGroup.style.cursor = 'grabbing'; }
        });

        kneeGroup.appendChild(visCircle); kneeGroup.appendChild(hitCircle);
        group.appendChild(kneeGroup); 
    });
}

function renderConnections() {
    const svg = document.getElementById('connections-canvas');
    svg.innerHTML = ''; 
    const f = window.currentGraphFilter;

    data.nodes.forEach(source => {
        data.nodes.forEach(target => {
            if (source.id === target.id) return;
            
            let srcBundles = [];
            if (!source.isDecision) {
                srcBundles.push({ subId: 'main', ids: source.outputIds || [], startY: 40, color: 'var(--line-color)', arrowHead: true });
            } else {
                (source.options || []).forEach((opt) => {
                    let optY = 40;
                    const srcEl = document.getElementById(source.id);
                    if (srcEl) {
                        const optEl = srcEl.querySelector(`.node-opt-row[data-opt-id="${opt.id}"]`);
                        if (optEl) optY = optEl.offsetTop + (optEl.offsetHeight / 2);
                    }
                    srcBundles.push({ subId: opt.id, ids: opt.outputIds || [], startY: optY, color: 'var(--line-color)', arrowHead: false });
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
                    const intersectingItemIds = src.ids.filter(id => tgt.ids.includes(id));
                    if (intersectingItemIds.length > 0) {
                        const linkId = `${source.id}_${src.subId}-${target.id}_${tgt.subId}`;
                        const isFaded = !lineMatchesFilter(source.id, target.id, intersectingItemIds, f);
                        drawLine(linkId, source.x + 180, source.y + src.startY, target.x - 5, target.y + tgt.endY, src.color, src.arrowHead, isFaded);
                    }
                });
            });
        });
    });
}

// --- ZOOM & PAN & SELECT LOGIC ---
let graphScale = 1; let graphPanX = 0; let graphPanY = 0;
const transformLayer = document.getElementById('graph-transform-layer');
const workspaceGraph = document.getElementById('workspace-graph');
let draggingItem = null; let isPanning = false; let selectedNodeIds = new Set(); 

workspaceGraph.style.cursor = "default";

function updateGraphTransform() { transformLayer.style.transform = `translate(${graphPanX}px, ${graphPanY}px) scale(${graphScale})`; }

window.addEventListener('mousedown', (e) => {
    if (e.target === workspaceGraph || e.target === document.getElementById('connections-canvas') || e.target.tagName === 'svg') {
        if (e.button === 0 || e.button === 1) {
            isPanning = true; workspaceGraph.style.cursor = "grabbing";
            if (e.button === 0 && !e.shiftKey && selectedNodeIds.size > 0) { selectedNodeIds.clear(); renderNodes(); }
        }
    }
});

window.addEventListener('mousemove', (e) => {
    if (isPanning) { graphPanX += e.movementX; graphPanY += e.movementY; updateGraphTransform(); return; }
    if (!draggingItem) return;
    if (draggingItem.type === 'node') {
        const dx = e.movementX / graphScale; const dy = e.movementY / graphScale;
        if (selectedNodeIds.has(draggingItem.id)) {
            selectedNodeIds.forEach(id => { const node = data.nodes.find(n => n.id === id); if (node) { node.x += dx; node.y += dy; } });
        } else {
            const node = data.nodes.find(n => n.id === draggingItem.id); if (node) { node.x += dx; node.y += dy; }
        }
        renderNodes(); renderConnections(); 
    } else if (draggingItem.type === 'knee') {
        const knee = data.knees[draggingItem.linkId][draggingItem.index];
        knee.x += e.movementX / graphScale; knee.y += e.movementY / graphScale; renderConnections();
    }
});

window.addEventListener('mouseup', () => { draggingItem = null; isPanning = false; workspaceGraph.style.cursor = "default"; });

workspaceGraph.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.1; const zoom = Math.exp((e.deltaY < 0 ? 1 : -1) * zoomIntensity);
    const rect = transformLayer.getBoundingClientRect();
    graphScale *= zoom; graphPanX -= (e.clientX - rect.left) * (zoom - 1); graphPanY -= (e.clientY - rect.top) * (zoom - 1);
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

    const graphWidth = (maxX - minX) + 200; const graphHeight = (maxY - minY) + 100;
    const viewportWidth = workspaceGraph.clientWidth; const viewportHeight = workspaceGraph.clientHeight;
    const scaleX = viewportWidth / graphWidth; const scaleY = viewportHeight / graphHeight;
    graphScale = Math.min(scaleX, scaleY) * 0.9;
    if (graphScale > 1) graphScale = 1; 

    graphPanX = (viewportWidth - (graphWidth * graphScale)) / 2 - (minX * graphScale);
    graphPanY = (viewportHeight - (graphHeight * graphScale)) / 2 - (minY * graphScale);
    updateGraphTransform();
}
document.getElementById('btn-center-fit').addEventListener('click', centerAndFitGraph);

workspaceGraph.addEventListener('contextmenu', (e) => {
    e.preventDefault(); 
    if (e.target.closest('.node') || e.target.classList.contains('connection-hitbox') || e.target.closest('g')) return;
    const rect = transformLayer.getBoundingClientRect();
    data.nodes.push({ id: generateId(), x: (e.clientX - rect.left) / graphScale - 90, y: (e.clientY - rect.top) / graphScale - 40, ownerIds: [], shortDesc: 'New Action', longDesc: '', prereqIds: [], outputIds: [], isDecision: false, options: [] });
    if(typeof renderAll === 'function') renderAll();
});