// --- THEME & NAVIGATION ---
const themeToggleBtn = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('taraxaplan-theme') || 'dark';

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('taraxaplan-theme', theme);
    themeToggleBtn.innerHTML = theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
}
setTheme(currentTheme);
themeToggleBtn.addEventListener('click', () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

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
document.getElementById('toggle-sidebar').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('collapsed'));

function renderEntities(type, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    const sortedData = [...data[type]].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    sortedData.forEach(entity => {
        const el = document.createElement('div');
        el.className = 'entity-card';
        
        let headerText = `<h4>${entity.name || 'Unnamed'}</h4>`;
        let borderColor = entity.color || '';
        let subText = [];

        if (type === 'items') {
            if (entity.categoryId) {
                const cat = data.categories.find(c => c.id === entity.categoryId);
                if (cat) {
                    subText.push(`<span style="color:${cat.color}">${cat.name}</span>`);
                    borderColor = cat.color;
                }
            }
            if (entity.ownerId) {
                const owner = data.people.find(p => p.id === entity.ownerId);
                if (owner) {
                    subText.push(`Owner: ${owner.name}`);
                    borderColor = owner.color || borderColor;
                }
            }
            headerText = `<h4>${getItemHTML(entity.id)} <small style="opacity:0.8; font-weight:normal;">[${subText.join(' | ')}]</small></h4>`;
        }

        if (borderColor) el.style.borderLeftColor = borderColor;
        
        el.innerHTML = `${headerText}<p>${entity.description || ''}</p>`;
        
        el.addEventListener('click', () => openEntityModal(type, entity.id));
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            openEntityModal(type, entity.id);
        });
        
        container.appendChild(el);
    });
}

function renderAll() {
    if(typeof renderNodes === 'function') { renderNodes(); renderConnections(); }
    renderEntities('items', 'items-list'); 
    renderEntities('people', 'people-list');
    renderEntities('categories', 'categories-list');
    renderCleanup(); 
}

// --- DYNAMIC MULTI-SELECT COMPONENT ---
function createMultiSelectWidget(container, initialIds, onChangeCallback, sourceData = data.items, listType = 'items', allowCreate = true) {
    container.innerHTML = '';
    container.className = 'multi-select-container';
    
    let selectedIds = [...(initialIds || [])];

    const pillsDiv = document.createElement('div');
    pillsDiv.className = 'pills-container';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'search-input';
    input.placeholder = `Search...`;
    
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-list hidden';
    
    container.appendChild(pillsDiv);
    container.appendChild(input);
    container.appendChild(dropdown);
    
    const getLabel = (item) => {
        if (listType === 'items') return getItemHTML(item.id);
        if (listType === 'nodes') return item.shortDesc || 'Unnamed Action';
        return item.name;
    };
    
    const getNameRaw = (item) => item.name || item.shortDesc || '';

    const renderSelectedPills = () => {
        pillsDiv.innerHTML = '';
        const sortedItems = selectedIds.map(id => sourceData.find(i => i.id === id)).filter(Boolean).sort((a, b) => getNameRaw(a).localeCompare(getNameRaw(b)));
            
        sortedItems.forEach(item => {
            const pill = document.createElement('div');
            pill.className = 'pill';
            pill.innerHTML = `<span class="pill-delete">✖</span> ${getLabel(item)}`;
            
            // Only add right click edit if not in filter mode (filter mode uses node pills too)
            if (allowCreate && listType !== 'nodes') {
                pill.addEventListener('contextmenu', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    openEntityModal(listType, item.id, true);
                });
            }
            
            pill.querySelector('.pill-delete').addEventListener('mousedown', (e) => {
                e.stopPropagation(); e.preventDefault();
                selectedIds = selectedIds.filter(pid => pid !== item.id);
                onChangeCallback(selectedIds);
                renderSelectedPills();
            });
            pillsDiv.appendChild(pill);
        });
    };

    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        dropdown.innerHTML = '';
        
        let matches = sourceData.filter(i => !selectedIds.includes(i.id));
        if (val) matches = matches.filter(i => getNameRaw(i).toLowerCase().includes(val));
        matches.sort((a, b) => getNameRaw(a).localeCompare(getNameRaw(b)));
        
        if (val && allowCreate && !sourceData.some(i => getNameRaw(i).toLowerCase() === val)) {
            const createDiv = document.createElement('div');
            createDiv.className = 'dropdown-item create-item';
            createDiv.innerHTML = `<strong>+ Create:</strong> "${input.value.trim()}"`;
            createDiv.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const newItem = { id: generateId(), name: input.value.trim(), description: '' };
                if (listType === 'people') newItem.color = '#444444'; 
                sourceData.push(newItem);
                selectedIds.push(newItem.id);
                onChangeCallback(selectedIds);
                input.value = '';
                dropdown.classList.add('hidden');
                renderSelectedPills();
                renderEntities(listType, `${listType}-list`);
                renderCleanup();
            });
            dropdown.appendChild(createDiv);
        }

        matches.forEach(match => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.innerHTML = getLabel(match);
            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
                selectedIds.push(match.id);
                onChangeCallback(selectedIds);
                input.value = '';
                dropdown.classList.add('hidden');
                renderSelectedPills();
            });
            dropdown.appendChild(div);
        });
        if (dropdown.innerHTML !== '') dropdown.classList.remove('hidden'); else dropdown.classList.add('hidden');
    });

    input.addEventListener('blur', () => { dropdown.classList.add('hidden'); input.value = ''; });
    input.addEventListener('focus', () => input.dispatchEvent(new Event('input')));
    renderSelectedPills();
}

