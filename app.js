/* ═══════════════════════════════════════════════════
   HerraMax Plus — Catalog Generator Engine V3
   ═══════════════════════════════════════════════════ */

let products = [];
let imageBank = [];
let nextId = 1;
let currentStep = 1;
let categoryOrder = [];

// ── FIREBASE INIT ──
const firebaseConfig = {
  apiKey: "AIzaSyAa57ppjWFUcEdniw9WScABHssyACP3x3k",
  authDomain: "compras-herramax.firebaseapp.com",
  projectId: "compras-herramax",
  storageBucket: "compras-herramax.firebasestorage.app",
  messagingSenderId: "558573642669",
  appId: "1:558573642669:web:b73b4cd1ef5917d416b724"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
let currentUser = null;

auth.onAuthStateChanged(user => {
    currentUser = user;
    const authUi = document.getElementById('auth-ui');
    const overlay = document.getElementById('login-overlay');
    if (user) {
        if(overlay) overlay.style.display = 'none';
        authUi.innerHTML = `<span style="font-size:0.8rem; margin-right:10px; color:var(--txm)">${user.email}</span><button class="btn btn-ghost btn-sm" onclick="logout()">Salir</button>`;
    } else {
        if(overlay) overlay.style.display = 'flex';
        authUi.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="login()"><img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" style="width:14px; margin-right:6px; vertical-align:middle"> Iniciar Sesión</button>`;
    }
});

function login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => toast('Error al iniciar sesión', 'error'));
}
function logout() { auth.signOut(); }

document.addEventListener('DOMContentLoaded', () => {
    updateSteps();
});

function nextStep() {
    if (currentStep < 5) {
        currentStep++;
        updateSteps();
    }
}
function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateSteps();
    }
}
function goStep(step) {
    currentStep = step;
    updateSteps();
}

function updateSteps() {
    document.querySelectorAll('.step').forEach(el => {
        const s = parseInt(el.dataset.step);
        el.classList.toggle('active', s === currentStep);
        el.classList.toggle('done', s < currentStep);
    });

    document.querySelectorAll('.step-panel').forEach(el => {
        el.classList.toggle('active', el.id === 'panel-' + currentStep);
    });

    document.getElementById('step-indicator').textContent = `Paso ${currentStep} de 5`;
    document.getElementById('btn-prev').style.visibility = currentStep === 1 ? 'hidden' : 'visible';
    
    const btnNext = document.getElementById('btn-next');
    if (currentStep === 5) {
        btnNext.style.display = 'none';
    } else {
        btnNext.style.display = 'inline-flex';
        btnNext.textContent = 'Siguiente →';
    }

    if (currentStep === 2) renderProductsEditor();
    if (currentStep === 3) renderPricingTable();
    if (currentStep === 4) renderCategoryOrder();
    if (currentStep === 5) renderSummary();
}

