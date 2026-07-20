// --- STATE MANAGEMENT ---
let data = {
    nodes: [],
    knees: {} // Format: "sourceId-targetId": [{x, y}, {x, y}]
};

let draggingItem = null; // Can be a node or a knee
let offset = { x: 0, y: 0 };
let editingNodeId = null;

// Generate unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// --- DOM ELEMENTS ---
const workspace = document.getElementById('workspace');
const nodesContainer = document.getElementById('nodes-container');
const svgCanvas = document.getElementById('connections-canvas');
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggle-sidebar');
const modal = document.getElementById('edit-modal');

// --- SIDEBAR TOGGLE ---
toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

// --- RENDER ENGINE ---
function render() {
    renderNodes();
    renderConnections();
}

function renderNodes() {
    nodesContainer.innerHTML = '';
    data.nodes.forEach(node => {
        const el = document.createElement('div');
        el.className = 'node';
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
        el.id = node.id;
        
        el.innerHTML = `
            <div class="node-owner">${node.owner || 'No Owner'}</div>
            <div class="node-desc">${node.shortDesc || 'New Action'}</div>
            <div class="node-output">Out: ${node.output || 'None'}</div>
        `;

        // Left Click: Edit
        el.addEventListener('click', (e) => {
            if (!draggingItem) openEditModal(node.id);
        });

        // Mouse Down: Start Drag
        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left click
            draggingItem = { type: 'node', id: node.id };
            offset.x = e.clientX - node.x;
            offset.y = e.clientY - node.y;
            e.stopPropagation();
        });

        nodesContainer.appendChild(el);
    });
}

function renderConnections() {
    svgCanvas.innerHTML = '';
    
    // Add SVG marker definition for the arrow head
    svgCanvas.innerHTML += `
        <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#888" />
            </marker>
        </defs>
    `;

    // Find matches: Node A output == Node B prereq
    data.nodes.forEach(source => {
        data.nodes.forEach(target => {
            if (source.id !== target.id && source.output && source.output === target.prereq) {
                drawArrow(source, target);
            }
        });
    });
}

function drawArrow(source, target) {
    const linkId = `${source.id}-${target.id}`;
    const knees = data.knees[linkId] || [];
    
    // Center of source and target nodes
    const start = { x: source.x + 90, y: source.y + 35 }; // Approximate center based on CSS width
    const end = { x: target.x + 90, y: target.y + 35 };
    
    // Build the SVG path string
    let pathData = `M ${start.x} ${start.y}`;
    knees.forEach(knee => {
        pathData += ` L ${knee.x} ${knee.y}`;
    });
    pathData += ` L ${end.x} ${end.y}`;

    // Create the visible line
    const visiblePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    visiblePath.setAttribute('d', pathData);
    visiblePath.setAttribute('class', 'connection-path');
    visiblePath.setAttribute('marker-end', 'url(#arrowhead)');
    
    // Create a thicker invisible line for easier right-clicking
    const hitBoxPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitBoxPath.setAttribute('d', pathData);
    hitBoxPath.setAttribute('class', 'connection-hitbox');
    
    // Right click on arrow adds a knee
    hitBoxPath.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const rect = svgCanvas.getBoundingClientRect();
        if (!data.knees[linkId]) data.knees[linkId] = [];
        // Insert knee at mouse position
        data.knees[linkId].push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        renderConnections();
    });

    svgCanvas.appendChild(visiblePath);
    svgCanvas.appendChild(hitBoxPath);

    // Render knees as draggable dots
    knees.forEach((knee, index) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', knee.x);
        circle.setAttribute('cy', knee.y);
        circle.setAttribute('r', 5);
        circle.setAttribute('class', 'knee-point');
        
        // Drag knee
        circle.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            draggingItem = { type: 'knee', linkId: linkId, index: index };
            e.stopPropagation();
        });
        
        svgCanvas.appendChild(circle);
    });
}

// --- GLOBAL MOUSE EVENTS ---
window.addEventListener('mousemove', (e) => {
    if (!draggingItem) return;
    
    if (draggingItem.type === 'node') {
        const node = data.nodes.find(n => n.id === draggingItem.id);
        if (node) {
            node.x = e.clientX - offset.x;
            node.y = e.clientY - offset.y;
            render();
        }
    } else if (draggingItem.type === 'knee') {
        const rect = svgCanvas.getBoundingClientRect();
        const knee = data.knees[draggingItem.linkId][draggingItem.index];
        knee.x = e.clientX - rect.left;
        knee.y = e.clientY - rect.top;
        renderConnections();
    }
});

window.addEventListener('mouseup', () => {
    draggingItem = null;
});

// Workspace Right-Click: Create new node
workspace.addEventListener('contextmenu', (e) => {
    // If we are clicking on an existing node or a path hitbox, ignore workspace right-click
    if (e.target.closest('.node') || e.target.classList.contains('connection-hitbox')) return;
    
    e.preventDefault();
    const rect = workspace.getBoundingClientRect();
    
    const newNode = {
        id: generateId(),
        x: e.clientX - rect.left - 90, // Center it on mouse
        y: e.clientY - rect.top - 35,
        owner: '',
        shortDesc: 'New Action',
        longDesc: '',
        prereq: '',
        output: ''
    };
    
    data.nodes.push(newNode);
    render();
});

// --- EDIT MODAL LOGIC ---
function openEditModal(nodeId) {
    editingNodeId = nodeId;
    const node = data.nodes.find(n => n.id === nodeId);
    
    document.getElementById('edit-owner').value = node.owner;
    document.getElementById('edit-short').value = node.shortDesc;
    document.getElementById('edit-long').value = node.longDesc;
    document.getElementById('edit-prereq').value = node.prereq;
    document.getElementById('edit-output').value = node.output;
    
    modal.classList.remove('hidden');
}

document.getElementById('close-modal').addEventListener('click', () => {
    modal.classList.add('hidden');
    editingNodeId = null;
});

document.getElementById('save-node').addEventListener('click', () => {
    const node = data.nodes.find(n => n.id === editingNodeId);
    if (node) {
        node.owner = document.getElementById('edit-owner').value;
        node.shortDesc = document.getElementById('edit-short').value;
        node.longDesc = document.getElementById('edit-long').value;
        node.prereq = document.getElementById('edit-prereq').value;
        node.output = document.getElementById('edit-output').value;
        render();
    }
    modal.classList.add('hidden');
    editingNodeId = null;
});

// Initial render
render();