// --- FILTER MODAL LOGIC ---
let tempFilterState = { people: [], items: [], nodes: [] };

document.getElementById('btn-filter-graph').addEventListener('click', () => {
    tempFilterState = {
        people: [...window.currentGraphFilter.people],
        items: [...window.currentGraphFilter.items],
        nodes: [...window.currentGraphFilter.nodes]
    };
    
    createMultiSelectWidget(document.getElementById('filter-people-wrapper'), tempFilterState.people, (ids) => tempFilterState.people = ids, data.people, 'people', false);
    createMultiSelectWidget(document.getElementById('filter-items-wrapper'), tempFilterState.items, (ids) => tempFilterState.items = ids, data.items, 'items', false);
    createMultiSelectWidget(document.getElementById('filter-nodes-wrapper'), tempFilterState.nodes, (ids) => tempFilterState.nodes = ids, data.nodes, 'nodes', false);
    
    document.getElementById('filter-modal').classList.remove('hidden');
});

document.getElementById('cancel-filter-btn').addEventListener('click', () => document.getElementById('filter-modal').classList.add('hidden'));

document.getElementById('apply-filter-btn').addEventListener('click', () => {
    window.currentGraphFilter = {
        people: [...tempFilterState.people],
        items: [...tempFilterState.items],
        nodes: [...tempFilterState.nodes]
    };
    
    const isEmpty = window.currentGraphFilter.people.length === 0 && window.currentGraphFilter.items.length === 0 && window.currentGraphFilter.nodes.length === 0;
    const clearBtn = document.getElementById('btn-clear-filter');
    if (isEmpty) clearBtn.classList.add('hidden'); else clearBtn.classList.remove('hidden');
    
    document.getElementById('filter-modal').classList.add('hidden');
    renderAll();
});

document.getElementById('btn-clear-filter').addEventListener('click', () => {
    window.currentGraphFilter = { people: [], items: [], nodes: [] };
    document.getElementById('btn-clear-filter').classList.add('hidden');
    renderAll();
});


// --- NODE MODAL LOGIC ---
let editingNodeId = null;
let currentPrereqs = [];
let currentOutputs = [];
let currentOptions = [];
let currentOwners = [];
let currentIsDecision = false;