function toast(msg, type = 'info') {
    const c = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = `toast ${type === 'success' ? 'ok' : type === 'error' ? 'er' : 'info'}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ── CLOUD SAVE / LOAD ──
async function saveToCloud() {
    if (!currentUser) { toast('Por favor, inicia sesión primero', 'error'); return; }
    
    let title = document.getElementById('d-title').value || 'Catálogo HerraMax';
    const docData = {
        title: title,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        products,
        imageBank,
        nextId,
        settings: {
            title: document.getElementById('d-title').value,
            subtitle: document.getElementById('d-subtitle').value,
            priceLabel: document.getElementById('d-price-label').value,
            footerNote: document.getElementById('d-footer-note').value,
            cols: document.getElementById('d-cols').value,
            theme: document.getElementById('d-theme').value,
            showCode: document.getElementById('d-show-code').value,
            showStock: document.getElementById('d-show-stock').value,
            whatsapp: document.getElementById('d-whatsapp').value,
            waText: document.getElementById('d-wa-text').value,
            email: document.getElementById('d-email').value,
            location: document.getElementById('d-location').value,
            categoryOrder
        }
    };

    try {
        toast('Guardando en la nube...', 'info');
        if (!window.currentCatalogId) {
            const ref = await db.collection('users').doc(currentUser.uid).collection('catalogs').add(docData);
            window.currentCatalogId = ref.id;
        } else {
            await db.collection('users').doc(currentUser.uid).collection('catalogs').doc(window.currentCatalogId).set(docData);
        }
        toast('¡Catálogo guardado en la nube!', 'success');
    } catch (e) {
        console.error(e);
        toast('Error al guardar en la nube', 'error');
    }
}

async function showCloudProjects() {
    if (!currentUser) { toast('Inicia sesión para ver tus catálogos', 'error'); return; }
    const modal = document.getElementById('cloud-modal');
    modal.style.display = 'flex';
    const list = document.getElementById('cloud-list');
    list.innerHTML = '<div style="padding:20px; text-align:center;">Cargando...</div>';
    
    try {
        const snap = await db.collection('users').doc(currentUser.uid).collection('catalogs').orderBy('updatedAt', 'desc').get();
        if (snap.empty) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--txm)">No tienes catálogos guardados.</div>';
            return;
        }
        let html = '';
        snap.forEach(doc => {
            const data = doc.data();
            const date = data.updatedAt ? data.updatedAt.toDate().toLocaleString() : 'Reciente';
            html += `<div style="padding:12px; border-bottom:1px solid var(--bd); display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${data.title}</strong><br>
                    <span style="font-size:0.8rem; color:var(--txm)">${data.products.length} productos | ${date}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-primary btn-sm" onclick="loadFromCloud('${doc.id}')">Abrir</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteFromCloud('${doc.id}')">✕</button>
                </div>
            </div>`;
        });
        list.innerHTML = html;
    } catch (e) {
        console.error(e);
        list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--er)">Error al cargar catálogos.</div>';
    }
}

function closeCloudModal() { document.getElementById('cloud-modal').style.display = 'none'; }

async function loadFromCloud(docId) {
    try {
        toast('Cargando catálogo...', 'info');
        const doc = await db.collection('users').doc(currentUser.uid).collection('catalogs').doc(docId).get();
        if (doc.exists) {
            const data = doc.data();
            window.currentCatalogId = doc.id;
            
            products = data.products || [];
            imageBank = data.imageBank || [];
            nextId = data.nextId || 1;
            categoryOrder = data.settings?.categoryOrder || [];
            
            if (data.settings) {
                if(data.settings.title) document.getElementById('d-title').value = data.settings.title;
                if(data.settings.subtitle) document.getElementById('d-subtitle').value = data.settings.subtitle;
                if(data.settings.priceLabel) document.getElementById('d-price-label').value = data.settings.priceLabel;
                if(data.settings.footerNote) document.getElementById('d-footer-note').value = data.settings.footerNote;
                if(data.settings.cols) document.getElementById('d-cols').value = data.settings.cols;
                if(data.settings.theme) document.getElementById('d-theme').value = data.settings.theme;
                if(data.settings.showCode) document.getElementById('d-show-code').value = data.settings.showCode;
                if(data.settings.showStock) document.getElementById('d-show-stock').value = data.settings.showStock;
                if(data.settings.whatsapp) document.getElementById('d-whatsapp').value = data.settings.whatsapp;
                if(data.settings.waText) document.getElementById('d-wa-text').value = data.settings.waText;
                if(data.settings.email) document.getElementById('d-email').value = data.settings.email;
                if(data.settings.location) document.getElementById('d-location').value = data.settings.location;
            }
            renderImgBank();
            closeCloudModal();
            toast('Proyecto cargado de la nube', 'success');
            goStep(2);
        }
    } catch (e) {
        console.error(e);
        toast('Error al cargar', 'error');
    }
}

async function deleteFromCloud(docId) {
    if(!confirm('¿Estás seguro de eliminar este catálogo de la nube?')) return;
    try {
        await db.collection('users').doc(currentUser.uid).collection('catalogs').doc(docId).delete();
        if(window.currentCatalogId === docId) window.currentCatalogId = null;
        showCloudProjects();
        toast('Catálogo eliminado', 'success');
    } catch(e) { toast('Error al eliminar', 'error'); }
}

// ── TEMPLATE DOWNLOAD ──
function downloadTemplate() {
    const ws_data = [['Código', 'Descripción', 'Precio Base', 'Marca', 'Categoría']];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, "Plantilla_HerraMax.xlsx");
}

// ── STEP 1: IMPORT ──
function showPasteModal() { document.getElementById('paste-modal').style.display = 'flex'; }
function closePasteModal() { document.getElementById('paste-modal').style.display = 'none'; }

function processPaste() {
    const raw = document.getElementById('paste-area').value.trim();
    if (!raw) { toast('No hay datos', 'error'); return; }
    
    const lines = raw.split('\n').filter(l => l.trim());
    let imported = 0;
    
    lines.forEach(line => {
        let parts = line.split('\t').map(s => s.trim());
        if(parts.length < 2) parts = line.split(/\s{2,}/).map(s => s.trim());
        
        if (parts.length >= 2) {
            let code = '', desc = '', price = 0;
            const lastVal = parseFloat(parts[parts.length - 1].replace(/[$,]/g, ''));
            if (!isNaN(lastVal)) {
                price = lastVal;
                if (parts.length >= 3) {
                    code = parts[0];
                    desc = parts.slice(1, -1).join(' ');
                } else {
                    desc = parts[0];
                }
            } else { desc = parts.join(' '); }
            if (desc) {
                addProduct({ code, description: desc, baseCost: price });
                imported++;
            }
        }
    });
    closePasteModal();
    if (imported > 0) { toast(`${imported} productos importados`, 'success'); nextStep(); }
}

function handleXLSUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, {header: 1});
        
        let imported = 0;
        rows.forEach((row, idx) => {
            if(idx === 0) return; // skip header
            if (row.length >= 2) {
                const code = row[0] || '';
                const desc = row[1] || '';
                const price = parseFloat(row[2]) || 0;
                const brand = row[3] || '';
                const cat = row[4] || '';
                if (desc) {
                    addProduct({ code: String(code), description: String(desc), baseCost: price, brand: String(brand), category: String(cat) });
                    imported++;
                }
            }
        });
        if (imported > 0) { toast(`${imported} productos desde Excel`, 'success'); nextStep(); }
    };
    reader.readAsArrayBuffer(file);
}

function handleXMLUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    let imported = 0, processed = 0;
    
    for (let j = 0; j < files.length; j++) {
        const file = files[j];
        const reader = new FileReader();
        reader.onload = (evt) => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(evt.target.result, "text/xml");
            const conceptos = xmlDoc.getElementsByTagName("cfdi:Concepto");
            
            for (let i = 0; i < conceptos.length; i++) {
                const node = conceptos[i];
                const desc = node.getAttribute("Descripcion");
                const code = node.getAttribute("NoIdentificacion") || '';
                const valUnitario = parseFloat(node.getAttribute("ValorUnitario")) || 0;
                if (desc) {
                    addProduct({ code, description: desc, baseCost: valUnitario });
                    imported++;
                }
            }
            
            processed++;
            if (processed === files.length) {
                if (imported > 0) { toast(`${imported} productos desde XML CFDI`, 'success'); nextStep(); } 
                else { toast('No se encontraron conceptos', 'error'); }
            }
        };
        reader.readAsText(file);
    }
}

function addProduct(data) {
    products.push({
        id: nextId++,
        code: data.code || '',
        description: data.description || '',
        brand: data.brand || '',
        category: data.category || '',
        baseCost: data.baseCost || 0,
        utilityPct: 30, 
        manualPrice: false,
        stockStatus: 'instock',
        imageData: data.imageData || null,
        selected: false
    });
    updateCategoryOrderData();
}

function addEmptyProduct() {
    addProduct({description: 'Nuevo Producto'});
    renderProductsEditor();
}

// ── STEP 2: PRODUCTS EDITOR ──
function renderProductsEditor() {
    const container = document.getElementById('products-editor');
    document.getElementById('total-count-2').textContent = products.length;
    
    if (products.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--txm)">No hay productos. Vuelve al Paso 1.</div>`;
        return;
    }
    
    container.innerHTML = products.map(p => `
        <div class="product-edit-row ${p.selected ? 'selected' : ''}" data-id="${p.id}">
            <input type="checkbox" class="pe-check" ${p.selected ? 'checked' : ''} onchange="toggleSelect(${p.id})">
            
            <div class="pe-thumb ${p.imageData ? 'has-img' : ''}" 
                 ondragover="event.preventDefault(); this.style.borderColor='var(--pr)'"
                 ondragleave="this.style.borderColor='var(--bd)'"
                 ondrop="dropImage(event, ${p.id}); this.style.borderColor='var(--bd)'">
                ${p.imageData ? `<img src="${p.imageData}">` : `<span class="pe-thumb-ph">📦</span>`}
            </div>
            
            <div class="pe-fields">
                <textarea class="pe-desc" onchange="updateProd(${p.id}, 'description', this.value)" placeholder="Descripción...">${p.description}</textarea>
            </div>
            
            <div class="pe-fields">
                <input type="text" class="pe-code" onchange="updateProd(${p.id}, 'code', this.value)" value="${p.code}" placeholder="Código">
                <input type="text" class="pe-brand" onchange="updateProd(${p.id}, 'brand', this.value)" value="${p.brand}" placeholder="Marca (Solvex...)">
            </div>
            
            <div class="pe-fields">
                <input type="text" class="pe-cat" onchange="updateProd(${p.id}, 'category', this.value)" value="${p.category}" placeholder="Categoría">
                <select class="pe-stock" onchange="updateProd(${p.id}, 'stockStatus', this.value)">
                    <option value="instock" ${p.stockStatus === 'instock' ? 'selected' : ''}>En stock</option>
                    <option value="order" ${p.stockStatus === 'order' ? 'selected' : ''}>Bajo pedido</option>
                </select>
            </div>
            
            <button class="pe-del" onclick="deleteProduct(${p.id})">✕</button>
        </div>
    `).join('');
    
    updateDeleteBtn();
}

