// --- GRAPH RENDER ENGINE ---
function renderNodes() {
    const container = document.getElementById('nodes-container');
    container.innerHTML = '';
    data.nodes.forEach(node => {
        const el = document.createElement('div');
        el.className = 'node';
        el.style.left = `${node.x}px`; 
        el.style.top = `${node.y}px`;
        
        // Apply Owner Color to top border
        const ownerColor = getColor(node.ownerId);
        el.style.borderTopColor = ownerColor;
        
        const ownerName = getName(data.people, node.ownerId) || 'Unassigned';
        const prereqNames = (node.prereqIds || []).map(id => getName(data.items, id)).join(', ');
        const outputNames = (node.outputIds || []).map(id => getName(data.items, id)).join(', ');

        let html = `<div class="node-owner" style="color: ${ownerColor}">${ownerName}</div>`;
        html += `<div class="node-desc">${node.shortDesc || 'New Action'}</div>`;
        if (prereqNames) html += `<div class="node-req">In: ${prereqNames}</div>`;
        if (outputNames) html += `<div class="node-output">Out: ${outputNames}</div>`;
        
        el.innerHTML = html;
        
        // Clicks and Drags
        el.addEventListener('click', (e) => { 
            if (!draggingItem) openNodeModal(node.id); 
        });
        
        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            draggingItem = { type: 'node', id: node.id };
            e.stopPropagation(); // Prevents panning the canvas
        });
        container.appendChild(el);
    });
}

function renderConnections() {
    const svg = document.getElementById('connections-canvas');
    svg.innerHTML = `
        <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#888" />
            </marker>
        </defs>`;

    data.nodes.forEach(source => {
        data.nodes.forEach(target => {
            if (source.id === target.id) return;
            const srcOuts = source.outputIds || [];
            const tgtIns = target.prereqIds || [];
            
            if (srcOuts.some(outId => tgtIns.includes(outId))) {
                const linkId = `${source.id}-${target.id}`;
                const knees = data.knees[linkId] || [];
                const start = { x: source.x + 180, y: source.y + 40 }; 
                const end = { x: target.x - 5, y: target.y + 40 };
                
                let pathData = `M ${start.x} ${start.y}`;
                knees.forEach(knee => pathData += ` L ${knee.x} ${knee.y}`);
                pathData += ` L ${end.x} ${end.y}`;

                const visPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                visPath.setAttribute('d', pathData); visPath.setAttribute('class', 'connection-path');
                visPath.setAttribute('marker-end', 'url(#arrowhead)');
                
                const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                hitPath.setAttribute('d', pathData); hitPath.setAttribute('class', 'connection-hitbox');
                
                hitPath.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    // Get coords relative to the transformed layer
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
                        e.stopPropagation(); // Prevents panning
                    });
                    svg.appendChild(circle);
                });
            }
        });
    });
}

// --- ZOOM & PAN LOGIC ---
let graphScale = 1;
let graphPanX = 0;
let graphPanY = 0;
const transformLayer = document.getElementById('graph-transform-layer');
const workspaceGraph = document.getElementById('workspace-graph');

function updateGraphTransform() {
    transformLayer.style.transform = `translate(${graphPanX}px, ${graphPanY}px) scale(${graphScale})`;
}

// Drag logic
let draggingItem = null; 
let isPanning = false;

window.addEventListener('mousedown', (e) => {
    // If clicking on the workspace background, start panning
    if (e.target === workspaceGraph || e.target === document.getElementById('connections-canvas')) {
        if (e.button === 0 || e.button === 1) { // Left or Middle click
            isPanning = true;
        }
    }
});

window.addEventListener('mousemove', (e) => {
    if (isPanning) {
        graphPanX += e.movementX;
        graphPanY += e.movementY;
        updateGraphTransform();
        return;
    }

    if (!draggingItem) return;

    // Movement must be divided by scale to match mouse to zoomed layer
    if (draggingItem.type === 'node') {
        const node = data.nodes.find(n => n.id === draggingItem.id);
        if (node) { 
            node.x += e.movementX / graphScale; 
            node.y += e.movementY / graphScale; 
            renderNodes(); renderConnections(); 
        }
    } else if (draggingItem.type === 'knee') {
        const knee = data.knees[draggingItem.linkId][draggingItem.index];
        knee.x += e.movementX / graphScale; 
        knee.y += e.movementY / graphScale;
        renderConnections();
    }
});

window.addEventListener('mouseup', () => {
    draggingItem = null;
    isPanning = false;
});

// Zoom with Mouse Wheel
workspaceGraph.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * zoomIntensity);
    
    // Zoom toward mouse position
    const rect = transformLayer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    graphScale *= zoom;
    graphPanX -= mouseX * (zoom - 1);
    graphPanY -= mouseY * (zoom - 1);
    
    updateGraphTransform();
}, { passive: false });

// Zoom UI Buttons
document.getElementById('btn-zoom-in').addEventListener('click', () => { graphScale *= 1.2; updateGraphTransform(); });
document.getElementById('btn-zoom-out').addEventListener('click', () => { graphScale *= 0.8; updateGraphTransform(); });

function centerAndFitGraph() {
    if (data.nodes.length === 0) return;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    data.nodes.forEach(n => {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x > maxX) maxX = n.x;
        if (n.y > maxY) maxY = n.y;
    });

    const graphWidth = (maxX - minX) + 200; // 200 = Node width + padding
    const graphHeight = (maxY - minY) + 100;
    
    const viewportWidth = workspaceGraph.clientWidth;
    const viewportHeight = workspaceGraph.clientHeight;

    // Scale to 3x the view as requested, or just fit it
    const scaleX = viewportWidth / graphWidth;
    const scaleY = viewportHeight / graphHeight;
    graphScale = Math.min(scaleX, scaleY) * 0.9; // 0.9 for padding
    
    if (graphScale > 1) graphScale = 1; // Don't zoom in too much

    graphPanX = (viewportWidth - (graphWidth * graphScale)) / 2 - (minX * graphScale);
    graphPanY = (viewportHeight - (graphHeight * graphScale)) / 2 - (minY * graphScale);

    updateGraphTransform();
}
document.getElementById('btn-center-fit').addEventListener('click', centerAndFitGraph);

// Right Click Create Node
workspaceGraph.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.node') || e.target.classList.contains('connection-hitbox')) return;
    e.preventDefault();
    
    const rect = transformLayer.getBoundingClientRect();
    const x = (e.clientX - rect.left) / graphScale;
    const y = (e.clientY - rect.top) / graphScale;

    data.nodes.push({
        id: generateId(), x: x - 90, y: y - 40,
        ownerId: '', shortDesc: 'New Action', longDesc: '', prereqIds: [], outputIds: []
    });
    renderAll();
});