function renderDecisionOptionsBuilder() {
    const container = document.getElementById('options-builder-list');
    container.innerHTML = '';
    currentOptions.forEach((opt, index) => {
        const block = document.createElement('div');
        block.className = 'option-builder-block';
        block.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong>Option ${index + 1}</strong>
                <button class="danger-btn" style="padding:2px 8px; margin:0;" data-index="${index}">✖</button>
            </div>
            <input type="text" class="opt-label-input" value="${opt.label}" placeholder="e.g., 'Player gives gold'" style="width:calc(100% - 18px); margin-bottom:10px;">
            <label style="font-size:0.85em; color:var(--text-color); opacity:0.8;">Requires (Inputs):</label>
            <div class="opt-prereqs-widget"></div>
            <label style="font-size:0.85em; color:var(--text-color); opacity:0.8; margin-top:5px;">Grants (Outputs):</label>
            <div class="opt-outputs-widget"></div>
        `;
        block.querySelector('.opt-label-input').addEventListener('input', (e) => currentOptions[index].label = e.target.value);
        block.querySelector('.danger-btn').addEventListener('click', (e) => { e.preventDefault(); currentOptions.splice(index, 1); renderDecisionOptionsBuilder(); });
        createMultiSelectWidget(block.querySelector('.opt-prereqs-widget'), opt.prereqIds, (newIds) => currentOptions[index].prereqIds = newIds, data.items, 'items');
        createMultiSelectWidget(block.querySelector('.opt-outputs-widget'), opt.outputIds, (newIds) => currentOptions[index].outputIds = newIds, data.items, 'items');
        container.appendChild(block);
    });
}

function refreshNodeModalUI() {
    createMultiSelectWidget(document.getElementById('edit-owners-wrapper'), currentOwners, (newIds) => currentOwners = newIds, data.people, 'people');
    createMultiSelectWidget(document.getElementById('edit-prereqs-wrapper'), currentPrereqs, (newIds) => currentPrereqs = newIds, data.items, 'items');
    createMultiSelectWidget(document.getElementById('edit-outputs-wrapper'), currentOutputs, (newIds) => currentOutputs = newIds, data.items, 'items');
    if (currentIsDecision) renderDecisionOptionsBuilder();
}

function openNodeModal(nodeId) {
    editingNodeId = nodeId;
    const node = data.nodes.find(n => n.id === nodeId);
    document.getElementById('edit-short').value = node.shortDesc;
    document.getElementById('edit-long').value = node.longDesc || '';
    
    currentPrereqs = [...(node.prereqIds || [])];
    currentOutputs = [...(node.outputIds || [])];
    currentOptions = JSON.parse(JSON.stringify(node.options || []));
    currentOwners = [...(node.ownerIds || [])];
    currentIsDecision = node.isDecision || false;
    
    document.querySelector(`input[name="nodeType"][value="${currentIsDecision ? 'decision' : 'action'}"]`).checked = true;
    toggleNodeTypeUI();
    refreshNodeModalUI();
    document.getElementById('edit-modal').classList.remove('hidden');
}

function toggleNodeTypeUI() {
    currentIsDecision = document.querySelector('input[name="nodeType"]:checked').value === 'decision';
    if (currentIsDecision) {
        document.getElementById('standard-outputs-section').classList.add('hidden');
        document.getElementById('decision-options-section').classList.remove('hidden');
        if (currentOptions.length === 0) currentOptions.push({ id: generateId(), label: '', prereqIds: [], outputIds: [] });
        renderDecisionOptionsBuilder();
    } else {
        document.getElementById('standard-outputs-section').classList.remove('hidden');
        document.getElementById('decision-options-section').classList.add('hidden');
    }
}

document.querySelectorAll('input[name="nodeType"]').forEach(radio => radio.addEventListener('change', toggleNodeTypeUI));
document.getElementById('btn-add-option').addEventListener('click', (e) => { e.preventDefault(); currentOptions.push({ id: generateId(), label: '', prereqIds: [], outputIds: [] }); renderDecisionOptionsBuilder(); });

function saveNodeAndClose() {
    if (!editingNodeId) return;
    const node = data.nodes.find(n => n.id === editingNodeId);
    if (node) {
        node.shortDesc = document.getElementById('edit-short').value;
        node.longDesc = document.getElementById('edit-long').value;
        node.ownerIds = [...currentOwners];
        node.prereqIds = [...currentPrereqs];
        node.isDecision = currentIsDecision;
        if (currentIsDecision) { node.options = JSON.parse(JSON.stringify(currentOptions)); node.outputIds = []; } 
        else { node.outputIds = [...currentOutputs]; node.options = []; }
        renderAll();
    }
    document.getElementById('edit-modal').classList.add('hidden');
    editingNodeId = null;
}

document.getElementById('edit-modal').addEventListener('mousedown', (e) => { if (e.target === document.getElementById('edit-modal')) saveNodeAndClose(); });
document.getElementById('save-node-btn').addEventListener('click', saveNodeAndClose);
document.getElementById('cancel-node-btn').addEventListener('click', () => { document.getElementById('edit-modal').classList.add('hidden'); editingNodeId = null; });
document.getElementById('delete-node').addEventListener('click', () => {
    data.nodes = data.nodes.filter(n => n.id !== editingNodeId);
    for (const key in data.knees) { if (key.startsWith(editingNodeId + '-') || key.endsWith('-' + editingNodeId)) delete data.knees[key]; }
    renderAll(); document.getElementById('edit-modal').classList.add('hidden'); editingNodeId = null;
});

// --- ENTITY MODAL LOGIC ---
let editingEntity = null;
let returningToNodeModal = false; 

// Simple array to options helper
function populateSelect(selectId, list, selectedValue) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">-- None --</option>';
    const sortedList = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    sortedList.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id; option.textContent = item.name;
        if (item.id === selectedValue) option.selected = true;
        select.appendChild(option);
    });
}

document.getElementById('btn-add-item').addEventListener('click', () => openEntityModal('items', null));
document.getElementById('btn-add-category').addEventListener('click', () => openEntityModal('categories', null));
document.getElementById('btn-add-person').addEventListener('click', () => openEntityModal('people', null));

function openEntityModal(type, id, fromNodeEditor = false) {
    editingEntity = { type, id };
    returningToNodeModal = fromNodeEditor;
    if (returningToNodeModal) document.getElementById('edit-modal').classList.add('hidden');

    const titles = { 'items': 'Item', 'people': 'Person', 'categories': 'Category' };
    document.getElementById('entity-modal-title').textContent = id ? `Edit ${titles[type]}` : `New ${titles[type]}`;
    
    const colorLabel = document.getElementById('color-picker-label');
    const catLabel = document.getElementById('category-picker-label');
    const ownerLabel = document.getElementById('item-owner-picker-label');
    
    if (type === 'people' || type === 'categories') colorLabel.classList.remove('hidden'); else colorLabel.classList.add('hidden');
    
    if (type === 'items') {
        catLabel.classList.remove('hidden');
        ownerLabel.classList.remove('hidden');
        populateSelect('edit-entity-category', data.categories, id ? data.items.find(i=>i.id===id).categoryId : '');
        populateSelect('edit-entity-owner', data.people, id ? data.items.find(i=>i.id===id).ownerId : '');
    } else {
        catLabel.classList.add('hidden');
        ownerLabel.classList.add('hidden');
    }

    if (id) {
        const entity = data[type].find(e => e.id === id);
        document.getElementById('edit-entity-name').value = entity.name || '';
        document.getElementById('edit-entity-desc').value = entity.description || '';
        if (type === 'people' || type === 'categories') document.getElementById('edit-entity-color').value = entity.color || '#444444';
    } else {
        document.getElementById('edit-entity-name').value = '';
        document.getElementById('edit-entity-desc').value = '';
        document.getElementById('edit-entity-color').value = '#444444';
    }
    document.getElementById('edit-entity-modal').classList.remove('hidden');
}

function handleNestedModalClose() {
    document.getElementById('edit-entity-modal').classList.add('hidden');
    if (returningToNodeModal) {
        document.getElementById('edit-modal').classList.remove('hidden');
        refreshNodeModalUI();
        returningToNodeModal = false;
    } else {
        editingEntity = null;
    }
}

function saveEntityAndClose() {
    if (!editingEntity) return;
    const name = document.getElementById('edit-entity-name').value;
    const desc = document.getElementById('edit-entity-desc').value;
    const color = document.getElementById('edit-entity-color').value;
    
    let targetList = data[editingEntity.type];
    if (editingEntity.id) {
        const entity = targetList.find(e => e.id === editingEntity.id);
        entity.name = name; entity.description = desc;
        if (editingEntity.type === 'people' || editingEntity.type === 'categories') entity.color = color;
        if (editingEntity.type === 'items') {
            entity.categoryId = document.getElementById('edit-entity-category').value;
            entity.ownerId = document.getElementById('edit-entity-owner').value;
        }
    } else {
        let newEntity = { id: generateId(), name: name, description: desc };
        if (editingEntity.type === 'people' || editingEntity.type === 'categories') newEntity.color = color;
        if (editingEntity.type === 'items') {
            newEntity.categoryId = document.getElementById('edit-entity-category').value;
            newEntity.ownerId = document.getElementById('edit-entity-owner').value;
        }
        targetList.push(newEntity);
    }
    renderAll(); handleNestedModalClose();
}

// Magnifier button logic overrides everything and sets the exact filter
document.getElementById('btn-magnify-entity').addEventListener('click', (e) => {
    e.preventDefault();
    returningToNodeModal = false; 
    saveEntityAndClose();
    if (editingNodeId) saveNodeAndClose(); 
    
    // Set absolute filter state to ONLY this entity
    window.currentGraphFilter = { people: [], items: [], nodes: [] };
    if (editingEntity.type === 'items') window.currentGraphFilter.items.push(editingEntity.id);
    if (editingEntity.type === 'people') window.currentGraphFilter.people.push(editingEntity.id);
    
    document.getElementById('btn-clear-filter').classList.remove('hidden');
    document.querySelector('[data-target="workspace-graph"]').click(); // Jump
    renderAll();
});

document.getElementById('edit-entity-modal').addEventListener('mousedown', (e) => { if (e.target === document.getElementById('edit-entity-modal')) saveEntityAndClose(); });
document.getElementById('save-entity-btn').addEventListener('click', saveEntityAndClose);
document.getElementById('cancel-entity-btn').addEventListener('click', () => { handleNestedModalClose(); });
document.getElementById('delete-entity').addEventListener('click', () => {
    if (editingEntity.id) data[editingEntity.type] = data[editingEntity.type].filter(e => e.id !== editingEntity.id);
    renderAll(); handleNestedModalClose();
});

document.querySelector('#edit-modal .modal-content').addEventListener('mousedown', (e) => e.stopPropagation());
document.querySelector('#edit-entity-modal .modal-content').addEventListener('mousedown', (e) => e.stopPropagation());
document.querySelector('#filter-modal .modal-content').addEventListener('mousedown', (e) => e.stopPropagation());

// --- CLEANUP DASHBOARD LOGIC ---
function renderCleanup() {
    const container = document.getElementById('cleanup-container');
    if (!container) return;
    container.innerHTML = '';

    let usedItemIds = new Set(); let inputItemIds = new Set(); let outputItemIds = new Set();
    let usedPeopleIds = new Set(); let validLinks = new Set(); let danglingReferences = []; 
    const itemExists = (id) => data.items.some(i => i.id === id);

    data.nodes.forEach(node => {
        (node.ownerIds || []).forEach(id => usedPeopleIds.add(id));
        const checkItem = (id, isInput, optId = null) => {
            if (!itemExists(id)) danglingReferences.push({ nodeId: node.id, optId, itemId: id, type: isInput ? 'Prerequisite' : 'Output' });
            else { usedItemIds.add(id); if (isInput) inputItemIds.add(id); else outputItemIds.add(id); }
        };
        (node.prereqIds || []).forEach(id => checkItem(id, true));
        if (!node.isDecision) (node.outputIds || []).forEach(id => checkItem(id, false));
        else {
            (node.options || []).forEach(opt => {
                (opt.prereqIds || []).forEach(id => checkItem(id, true, opt.id));
                (opt.outputIds || []).forEach(id => checkItem(id, false, opt.id));
            });
        }
    });

    data.nodes.forEach(source => {
        data.nodes.forEach(target => {
            if (source.id === target.id) return;
            let srcBundles = [];
            if (!source.isDecision) srcBundles.push({ subId: 'main', ids: source.outputIds || [] });
            else (source.options || []).forEach(opt => srcBundles.push({ subId: opt.id, ids: opt.outputIds || [] }));

            let tgtBundles = [];
            tgtBundles.push({ subId: 'main', ids: target.prereqIds || [] });
            if (target.isDecision) (target.options || []).forEach(opt => tgtBundles.push({ subId: opt.id, ids: opt.prereqIds || [] }));

            srcBundles.forEach(src => {
                tgtBundles.forEach(tgt => {
                    if (src.ids.some(id => tgt.ids.includes(id))) validLinks.add(`${source.id}_${src.subId}-${target.id}_${tgt.subId}`);
                });
            });
        });
    });

    const orphanedKnees = Object.keys(data.knees).filter(k => !validLinks.has(k));
    const unusedItems = data.items.filter(i => !usedItemIds.has(i.id)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const unusedPeople = data.people.filter(p => !usedPeopleIds.has(p.id)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const disconnectedNodes = data.nodes.filter(n => {
        let hasConnection = (n.prereqIds && n.prereqIds.length > 0) || (!n.isDecision && n.outputIds && n.outputIds.length > 0);
        if (n.isDecision) { n.options.forEach(opt => { if ((opt.prereqIds && opt.prereqIds.length > 0) || (opt.outputIds && opt.outputIds.length > 0)) hasConnection = true; }); }
        return !hasConnection;
    }).sort((a, b) => (a.shortDesc || '').localeCompare(b.shortDesc || ''));
    const unproducedItems = data.items.filter(i => usedItemIds.has(i.id) && !outputItemIds.has(i.id)).sort((a, b) => (a.name || '').localeCompare(b.name || '')); 
    const unconsumedItems = data.items.filter(i => usedItemIds.has(i.id) && !inputItemIds.has(i.id)).sort((a, b) => (a.name || '').localeCompare(b.name || '')); 

    const buildSection = (title, items, renderItemHTML, actionLabel, actionFn) => {
        if (items.length === 0) return;
        const sec = document.createElement('div');
        sec.className = 'cleanup-section';
        sec.innerHTML = `<h3>${title} (${items.length})</h3>`;
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'cleanup-card';
            card.innerHTML = `<div class="cleanup-info">${renderItemHTML(item)}</div>`;
            const btn = document.createElement('button');
            btn.className = 'danger-btn'; btn.textContent = actionLabel;
            btn.onclick = () => { actionFn(item); renderAll(); };
            card.appendChild(btn); sec.appendChild(card);
        });
        container.appendChild(sec);
    };

    buildSection('Orphaned Lines/Knees', orphanedKnees, (k) => `<span class="cleanup-title">Broken Line Reference</span><span class="cleanup-desc">Internal ID: ${k}</span>`, 'Delete Knees', (k) => delete data.knees[k]);
    buildSection('Missing Item References', danglingReferences, (ref) => { const node = data.nodes.find(n => n.id === ref.nodeId); return `<span class="cleanup-title">Invalid ${ref.type} in "${node ? node.shortDesc : 'Unknown Node'}"</span><span class="cleanup-desc">This node references a deleted item.</span>`; }, 'Fix (Remove Reference)', (ref) => { const node = data.nodes.find(n => n.id === ref.nodeId); if (!node) return; if (ref.optId) { const opt = node.options.find(o => o.id === ref.optId); if (opt) { if (ref.type === 'Prerequisite') opt.prereqIds = opt.prereqIds.filter(id => id !== ref.itemId); else opt.outputIds = opt.outputIds.filter(id => id !== ref.itemId); } } else { if (ref.type === 'Prerequisite') node.prereqIds = node.prereqIds.filter(id => id !== ref.itemId); else node.outputIds = node.outputIds.filter(id => id !== ref.itemId); } });
    buildSection('Disconnected Actions', disconnectedNodes, (n) => `<span class="cleanup-title">"${n.shortDesc}"</span><span class="cleanup-desc">Has no inputs or outputs connecting it to the game.</span>`, 'Delete Action', (n) => data.nodes = data.nodes.filter(node => node.id !== n.id));
    buildSection('Completely Unused Items', unusedItems, (i) => `<span class="cleanup-title">${getItemHTML(i.id)}</span><span class="cleanup-desc">Not required or granted by any action.</span>`, 'Delete Item', (i) => data.items = data.items.filter(item => item.id !== i.id));
    buildSection('Unused People (No Actions Owned)', unusedPeople, (p) => `<span class="cleanup-title">${p.name}</span><span class="cleanup-desc">Not assigned to any action in the graph.</span>`, 'Delete Person', (p) => data.people = data.people.filter(person => person.id !== p.id));
    buildSection('Items Required but NEVER Granted (Missing Sources)', unproducedItems, (i) => `<span class="cleanup-title">${getItemHTML(i.id)}</span><span class="cleanup-desc">This is an input somewhere, but no action produces it. (Normal for starting items).</span>`, 'Delete Item', (i) => data.items = data.items.filter(item => item.id !== i.id));
    buildSection('Items Granted but NEVER Required (Dead Ends)', unconsumedItems, (i) => `<span class="cleanup-title">${getItemHTML(i.id)}</span><span class="cleanup-desc">This is an output somewhere, but no action requires it. (Normal for final goals).</span>`, 'Delete Item', (i) => data.items = data.items.filter(item => item.id !== i.id));
    
    if (container.innerHTML === '') container.innerHTML = '<h3 style="color:var(--text-color); opacity:0.7;">Everything looks clean! No errors found.</h3>';
}

setTimeout(() => { renderAll(); if(typeof centerAndFitGraph === 'function') centerAndFitGraph(); }, 100);