function updateProd(id, field, value) {
    const p = products.find(x => x.id === id);
    if (p) {
        p[field] = value;
        if(field === 'category') updateCategoryOrderData();
    }
}

function deleteProduct(id) {
    products = products.filter(p => p.id !== id);
    updateCategoryOrderData();
    renderProductsEditor();
}

function toggleSelect(id) {
    const p = products.find(x => x.id === id);
    if (p) { p.selected = !p.selected; renderProductsEditor(); }
}

function selectAllProducts() {
    const cb = document.getElementById('select-all-cb');
    const checked = cb ? cb.checked : true;
    products.forEach(p => p.selected = checked);
    renderProductsEditor();
}

function deleteSelected() {
    products = products.filter(p => !p.selected);
    updateCategoryOrderData();
    renderProductsEditor();
}

function updateDeleteBtn() {
    const hasSel = products.some(p => p.selected);
    const btn = document.getElementById('btn-delete-sel');
    if(btn) btn.style.display = hasSel ? 'inline-flex' : 'none';
}

function applyBulk(field) {
    const val = document.getElementById(`bulk-${field === 'brand' ? 'brand' : 'cat'}`).value.trim();
    if (!val) { toast(`Escribe un valor para la ${field === 'brand' ? 'marca' : 'categoría'}`, 'error'); return; }
    let count = 0;
    products.forEach(p => {
        if (p.selected) { p[field] = val; count++; }
    });
    if (field === 'category') updateCategoryOrderData();
    renderProductsEditor();
    toast(`${count} actualizados`, 'success');
}

