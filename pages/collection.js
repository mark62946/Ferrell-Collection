// ── Collection Page ──
const CollectionPage = {
  page: 1,
  pageSize: 50,
  total: 0,
  sets: [],
  filterSet: '',
  filterPlayer: '',
  filterTimer: null,
  sortCol: 'player',
  sortDir: 'asc',
  allData: [],

  async render() {
    const el = document.getElementById('page-collection');
    el.innerHTML = `<div class="loading"><div class="spinner"></div> Loading…</div>`;
    try {
      this.sets = await Sets.getAll();
      this.page = 1;
      el.innerHTML = this.scaffold();
      this.bindEvents();
      await this.loadTable();
    } catch(err) {
      el.innerHTML = `<div class="loading" style="color:var(--danger)">Error: ${err.message}</div>`;
    }
  },

  scaffold() {
    const setOptions = this.sets.map(s =>
      `<option value="${s.id}">${s.year} ${s.brand} ${s.set_name}${s.series ? ' — '+s.series : ''}</option>`
    ).join('');
    return `
      <div class="page-header flex-between">
        <div><div class="page-title">My Collection</div><div class="page-subtitle">All raw cards you own</div></div>
        <button class="btn btn-primary" onclick="CollectionPage.openAddModal()">+ Add Card</button>
      </div>
      <div class="toolbar">
        <input type="text" id="col-search" placeholder="Search player…">
        <select id="col-set-filter">
          <option value="">All Sets</option>
          ${setOptions}
        </select>
        <button class="btn" onclick="CollectionPage.exportCSV()">↓ Export</button>
      </div>
      <div id="col-count" class="text-muted text-sm" style="margin-bottom:8px"></div>
      <div id="col-table"></div>
      <div id="col-pagination" class="pagination"></div>`;
  },

  bindEvents() {
    document.getElementById('col-search').addEventListener('input', e => {
      clearTimeout(this.filterTimer);
      this.filterPlayer = e.target.value;
      this.page = 1;
      this.filterTimer = setTimeout(() => this.loadTable(), 300);
    });
    document.getElementById('col-set-filter').addEventListener('change', e => {
      this.filterSet = e.target.value;
      this.page = 1;
      this.loadTable();
    });
  },

  sortData(data) {
    const col = this.sortCol;
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      let av, bv;
      if (col === 'num') {
        const extractNum = s => { const m = String(s||'').trim().match(/(\d+)$/); return m ? parseInt(m[1]) : 0; };
        const aPrefix = String(a.cards.card_number||'').trim().replace(/\d+$/, '');
        const bPrefix = String(b.cards.card_number||'').trim().replace(/\d+$/, '');
        if (aPrefix === bPrefix) return dir * (extractNum(a.cards.card_number) - extractNum(b.cards.card_number));
        return dir * aPrefix.localeCompare(bPrefix);
      } else if (col === 'player') {
        av = (a.cards.player || '').toLowerCase();
        bv = (b.cards.player || '').toLowerCase();
      } else if (col === 'set') {
        av = ((a.cards.sets.year || '') + ' ' + (a.cards.sets.brand || '') + ' ' + (a.cards.sets.set_name || '')).toLowerCase();
        bv = ((b.cards.sets.year || '') + ' ' + (b.cards.sets.brand || '') + ' ' + (b.cards.sets.set_name || '')).toLowerCase();
      } else if (col === 'qty') {
        return dir * ((a.quantity || 0) - (b.quantity || 0));
      } else if (col === 'pars') {
        return dir * ((a.parallels || []).length - (b.parallels || []).length);
      } else if (col === 'condition') {
        av = (a.condition || '').toLowerCase();
        bv = (b.condition || '').toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  },

  setSort(col) {
    if (this.sortCol === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortCol = col;
      this.sortDir = 'asc';
    }
    this.renderTable(this.allData);
  },

  sortIcon(col) {
    if (this.sortCol !== col) return '<span style="color:var(--text3);margin-left:4px;font-size:10px">⇅</span>';
    return this.sortDir === 'asc'
      ? '<span style="color:var(--accent);margin-left:4px;font-size:10px">▲</span>'
      : '<span style="color:var(--accent);margin-left:4px;font-size:10px">▼</span>';
  },

  async loadTable() {
    document.getElementById('col-table').innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
    try {
      const { data, count } = await Collection.getAll(this.page, this.pageSize, {
        setId: this.filterSet || undefined,
        player: this.filterPlayer || undefined
      });

      let filtered = data;

      this.total = count;
      this.allData = filtered;
      document.getElementById('col-count').textContent = `${filtered.length} cards shown`;

      if (!filtered.length) {
        document.getElementById('col-table').innerHTML = `<div class="table-wrap"><table><tr class="empty-row"><td colspan="7">No cards in your collection yet. Click "Add Card" to get started!</td></tr></table></div>`;
        document.getElementById('col-pagination').innerHTML = '';
        return;
      }

      this.renderTable(filtered);
      this.renderPagination();
    } catch(err) {
      document.getElementById('col-table').innerHTML = `<div class="loading" style="color:var(--danger)">Error: ${err.message}</div>`;
    }
  },

  renderTable(data) {
    const sorted = this.sortData(data);

    const thStyle = 'cursor:pointer;user-select:none;white-space:nowrap;';
    let html = `<div class="table-wrap"><table>
      <thead><tr>
        <th style="${thStyle}" onclick="CollectionPage.setSort('num')">#${this.sortIcon('num')}</th>
        <th style="${thStyle}" onclick="CollectionPage.setSort('player')">Player${this.sortIcon('player')}</th>
        <th style="${thStyle}" onclick="CollectionPage.setSort('set')">Set${this.sortIcon('set')}</th>
        <th style="${thStyle};text-align:center" onclick="CollectionPage.setSort('qty')">Base QTY${this.sortIcon('qty')}</th>
        <th style="${thStyle}" onclick="CollectionPage.setSort('pars')">Parallels${this.sortIcon('pars')}</th>
        <th style="${thStyle}" onclick="CollectionPage.setSort('condition')">Condition${this.sortIcon('condition')}</th>
        <th>Actions</th>
      </tr></thead><tbody>`;

    sorted.forEach(entry => {
      const c = entry.cards;
      const set = c.sets;
      const pars = entry.parallels || [];
      const parTotal = pars.reduce((sum, p) => sum + (p.quantity || 1), 0);

      html += `<tr>
        <td style="color:var(--text3);white-space:nowrap">${escH(c.card_number)}</td>
        <td>
          <span style="font-weight:500">${escH(c.player)}</span>
          ${specBadge(c.specialty)}
        </td>
        <td style="font-size:12px">${escH(set.year)} ${escH(set.brand)}<br><span style="color:var(--text3)">${escH(set.set_name)}${set.series ? ' — '+set.series : ''}</span></td>
        <td style="font-weight:600;color:var(--accent);text-align:center">${entry.quantity}</td>
        <td>${pars.length > 0
          ? `<div style="display:flex;flex-direction:column;gap:3px">
               <div style="font-size:12px;font-weight:600;color:var(--purple);margin-bottom:2px">${parTotal} total cop${parTotal !== 1 ? 'ies' : 'y'}</div>
               <div class="par-tags">${pars.map(p => `<span class="par-tag">${escH(p.parallel_name)} ×${p.quantity}${p.serial_number ? ` <span class="serial">${escH(p.serial_number)}</span>` : ''}</span>`).join('')}</div>
             </div>`
          : '<span class="text-muted text-sm">—</span>'}</td>
        <td style="font-size:12px;color:var(--text3)">${escH(entry.condition || '—')}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm" onclick="CollectionPage.openEditModal(${entry.id}, ${c.id})">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="CollectionPage.deleteEntry(${entry.id})">Del</button>
          </div>
        </td>
      </tr>`;
    });

    html += `</tbody></table></div>`;
    document.getElementById('col-table').innerHTML = html;
  },

  renderPagination() {
    const pages = Math.ceil(this.total / this.pageSize);
    if (pages <= 1) { document.getElementById('col-pagination').innerHTML = ''; return; }
    let html = '';
    if (this.page > 1) html += `<button class="btn btn-sm" onclick="CollectionPage.goPage(${this.page-1})">‹ Prev</button>`;
    html += `<span class="page-info">Page ${this.page} of ${pages}</span>`;
    if (this.page < pages) html += `<button class="btn btn-sm" onclick="CollectionPage.goPage(${this.page+1})">Next ›</button>`;
    document.getElementById('col-pagination').innerHTML = html;
  },

  goPage(p) { this.page = p; this.loadTable(); },

  openAddModal() {
    const setOptions = this.sets.map(s =>
      `<option value="${s.id}">${s.year} ${s.brand} ${s.set_name}${s.series ? ' — '+s.series : ''}</option>`
    ).join('');
    openModal('Add Card to Collection', `
      <div class="form-section-title">Find Card</div>
      <div class="form-grid">
        <div class="form-group">
          <label>Set</label>
          <select id="add-set-id" onchange="CollectionPage.loadCardsForSet(this.value)">
            <option value="">Select a set…</option>${setOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Card</label>
          <select id="add-card-id"><option value="">Select set first…</option></select>
        </div>
      </div>
      <div class="form-section-title">Ownership Details</div>
      <div class="form-grid">
        <div class="form-group"><label>Quantity</label><input type="number" id="add-qty" value="1" min="1"></div>
        <div class="form-group"><label>Condition</label>
          <select id="add-condition">
            <option value="">—</option>
            <option>Mint</option><option>Near Mint</option><option>Excellent</option><option>Very Good</option><option>Good</option><option>Fair</option><option>Poor</option>
          </select>
        </div>
        <div class="form-group"><label>Purchase Price ($)</label><input type="number" id="add-price" step="0.01" placeholder="0.00"></div>
        <div class="form-group"><label>Purchase Date</label><input type="date" id="add-date"></div>
      </div>
      <div class="form-group mt-1"><label>Notes</label><textarea id="add-notes" placeholder="Any notes…"></textarea></div>
      <div class="form-section-title">Parallels</div>
      <div id="add-parallels-list"></div>
      <button class="btn btn-sm mt-1" onclick="CollectionPage.addParallelRow()">+ Add Parallel</button>
      <div class="form-actions">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="CollectionPage.saveAdd()">Save to Collection</button>
      </div>
    `);
  },

  async loadCardsForSet(setId) {
    const sel = document.getElementById('add-card-id');
    if (!setId) { sel.innerHTML = '<option>Select set first…</option>'; return; }
    sel.innerHTML = '<option>Loading…</option>';
    const cards = await Cards.getBySet(setId);
    sel.innerHTML = cards.map(c => `<option value="${c.id}">#${c.card_number} — ${c.player}${c.specialty ? ' ('+c.specialty+')' : ''}</option>`).join('');
  },

  parallelCount: 0,
  addParallelRow(data = {}) {
    const id = ++this.parallelCount;
    const div = document.createElement('div');
    div.id = `par-row-${id}`;
    div.className = 'par-item';
    div.style.marginBottom = '6px';
    div.innerHTML = `
      <select class="par-select" style="flex:2" id="par-name-${id}">
        ${PARALLEL_OPTIONS.map(o => `<option${o===data.parallel_name?' selected':''}>${o}</option>`).join('')}
      </select>
      <input class="par-qty" type="number" min="1" value="${data.quantity||1}" id="par-qty-${id}" style="width:50px">
      <input class="par-notes" type="text" placeholder="Serial e.g. 31/99" value="${escH(data.serial_number||data.notes||'')}" id="par-serial-${id}" style="width:110px">
      <button class="par-rm btn-icon btn" onclick="document.getElementById('par-row-${id}').remove()">×</button>`;
    const list = document.getElementById('add-parallels-list') || document.getElementById('edit-parallels-list');
    if (list) list.appendChild(div);
  },

  getParallelRows(prefix = 'add') {
    const list = document.getElementById(`${prefix}-parallels-list`);
    if (!list) return [];
    return Array.from(list.querySelectorAll('[id^="par-row-"]')).map(row => {
      const id = row.id.replace('par-row-', '');
      return {
        parallel_name: document.getElementById(`par-name-${id}`).value,
        quantity: parseInt(document.getElementById(`par-qty-${id}`).value) || 1,
        serial_number: document.getElementById(`par-serial-${id}`).value || null
      };
    });
  },

  async saveAdd() {
    const cardId = document.getElementById('add-card-id').value;
    if (!cardId) { showToast('Please select a card', 'error'); return; }
    try {
      const entry = {
        quantity: parseInt(document.getElementById('add-qty').value) || 1,
        condition: document.getElementById('add-condition').value || null,
        purchase_price: parseFloat(document.getElementById('add-price').value) || null,
        purchase_date: document.getElementById('add-date').value || null,
        notes: document.getElementById('add-notes').value || null
      };
      const colId = await Collection.upsert(cardId, entry);
      await Parallels.upsertAll(colId, this.getParallelRows('add'));
      closeModal();
      showToast('Card added to collection!', 'success');
      this.loadTable();
      updateSidebarStats();
    } catch(err) {
      showToast('Error: ' + err.message, 'error');
    }
  },

  async openEditModal(colId, cardId) {
    // For brevity, reuse add modal pre-populated — full impl would load existing data
    showToast('Edit: use Add Card to update — full edit coming in next update', 'error');
  },

  async deleteEntry(id) {
    if (!confirm('Remove this card from your collection?')) return;
    try {
      await Collection.delete(id);
      showToast('Removed', 'success');
      this.loadTable();
      updateSidebarStats();
    } catch(err) {
      showToast('Error: ' + err.message, 'error');
    }
  },

  async exportCSV() {
    try {
      const { data } = await Collection.getAll(1, 9999, {});
      const rows = [['Card #', 'Player', 'Team', 'Specialty', 'Year', 'Brand', 'Set', 'Series', 'Quantity', 'Condition', 'Purchase Price', 'Purchase Date', 'Parallels', 'Notes']];
      data.forEach(e => {
        const c = e.cards; const s = c.sets;
        const pars = (e.parallels||[]).map(p => `${p.parallel_name} x${p.quantity}${p.serial_number?' ('+p.serial_number+')':''}`).join('; ');
        rows.push([c.card_number, c.player, c.team, c.specialty, s.year, s.brand, s.set_name, s.series||'', e.quantity, e.condition||'', e.purchase_price||'', e.purchase_date||'', pars, e.notes||'']);
      });
      const csv = rows.map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); a.download = 'cardvault-collection.csv'; a.click();
    } catch(err) { showToast('Export error: ' + err.message, 'error'); }
  }
};
