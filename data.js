// --- STATE MANAGEMENT ---
let data = { nodes: [], knees: {}, items: [], people: [], categories: [] };

const generateId = () => Math.random().toString(36).substr(2, 9);

const getName = (list, id) => {
    const item = list.find(i => i.id === id);
    if (!item) return 'Unknown';
    return item.name || item.shortDesc || 'Unknown';
}

const getColor = (id) => {
    const person = data.people.find(p => p.id === id);
    return person && person.color ? person.color : '#888888';
};

const getItemHTML = (id) => {
    const item = data.items.find(i => i.id === id);
    if (!item) return 'Unknown';
    if (item.categoryId) {
        const cat = data.categories.find(c => c.id === item.categoryId);
        if (cat && cat.color) {
            return `<span style="border-bottom: 2px solid ${cat.color}; padding-bottom: 1px;">${item.name}</span>`;
        }
    }
    return `<span>${item.name}</span>`;
};

const getItemsHTMLList = (idsArray) => {
    if (!idsArray) return '';
    return idsArray
        .filter(id => data.items.some(i => i.id === id))
        .map(id => getItemHTML(id))
        .join(', ');
};

// --- FILE I/O ---
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
            
            data.nodes.forEach(n => {
                if (!n.prereqIds) n.prereqIds = n.prereqId ? [n.prereqId] : [];
                if (!n.outputIds) n.outputIds = n.outputId ? [n.outputId] : [];
                if (n.ownerId) { n.ownerIds = [n.ownerId]; delete n.ownerId; }
                if (!n.ownerIds) n.ownerIds = [];
                if (n.options) {
                    n.options.forEach(opt => {
                        if (!opt.prereqIds) opt.prereqIds = [];
                        if (!opt.outputIds) opt.outputIds = [];
                    });
                }
            });
            
            if (!data.items) data.items = [];
            if (!data.people) data.people = [];
            if (!data.categories) data.categories = [];
            
            if(typeof renderAll === 'function') renderAll();
            if(typeof centerAndFitGraph === 'function') setTimeout(centerAndFitGraph, 100);
            
        } catch (err) { alert("Error parsing JSON file!"); }
    };
    reader.readAsText(file);
});