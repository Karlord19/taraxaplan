// --- STATE MANAGEMENT ---
let data = {
    nodes: [],
    knees: {},
    items: [],
    people: []
};

let draggingItem = null; 
let offset = { x: 0, y: 0 };
let editingNodeId = null;
let editingEntity = null; // { type: 'item' | 'person', id: string }

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- NAVIGATION ---
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.workspace').forEach(w => w.classList.add('hidden'));
        
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.remove('hidden');
        renderAll();
    });
});

document.getElementById('toggle-sidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
});

// --- SAVE & LOAD JSON ---
document.getElementById('btn-save').addEventListener('click', () => {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "taraxaplan_data.json";
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('file-load').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            data = JSON.parse(event.target.result);
            // Ensure backwards compatibility if loading older versions
            if (!data.items) data.items = [];
            if (!data.people) data.people = [];
            renderAll();
        } catch (err) {
            alert("Error parsing JSON file!");
        }
    };
    reader.readAsText(file);
});

// --- HELPERS ---
const getName = (list, id) => {
    if (!id) return null;
    const item = list.find(i => i.id === id);
    return item ? item.name : 'Unknown';
};

// --- RENDER ENGINE ---
function renderAll() {
    renderNodes();
    renderConnections();
    renderEntities('items', 'items-list');
    renderEntities('people', 'people-list');
}

function renderNodes() {
    const container = document.getElementById('nodes-container');
    container.innerHTML = '';
    data.nodes.forEach(node => {
        const el = document.createElement('div');
        el.className = 'node';
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
        
        const ownerName = getName(data.people, node.ownerId) || 'Unassigned';
        const prereqName = getName(data.items, node.prereqId);
        const outputName = getName(data.items, node.outputId);

        let html = `<div class="node-owner">${ownerName}</div>`;
        html += `<div class="node-desc">${node.shortDesc || 'New Action'}</div>`;
        if (prereqName) html += `<div class="node-req">In: ${prereqName}</div>`;
        if (outputName) html += `<div class="node-output">Out: ${outputName}</div>`;
        
        el.innerHTML = html;

        el.addEventListener('click', (e) => {
            if (!draggingItem) openNodeModal(node.id);
        });

        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            draggingItem = { type: 'node', id: node.id };
            offset.x = e.clientX - node.x;
            offset.y = e.clientY - node.y;
            e.stopPropagation();
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
            // Check if Source Output matches Target Prereq (and is not null/empty)
            if (source.id !== target.id && source.outputId && source.outputId === target.prereqId) {
                const linkId = `${source.id}-${target.id}`;
                const knees = data.knees[linkId] || [];
                const start = { x: source.x + 90, y: source.y + 40 }; 
                const end = { x: target.x + 90, y: target.y + 40 };
                
                let pathData = `M ${start.x} ${start.y}`;
                knees.forEach(knee => pathData += ` L ${knee.x} ${knee.y}`);
                pathData += ` L ${end.x} ${end.y}`;

                const visPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                visPath.setAttribute('d', pathData);
                visPath.setAttribute('class', 'connection-path');
                visPath.setAttribute('marker-end', 'url(#arrowhead)');
                
                const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                hitPath.setAttribute('d', pathData);
                hitPath.setAttribute('class', 'connection-hitbox');
                
                hitPath.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    const rect = svg.getBoundingClientRect();
                    if (!data.knees[linkId]) data.knees[linkId] = [];
                    data.knees[linkId].push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    renderConnections();
                });

                svg.appendChild(visPath);
                svg.appendChild(hitPath);

                knees.forEach((knee, index) => {
                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    circle.setAttribute('cx', knee.x); circle.setAttribute('cy', knee.y);
                    circle.setAttribute('r', 5); circle.setAttribute('class', 'knee-point');
                    circle.addEventListener('mousedown', (e) => {
                        if (e.button !== 0) return;
                        draggingItem = { type: 'knee', linkId: linkId, index: index };
                        e.stopPropagation();
                    });
                    svg.appendChild(circle);
                });
            }
        });
    });
}

function renderEntities(type, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    data[type].forEach(entity => {
        const el = document.createElement('div');
        el.className = 'entity-card';
        el.innerHTML = `<h4>${entity.name || 'Unnamed'}</h4><p>${entity.description || ''}</p>`;
        el.addEventListener('click', () => openEntityModal(type, entity.id));
        container.appendChild(el);
    });
}

// --- GLOBAL MOUSE EVENTS ---
window.addEventListener('mousemove', (e) => {
    if (!draggingItem) return;
    if (draggingItem.type === 'node') {
        const node = data.nodes.find(n => n.id === draggingItem.id);
        if (node) { node.x = e.clientX - offset.x; node.y = e.clientY - offset.y; renderNodes(); renderConnections(); }
    } else if (draggingItem.type === 'knee') {
        const rect = document.getElementById('connections-canvas').getBoundingClientRect();
        const knee = data.knees[draggingItem.linkId][draggingItem.index];
        knee.x = e.clientX - rect.left; knee.y = e.clientY - rect.top;
        renderConnections();
    }
});
window.addEventListener('mouseup', () => draggingItem = null);