// ── IMAGE BANK ──
function handleImgBankSelect(e) { processImgFiles(e.target.files); }
function handleImgBankDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('over');
    processImgFiles(e.dataTransfer.files);
}
async function processImgFiles(files) {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    if (!currentUser) {
        // Fallback to local base64
        let count = 0;
        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                imageBank.push({ id: nextId++, data: e.target.result, name: file.name });
                count++;
                if (count === validFiles.length) {
                    renderImgBank();
                    toast(`${count} imágenes cargadas (Local)`, 'success');
                }
            };
            reader.readAsDataURL(file);
        });
        return;
    }
    
    toast(`Procesando ${validFiles.length} imágenes...`, 'info');
    let countCloud = 0;
    let countLocal = 0;
    
    const uploadTasks = validFiles.map(file => {
        return new Promise(async (resolve) => {
            try {
                const path = `catalogs/${currentUser.uid}/images/${Date.now()}_${file.name}`;
                const ref = storage.ref(path);
                await ref.put(file);
                const url = await ref.getDownloadURL();
                imageBank.push({ id: nextId++, data: url, name: file.name });
                countCloud++;
                resolve();
            } catch (err) { 
                console.error("Error upload:", err); 
                // Fallback to local base64 if cloud upload fails
                const reader = new FileReader();
                reader.onload = (e) => {
                    imageBank.push({ id: nextId++, data: e.target.result, name: file.name });
                    countLocal++;
                    resolve();
                };
                reader.onerror = resolve;
                reader.readAsDataURL(file);
            }
        });
    });
    
    await Promise.all(uploadTasks);
    renderImgBank();
    if (countLocal > 0) {
        toast(`${countCloud} en nube, ${countLocal} locales`, 'warn');
    } else {
        toast(`${countCloud} imágenes guardadas en la nube`, 'success');
    }
}
function renderImgBank() {
    const search = document.getElementById('img-search').value.toLowerCase();
    const filtered = imageBank.filter(img => img.name.toLowerCase().includes(search));
    document.getElementById('img-bank-grid').innerHTML = filtered.map(img => `
        <div class="bank-img" draggable="true" ondragstart="event.dataTransfer.setData('text/plain', '${img.id}')" title="${esc(img.name)}">
            <img src="${img.data}" alt="">
        </div>
    `).join('');
}
function dropImage(e, prodId) {
    e.preventDefault();
    const imgId = parseInt(e.dataTransfer.getData('text/plain'));
    const img = imageBank.find(i => i.id === imgId);
    if (img) { updateProd(prodId, 'imageData', img.data); renderProductsEditor(); }
}
function autoAssignImages() {
    let assigned = 0;
    products.forEach(p => {
        if (p.code && !p.imageData) {
            const match = imageBank.find(img => {
                let nameWithoutExt = img.name.substring(0, img.name.lastIndexOf('.')) || img.name;
                nameWithoutExt = nameWithoutExt.replace(/_\d+$/, ''); // Remove _1, _2 from duplicates
                return nameWithoutExt.toLowerCase() === p.code.toLowerCase();
            });
            if (match) { p.imageData = match.data; assigned++; }
        }
    });
    if (assigned > 0) { renderProductsEditor(); toast(`${assigned} imágenes asignadas auto.`, 'success'); } 
    else { toast('No se encontraron coincidencias', 'error'); }
}

// ── STEP 3: PRICING ──
function renderPricingTable() {
    const container = document.getElementById('pricing-table');
    let html = `
        <div class="pt-row pt-header">
            <div></div>
            <div>PRODUCTO</div>
            <div>COSTO BASE</div>
            <div>UTILIDAD %</div>
            <div>MANUAL</div>
            <div>PRECIO FINAL</div>
        </div>
    `;
    html += products.map(p => {
        const finalPrice = calculateFinalPrice(p);
        return `
        <div class="pt-row" data-id="${p.id}">
            <input type="checkbox" class="pt-check" ${p.selected ? 'checked' : ''} onchange="toggleSelectPrice(${p.id})">
            <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${p.description}">${p.description}</div>
            <div class="pt-cost">$${p.baseCost.toFixed(2)}</div>
            <div><input type="number" class="pt-util-input" value="${p.utilityPct}" onchange="updateProdPrice(${p.id}, 'utilityPct', this.value)" ${p.manualPrice ? 'disabled' : ''}></div>
            <div class="pt-no-price">
                <input type="checkbox" id="man-${p.id}" ${p.manualPrice ? 'checked' : ''} onchange="updateProdPrice(${p.id}, 'manualPrice', this.checked)">
                <label for="man-${p.id}">Sin precio</label>
            </div>
            <div class="pt-final">${p.manualPrice ? '___' : '$' + finalPrice.toFixed(2)}</div>
        </div>
    `}).join('');
    container.innerHTML = html;
}
function toggleSelectPrice(id) {
    const p = products.find(x => x.id === id);
    if (p) { p.selected = !p.selected; renderPricingTable(); }
}
function selectAllForPricing() { products.forEach(p => p.selected = true); renderPricingTable(); }
function applyBulkUtility() {
    const util = parseFloat(document.getElementById('bulk-utility').value) || 0;
    products.forEach(p => { if (p.selected && !p.manualPrice) p.utilityPct = util; });
    renderPricingTable();
    toast(`Utilidad aplicada`, 'success');
}
function updateProdPrice(id, field, value) {
    const p = products.find(x => x.id === id);
    if (p) {
        if (field === 'utilityPct') p[field] = parseFloat(value) || 0; else p[field] = value;
        renderPricingTable();
    }
}
document.getElementById('global-iva').addEventListener('change', renderPricingTable);
document.getElementById('cost-has-iva').addEventListener('change', renderPricingTable);

function calculateFinalPrice(p) {
    let cost = p.baseCost;
    const globalIva = parseFloat(document.getElementById('global-iva').value) || 0;
    const costHasIva = document.getElementById('cost-has-iva').value === 'yes';
    if (!costHasIva && globalIva > 0) cost = cost * (1 + (globalIva / 100));
    return cost * (1 + (p.utilityPct / 100));
}

// ── STEP 4: CATEGORY ORDERING ──
function updateCategoryOrderData() {
    const currentCats = [...new Set(products.map(p => p.category || 'Sin Categoría'))];
    // Add new ones
    currentCats.forEach(c => {
        if (!categoryOrder.find(x => x.original === c)) {
            categoryOrder.push({ original: c, label: c });
        }
    });
    // Remove unused
    categoryOrder = categoryOrder.filter(x => currentCats.includes(x.original));
}

let draggedItem = null;
function renderCategoryOrder() {
    updateCategoryOrderData();
    const container = document.getElementById('category-order-list');
    container.innerHTML = categoryOrder.map((c, idx) => {
        const count = products.filter(p => (p.category || 'Sin Categoría') === c.original).length;
        return `
        <div class="cat-order-item" draggable="true" data-index="${idx}">
            <div class="cat-drag-handle">☰</div>
            <input type="text" class="cat-order-input" value="${c.label}" onchange="updateCatLabel(${idx}, this.value)">
            <span class="cat-order-count">${count} prod.</span>
        </div>
    `}).join('');

    const items = container.querySelectorAll('.cat-order-item');
    items.forEach(item => {
        item.addEventListener('dragstart', (e) => { draggedItem = item; setTimeout(() => item.style.display = 'none', 0); });
        item.addEventListener('dragend', () => { draggedItem = null; item.style.display = 'flex'; });
        item.addEventListener('dragover', e => e.preventDefault());
        item.addEventListener('drop', function(e) {
            e.preventDefault();
            if (this !== draggedItem) {
                const srcIdx = parseInt(draggedItem.dataset.index);
                const destIdx = parseInt(this.dataset.index);
                const moved = categoryOrder.splice(srcIdx, 1)[0];
                categoryOrder.splice(destIdx, 0, moved);
                renderCategoryOrder();
            }
        });
    });
}
function updateCatLabel(idx, val) {
    if(categoryOrder[idx]) categoryOrder[idx].label = val;
}