document.getElementById('workspace-graph').addEventListener('contextmenu', (e) => {
    if (e.target.closest('.node') || e.target.classList.contains('connection-hitbox')) return;
    e.preventDefault();
    const rect = document.getElementById('workspace-graph').getBoundingClientRect();
    data.nodes.push({
        id: generateId(),
        x: e.clientX - rect.left - 90,
        y: e.clientY - rect.top - 40,
        ownerId: '', shortDesc: 'New Action', longDesc: '', prereqId: '', outputId: ''
    });
    renderAll();
});

// --- NODE MODAL LOGIC ---
function populateSelect(selectId, list, selectedValue) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">-- None --</option>';
    list.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        if (item.id === selectedValue) option.selected = true;
        select.appendChild(option);
    });
}

function openNodeModal(nodeId) {
    editingNodeId = nodeId;
    const node = data.nodes.find(n => n.id === nodeId);
    
    document.getElementById('edit-short').value = node.shortDesc;
    document.getElementById('edit-long').value = node.longDesc;
    
    populateSelect('edit-owner', data.people, node.ownerId);
    populateSelect('edit-prereq', data.items, node.prereqId);
    populateSelect('edit-output', data.items, node.outputId);
    
    document.getElementById('edit-modal').classList.remove('hidden');
}

document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('edit-modal').classList.add('hidden');
    editingNodeId = null;
});

document.getElementById('save-node').addEventListener('click', () => {
    const node = data.nodes.find(n => n.id === editingNodeId);
    if (node) {
        node.shortDesc = document.getElementById('edit-short').value;
        node.longDesc = document.getElementById('edit-long').value;
        node.ownerId = document.getElementById('edit-owner').value;
        node.prereqId = document.getElementById('edit-prereq').value;
        node.outputId = document.getElementById('edit-output').value;
        renderAll();
    }
    document.getElementById('edit-modal').classList.add('hidden');
});

document.getElementById('delete-node').addEventListener('click', () => {
    data.nodes = data.nodes.filter(n => n.id !== editingNodeId);
    // Cleanup orphaned knees
    for (const key in data.knees) {
        if (key.startsWith(editingNodeId + '-') || key.endsWith('-' + editingNodeId)) delete data.knees[key];
    }
    renderAll();
    document.getElementById('edit-modal').classList.add('hidden');
});

// --- ENTITY (ITEM/PERSON) MODAL LOGIC ---
document.getElementById('btn-add-item').addEventListener('click', () => openEntityModal('items', null));
document.getElementById('btn-add-person').addEventListener('click', () => openEntityModal('people', null));

function openEntityModal(type, id) {
    editingEntity = { type, id };
    document.getElementById('entity-modal-title').textContent = id ? `Edit ${type === 'items' ? 'Item' : 'Person'}` : `New ${type === 'items' ? 'Item' : 'Person'}`;
    
    if (id) {
        const entity = data[type].find(e => e.id === id);
        document.getElementById('edit-entity-name').value = entity.name || '';
        document.getElementById('edit-entity-desc').value = entity.description || '';
    } else {
        document.getElementById('edit-entity-name').value = '';
        document.getElementById('edit-entity-desc').value = '';
    }
    
    document.getElementById('edit-entity-modal').classList.remove('hidden');
}

document.getElementById('close-entity-modal').addEventListener('click', () => {
    document.getElementById('edit-entity-modal').classList.add('hidden');
});

document.getElementById('save-entity').addEventListener('click', () => {
    const name = document.getElementById('edit-entity-name').value;
    const desc = document.getElementById('edit-entity-desc').value;
    
    if (editingEntity.id) {
        const entity = data[editingEntity.type].find(e => e.id === editingEntity.id);
        entity.name = name;
        entity.description = desc;
    } else {
        data[editingEntity.type].push({ id: generateId(), name: name, description: desc });
    }
    
    renderAll();
    document.getElementById('edit-entity-modal').classList.add('hidden');
});

document.getElementById('delete-entity').addEventListener('click', () => {
    if (editingEntity.id) {
        data[editingEntity.type] = data[editingEntity.type].filter(e => e.id !== editingEntity.id);
        // We do NOT automatically delete nodes referencing this ID, they will just show as "Unknown" 
        // until re-assigned, which is safer than cascaded data loss.
    }
    renderAll();
    document.getElementById('edit-entity-modal').classList.add('hidden');
});

// Initial render
renderAll();