// ── STEP 5: GENERATE ──
function renderSummary() {
    document.getElementById('gen-summary').innerHTML = `
        <div class="gs-row"><span class="gs-label">Total Productos</span><span class="gs-value">${products.length}</span></div>
        <div class="gs-row"><span class="gs-label">Con imagen</span><span class="gs-value">${products.filter(p=>p.imageData).length}</span></div>
        <div class="gs-row"><span class="gs-label">Categorías</span><span class="gs-value">${categoryOrder.length}</span></div>
    `;
}

function generateCatalog() {
    if (products.length === 0) { toast('No hay productos', 'error'); return; }

    const title = document.getElementById('d-title').value || 'Catálogo';
    const subtitle = document.getElementById('d-subtitle').value;
    const priceLabel = document.getElementById('d-price-label').value;
    const footerNote = document.getElementById('d-footer-note').value;
    const cols = document.getElementById('d-cols').value;
    const theme = document.getElementById('d-theme').value;
    const showCode = document.getElementById('d-show-code').value === 'yes';
    const showStock = document.getElementById('d-show-stock').value === 'yes';
    const whatsapp = document.getElementById('d-whatsapp').value;
    const waText = document.getElementById('d-wa-text').value;
    const email = document.getElementById('d-email').value || 'herramaxplus@gmail.com';
    const location = document.getElementById('d-location').value || 'Puebla, México';

    const today = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
    const vigencia = `VIGENCIA ${today}`;

    // Group by ordered categories
    const groups = {};
    categoryOrder.forEach(co => { groups[co.label] = []; });
    
    products.forEach(p => {
        const catOriginal = p.category || 'Sin Categoría';
        const orderObj = categoryOrder.find(x => x.original === catOriginal);
        const finalLabel = orderObj ? orderObj.label : catOriginal;
        if (!groups[finalLabel]) groups[finalLabel] = [];
        groups[finalLabel].push(p);
    });

    let cardsHtml = '';
    categoryOrder.forEach(co => {
        const catLabel = co.label;
        const prods = groups[catLabel];
        if (!prods || prods.length === 0) return;
        
        if (categoryOrder.length > 1) cardsHtml += `<div class="cat-category-header">${esc(catLabel)}</div>`;
        
        prods.forEach(p => {
            const finalPrice = calculateFinalPrice(p);
            const imgHtml = p.imageData ? `<img class="cat-img" src="${p.imageData}">` : `<div class="cat-placeholder"><span>No disponible</span></div>`;
                
            let stockHtml = '';
            if (showStock) {
                if (p.stockStatus === 'instock') stockHtml = `<span class="badge-stock badge-instock">En stock</span>`;
                else if (p.stockStatus === 'order') stockHtml = `<span class="badge-stock badge-order">Bajo pedido</span>`;
            }

            const priceHtml = p.manualPrice ? `<span class="cat-price-value" style="color:var(--cat-muted)">$_______</span>` : `<span class="cat-price-value">$${finalPrice.toFixed(2)}</span>`;
            const brandHtml = p.brand ? `<div class="cat-brand">${esc(p.brand)}</div>` : '';

            cardsHtml += `
                <div class="cat-card">
                    <div class="cat-img-wrap">${imgHtml}</div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                        ${showCode && p.code ? `<div class="cat-code">COD: ${esc(p.code)}</div>` : '<div></div>'}
                        ${stockHtml}
                    </div>
                    ${brandHtml}
                    <div class="cat-name">${esc(p.description)}</div>
                    <div class="cat-price-row">
                        <span class="cat-price-label">${esc(priceLabel)}</span>
                        ${priceHtml}
                    </div>
                </div>`;
        });
    });

    const whatsappHtml = whatsapp ? `<a class="cat-whatsapp" href="https://wa.me/${whatsapp}?text=Hola%2C%20me%20interesa%20el%20catálogo%20${encodeURIComponent(title)}" target="_blank">${esc(waText)}</a>` : '';
    const logoUrl = "https://paocarvajal.github.io/Catalogo-Template-Herramax/1111%20Logo%20HerraMax%20Plus_Dig.jpg";

    const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)} | HerraMax Plus</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700;900&family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <style>
        :root{--cat-bg:${theme==='dark'?'#0c0f14':'#ffffff'};--cat-surface:${theme==='dark'?'#151921':'#f8fafc'};--cat-text:${theme==='dark'?'#e8ecf4':'#020617'};--cat-muted:${theme==='dark'?'#8892a4':'#64748b'};--cat-border:${theme==='dark'?'#2a3244':'#e2e8f0'};--cat-primary:#FF8C00;--cat-secondary:${theme==='dark'?'#e8ecf4':'#020617'};
        --ok:#22c55e;--okd:${theme==='dark'?'rgba(34,197,94,.12)':'#dcfce7'};--warn:#f59e0b;--warnd:${theme==='dark'?'rgba(245,158,11,.12)':'#fef3c7'};}
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:var(--cat-bg);color:var(--cat-text);font-family:'Inter',sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased;}
        .cat-container{max-width:1200px;margin:0 auto;padding:40px 20px;}
        .cat-header{text-align:center;margin-bottom:40px;border-bottom:4px solid var(--cat-primary);padding-bottom:20px;}
        .cat-title{font-family:'Outfit',sans-serif;font-size:2.5rem;font-weight:900;text-transform:uppercase;letter-spacing:-1px;color:var(--cat-secondary);}
        .cat-subtitle{font-family:'Outfit',sans-serif;font-size:1.1rem;font-weight:700;text-transform:uppercase;letter-spacing:4px;color:var(--cat-primary);margin-top:4px;}
        .cat-date{font-size:.82rem;color:var(--cat-muted);margin-top:8px;}
        .cat-grid{display:grid;grid-template-columns:repeat(${cols},1fr);gap:18px;}
        .cat-category-header{grid-column:1/-1;font-family:'Outfit',sans-serif;font-size:1.3rem;font-weight:800;color:var(--cat-primary);text-transform:uppercase;letter-spacing:2px;border-bottom:2px solid var(--cat-primary);padding:16px 0 8px;margin-top:16px;}
        .cat-card{background:var(--cat-surface);border:1px solid var(--cat-border);border-radius:12px;padding:16px;display:flex;flex-direction:column;box-shadow:0 2px 8px rgba(0,0,0,.06);page-break-inside:avoid;break-inside:avoid;}
        .cat-img-wrap{width:100%;height:160px;background:var(--cat-bg);border-radius:8px;margin-bottom:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;}
        .cat-img{max-width:100%;max-height:100%;object-fit:contain;}
        .cat-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--cat-muted);font-size:.75rem;background:var(--cat-surface);border-radius:8px;}
        .cat-code{font-family:'Outfit',sans-serif;font-size:.75rem;color:var(--cat-primary);font-weight:700;}
        .badge-stock{padding:2px 8px;border-radius:10px;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
        .badge-instock{background:var(--okd);color:var(--ok);}
        .badge-order{background:var(--warnd);color:var(--warn);}
        .cat-brand{font-size:.7rem;font-weight:700;color:var(--cat-primary);margin-bottom:2px;text-transform:uppercase;letter-spacing:1px;}
        .cat-name{font-size:.82rem;font-weight:600;color:var(--cat-text);line-height:1.3;flex-grow:1;margin-bottom:12px;text-transform:uppercase;}
        .cat-price-row{display:flex;align-items:flex-end;justify-content:space-between;border-top:1px solid var(--cat-border);padding-top:10px;margin-top:auto;}
        .cat-price-label{font-size:.68rem;color:var(--cat-muted);font-weight:600;text-transform:uppercase;line-height:1.2;}
        .cat-price-value{font-family:'Outfit',sans-serif;font-size:1.4rem;font-weight:900;color:var(--cat-secondary);}
        .cat-footer{text-align:center;margin-top:40px;padding-top:24px;border-top:2px solid var(--cat-border);}
        .cat-footer p{font-size:.82rem;color:var(--cat-muted);}
        .cat-whatsapp{display:inline-flex;align-items:center;gap:8px;margin-top:12px;padding:10px 24px;background:#25d366;color:#fff;border-radius:50px;font-weight:700;text-decoration:none;font-size:.9rem;}
        
        .cover-page, .backcover-page { background-color: #ffffff; color: #111827; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px; }
        .page-break { page-break-after: always; }
        .cover-logo { max-width: 250px; margin-bottom: 40px; }
        .cover-tag { font-size: 0.9rem; font-weight: 700; letter-spacing: 3px; color: var(--cat-primary); margin-bottom: 20px; text-transform: uppercase; border: 1px solid var(--cat-primary); padding: 8px 24px; border-radius: 30px; }
        .cover-title { font-family: 'Outfit', sans-serif; font-size: 4.5rem; font-weight: 900; line-height: 1.1; margin-bottom: 16px; text-transform: uppercase; color: #111827; }
        .cover-subtitle { font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 500; letter-spacing: 4px; color: #4b5563; text-transform: uppercase; }
        .bc-box { border: 2px solid var(--cat-primary); padding: 12px 40px; margin-bottom: 30px; display: inline-block; }
        .bc-title { font-family: 'Outfit', sans-serif; font-size: 3rem; font-weight: 800; color: var(--cat-primary); text-transform: uppercase; line-height: 1; }
        .bc-subtitle { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 700; margin-bottom: 40px; text-transform: uppercase; color: #111827; }
        .bc-divider { width: 100px; height: 3px; background-color: var(--cat-primary); margin: 30px auto; }
        .bc-contact-title { font-size: 1.5rem; font-weight: 700; color: var(--cat-primary); margin-bottom: 20px; }
        .bc-contact-info { font-size: 1.1rem; font-weight: 600; line-height: 2; margin-bottom: 30px; color: #111827; }
        .bc-details { font-size: 0.9rem; color: #4b5563; line-height: 1.8; margin-bottom: 40px; font-weight: 500; }
        .bc-location { color: var(--cat-primary); font-weight: 600; margin-bottom: 40px; }
        .bc-vigencia { font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 800; color: var(--cat-primary); margin-top: auto; }
        .bc-copy { font-size: 0.75rem; color: #9ca3af; margin-top: 20px; }

        @media print {
            @page { margin: 0; }
            body { background: white; }
            .cat-container { padding: 2cm; max-width: none; }
            .cat-card { box-shadow: none; border-color: #e5e7eb; }
            .cat-whatsapp { display: none; }
            .cover-page, .backcover-page { height: 100vh; padding: 2cm; }
        }
        @media (max-width: 768px) {
            .cat-grid { grid-template-columns: repeat(2, 1fr); }
            .cover-title { font-size: 3rem; }
            .bc-title { font-size: 2rem; }
        }
    </style>
</head>
<body>
    <div class="cover-page page-break">
        <img src="${logoUrl}" alt="HerraMax Plus" class="cover-logo">
        <div class="cover-tag">✦ CATÁLOGO EXCLUSIVO MAYORISTAS ✦</div>
        <div class="cover-title">${esc(title)}</div>
        <div class="cover-subtitle">${esc(subtitle)}</div>
    </div>
    <div class="cat-container">
        <div class="cat-header">
            <div class="cat-title">${esc(title)}</div>
            ${subtitle ? `<div class="cat-subtitle">${esc(subtitle)}</div>` : ''}
            <div class="cat-date">${today} · ${products.length} productos</div>
        </div>
        <div class="cat-grid">${cardsHtml}</div>
        <div class="cat-footer">
            <p>${esc(footerNote)}</p>
            <p style="margin-top:4px;">HerraMax Plus · Tu ferretería de confianza</p>
            ${whatsappHtml}
        </div>
    </div>
    <div class="backcover-page" style="page-break-before: always;">
        <img src="${logoUrl}" alt="HerraMax Plus" class="cover-logo" style="max-width: 180px; margin-bottom: 20px;">
        <div class="bc-box"><div class="bc-title">HERRAMAX PLUS</div></div>
        <div class="bc-subtitle">TU MEJOR ALIADO</div>
        <div class="bc-divider"></div>
        <div class="bc-contact-title">CONTACTO</div>
        <div class="bc-contact-info">${esc(email)}<br>Tel / WhatsApp: ${esc(whatsapp)}</div>
        <div class="bc-divider"></div>
        <div class="bc-details">Venta exclusiva mayoreo<br>Precios incluyen IVA<br>Stock disponible inmediato</div>
        <div class="bc-location">${esc(location)}</div>
        <div class="bc-vigencia">${vigencia}</div>
        <div class="bc-copy">© ${new Date().getFullYear()} HerraMax Plus — Todos los derechos reservados</div>
    </div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    const a = document.createElement('a');
    a.href = url;
    a.download = `Catalogo_${title.replace(/\s+/g, '_')}.html`;
    a.click();
}

function loadDemo() {
    products = [];
    addProduct({code: '500122', description: 'Mezcladora Lavabo Cuello Alto', baseCost: 150, category: 'Grifería', brand: 'Solvex Fonthy'});
    addProduct({code: '500179', description: 'Mezcladora Lavabo Flexible', baseCost: 180, category: 'Grifería', brand: 'Solvex Plus'});
    addProduct({code: '8860', description: 'Manguerilla para Gas 60cm', baseCost: 35, category: 'Accesorios', stockStatus: 'order', brand: 'Glowels'});
    toast('Demo cargada', 'success');
    goStep(2);
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
