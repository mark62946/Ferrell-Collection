// ── Sets Page ──
const SetsPage = {
  async render() {
    const el = document.getElementById('page-sets');
    el.innerHTML = `<div class="loading"><div class="spinner"></div> Loading…</div>`;
    try {
      const sets = await Sets.getAll();
      el.innerHTML = `
        <div class="page-header flex-between">
          <div><div class="page-title">Sets & Checklists</div><div class="page-subtitle">${sets.length} sets loaded</div></div>
          <button class="btn btn-primary" onclick="navigate('upload')">⬆ Upload Checklist</button>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Year</th><th>Brand</th><th>Set Name</th><th>Series</th><th>Cards</th><th>Actions</th></tr></thead>
          <tbody>${sets.length ? sets.map(s => `<tr>
            <td style="font-weight:500">${s.year}</td>
            <td>${escH(s.brand)}</td>
            <td>${escH(s.set_name)}</td>
            <td style="color:var(--text3)">${escH(s.series||'—')}</td>
            <td>${s.total_cards||'—'}</td>
            <td><button class="btn btn-sm btn-danger" onclick="SetsPage.deleteSet(${s.id},'${escH(s.set_name)}')">Delete</button></td>
          </tr>`).join('') : '<tr class="empty-row"><td colspan="6">No sets yet — upload a checklist to get started!</td></tr>'}</tbody>
        </table></div>`;
    } catch(err) {
      el.innerHTML = `<div class="loading" style="color:var(--danger)">Error: ${err.message}</div>`;
    }
  },

  async deleteSet(id, name) {
    if (!confirm(`Delete "${name}" and ALL its cards? This cannot be undone.`)) return;
    try {
      await Sets.delete(id);
      showToast('Set deleted', 'success');
      this.render();
      updateSidebarStats();
    } catch(err) { showToast('Error: ' + err.message, 'error'); }
  }
};

// ── Graded Cards Page ──
const GradedPage = {
  page: 1, pageSize: 50, search: '', searchTimer: null,

  async render() {
    const el = document.getElementById('page-graded');
    el.innerHTML = `
      <div class="page-header flex-between">
        <div><div class="page-title">Graded Cards</div><div class="page-subtitle">PSA, BGS, SGC, CGC slabs</div></div>
        <button class="btn btn-primary" onclick="GradedPage.openAddModal()">+ Add Graded Card</button>
      </div>
      <div class="toolbar">
        <input type="text" id="graded-search" placeholder="Search player…">
      </div>
      <div id="graded-table"></div>
      <div id="graded-pagination" class="pagination"></div>`;
    document.getElementById('graded-search').addEventListener('input', e => {
      clearTimeout(this.searchTimer);
      this.search = e.target.value;
      this.page = 1;
      this.searchTimer = setTimeout(() => this.loadTable(), 300);
    });
    await this.loadTable();
  },

  async loadTable() {
    document.getElementById('graded-table').innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
    try {
      const { data, count } = await Graded.getAll(this.page, this.pageSize, this.search);
      if (!data.length) {
        document.getElementById('graded-table').innerHTML = `<div class="table-wrap"><table><tr class="empty-row"><td colspan="8">No graded cards yet.</td></tr></table></div>`;
        document.getElementById('graded-pagination').innerHTML = '';
        return;
      }
      let html = `<div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Player</th><th>Set</th><th>Grader</th><th>Grade</th><th>Cert #</th><th>Price Paid</th><th>Actions</th></tr></thead><tbody>`;
      data.forEach(g => {
        const c = g.cards; const s = c.sets;
        html += `<tr>
          <td style="color:var(--text3)">${escH(c.card_number)}</td>
          <td><span style="font-weight:500">${escH(c.player)}</span>${specBadge(c.specialty)}</td>
          <td style="font-size:12px">${escH(s.year)} ${escH(s.brand)}<br><span style="color:var(--text3)">${escH(s.set_name)}</span></td>
          <td><span class="badge badge-${g.grader.toLowerCase()}">${escH(g.grader)}</span></td>
          <td><span class="badge badge-grade">${escH(g.grade)}</span></td>
          <td style="font-size:12px;color:var(--text3)">${g.cert_number ? escH(g.cert_number) : '—'}</td>
          <td>${g.purchase_price ? '$'+Number(g.purchase_price).toFixed(2) : '—'}</td>
          <td><div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-danger" onclick="GradedPage.deleteGraded(${g.id})">Del</button>
          </div></td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
      document.getElementById('graded-table').innerHTML = html;

      const pages = Math.ceil(count / this.pageSize);
      let pag = '';
      if (this.page > 1) pag += `<button class="btn btn-sm" onclick="GradedPage.goPage(${this.page-1})">‹ Prev</button>`;
      if (pages > 1) pag += `<span class="page-info">Page ${this.page} of ${pages}</span>`;
      if (this.page < pages) pag += `<button class="btn btn-sm" onclick="GradedPage.goPage(${this.page+1})">Next ›</button>`;
      document.getElementById('graded-pagination').innerHTML = pag;
    } catch(err) {
      document.getElementById('graded-table').innerHTML = `<div class="loading" style="color:var(--danger)">Error: ${err.message}</div>`;
    }
  },

  goPage(p) { this.page = p; this.loadTable(); },

  async openAddModal() {
    const sets = await Sets.getAll();
    const setOptions = sets.map(s => `<option value="${s.id}">${s.year} ${s.brand} ${s.set_name}${s.series?' — '+s.series:''}</option>`).join('');
    openModal('Add Graded Card', `
      <div class="form-section-title">Find Card</div>
      <div class="form-grid">
        <div class="form-group"><label>Set</label>
          <select id="g-set-id" onchange="GradedPage.loadCards(this.value)">
            <option value="">Select set…</option>${setOptions}
          </select>
        </div>
        <div class="form-group"><label>Card</label>
          <select id="g-card-id"><option value="">Select set first…</option></select>
        </div>
      </div>
      <div class="form-section-title">Grading Details</div>
      <div class="form-grid">
        <div class="form-group"><label>Grader</label>
          <select id="g-grader"><option>PSA</option><option>BGS</option><option>SGC</option><option>CGC</option><option>Other</option></select>
        </div>
        <div class="form-group"><label>Grade</label>
          <select id="g-grade">
            <option>10</option><option>9.5</option><option>9</option><option>8.5</option><option>8</option><option>7.5</option><option>7</option><option>6</option><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option>
            <option>Authentic</option>
          </select>
        </div>
        <div class="form-group"><label>Cert Number</label><input type="text" id="g-cert" placeholder="e.g. 12345678"></div>
        <div class="form-group"><label>Pop Higher (optional)</label><input type="number" id="g-pop" min="0"></div>
        <div class="form-group"><label>Purchase Price ($)</label><input type="number" id="g-price" step="0.01" placeholder="0.00"></div>
        <div class="form-group"><label>Purchase Date</label><input type="date" id="g-date"></div>
      </div>
      <div class="form-group mt-1"><label>Notes</label><textarea id="g-notes" placeholder="Any notes…"></textarea></div>
      <div class="form-actions">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="GradedPage.saveAdd()">Save Graded Card</button>
      </div>`);
  },

  async loadCards(setId) {
    const sel = document.getElementById('g-card-id');
    if (!setId) { sel.innerHTML = '<option>Select set first…</option>'; return; }
    sel.innerHTML = '<option>Loading…</option>';
    const cards = await Cards.getBySet(setId);
    sel.innerHTML = cards.map(c => `<option value="${c.id}">#${c.card_number} — ${c.player}${c.specialty?' ('+c.specialty+')':''}</option>`).join('');
  },

  async saveAdd() {
    const cardId = document.getElementById('g-card-id').value;
    if (!cardId || cardId === 'Select set first…') { showToast('Please select a card', 'error'); return; }
    try {
      await Graded.create({
        card_id: cardId,
        grader: document.getElementById('g-grader').value,
        grade: document.getElementById('g-grade').value,
        cert_number: document.getElementById('g-cert').value || null,
        pop_higher: parseInt(document.getElementById('g-pop').value) || null,
        purchase_price: parseFloat(document.getElementById('g-price').value) || null,
        purchase_date: document.getElementById('g-date').value || null,
        notes: document.getElementById('g-notes').value || null
      });
      closeModal(); showToast('Graded card saved!', 'success');
      this.loadTable(); updateSidebarStats();
    } catch(err) { showToast('Error: ' + err.message, 'error'); }
  },

  async deleteGraded(id) {
    if (!confirm('Remove this graded card?')) return;
    try {
      await Graded.delete(id);
      showToast('Deleted', 'success');
      this.loadTable(); updateSidebarStats();
    } catch(err) { showToast('Error: ' + err.message, 'error'); }
  }
};

// ── Want List Page ──
const WantListPage = {
  search: '', searchTimer: null,

  async render() {
    const el = document.getElementById('page-wantlist');
    el.innerHTML = `
      <div class="page-header flex-between">
        <div><div class="page-title">Want List</div><div class="page-subtitle">Cards you're actively hunting</div></div>
        <button class="btn btn-primary" onclick="WantListPage.openAddModal()">+ Add to Want List</button>
      </div>
      <div class="toolbar">
        <input type="text" id="want-search" placeholder="Search player…">
      </div>
      <div id="want-table"></div>`;
    document.getElementById('want-search').addEventListener('input', e => {
      clearTimeout(this.searchTimer);
      this.search = e.target.value;
      this.searchTimer = setTimeout(() => this.loadTable(), 300);
    });
    await this.loadTable();
  },

  async loadTable() {
    document.getElementById('want-table').innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
    try {
      const data = await WantList.getAll(this.search);
      if (!data.length) {
        document.getElementById('want-table').innerHTML = `<div class="table-wrap"><table><tr class="empty-row"><td colspan="7">Your want list is empty.</td></tr></table></div>`;
        return;
      }
      let html = `<div class="table-wrap"><table>
        <thead><tr><th>Priority</th><th>#</th><th>Player</th><th>Set</th><th>Parallel</th><th>Max Price</th><th>Actions</th></tr></thead><tbody>`;
      data.forEach(w => {
        const c = w.cards; const s = c.sets;
        const pLabels = ['','🔴 Must Have','🟠 High','🟡 Medium','🟢 Low','🟣 Someday'];
        html += `<tr>
          <td><span class="badge badge-priority-${w.priority}">${pLabels[w.priority]||w.priority}</span></td>
          <td style="color:var(--text3)">${escH(c.card_number)}</td>
          <td><span style="font-weight:500">${escH(c.player)}</span>${specBadge(c.specialty)}</td>
          <td style="font-size:12px">${escH(s.year)} ${escH(s.brand)}<br><span style="color:var(--text3)">${escH(s.set_name)}</span></td>
          <td>${w.parallel_name ? `<span class="par-tag">${escH(w.parallel_name)}</span>` : '<span class="text-muted">—</span>'}</td>
          <td>${w.max_price ? '$'+Number(w.max_price).toFixed(2) : '—'}</td>
          <td><button class="btn btn-sm btn-danger" onclick="WantListPage.deleteWant(${w.id})">Del</button></td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
      document.getElementById('want-table').innerHTML = html;
    } catch(err) {
      document.getElementById('want-table').innerHTML = `<div class="loading" style="color:var(--danger)">Error: ${err.message}</div>`;
    }
  },

  async openAddModal() {
    const sets = await Sets.getAll();
    const setOptions = sets.map(s => `<option value="${s.id}">${s.year} ${s.brand} ${s.set_name}${s.series?' — '+s.series:''}</option>`).join('');
    openModal('Add to Want List', `
      <div class="form-grid">
        <div class="form-group"><label>Set</label>
          <select id="w-set-id" onchange="WantListPage.loadCards(this.value)">
            <option value="">Select set…</option>${setOptions}
          </select>
        </div>
        <div class="form-group"><label>Card</label>
          <select id="w-card-id"><option value="">Select set first…</option></select>
        </div>
        <div class="form-group"><label>Parallel (optional)</label>
          <select id="w-parallel"><option value="">Any / Base</option>${PARALLEL_OPTIONS.map(o=>`<option>${o}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Priority</label>
          <select id="w-priority">
            <option value="1">🔴 1 — Must Have</option>
            <option value="2">🟠 2 — High</option>
            <option value="3" selected>🟡 3 — Medium</option>
            <option value="4">🟢 4 — Low</option>
            <option value="5">🟣 5 — Someday</option>
          </select>
        </div>
        <div class="form-group"><label>Max Price ($)</label><input type="number" id="w-price" step="0.01" placeholder="0.00"></div>
      </div>
      <div class="form-group mt-1"><label>Notes</label><textarea id="w-notes" placeholder="Notes about this card…"></textarea></div>
      <div class="form-actions">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="WantListPage.saveAdd()">Add to Want List</button>
      </div>`);
  },

  async loadCards(setId) {
    const sel = document.getElementById('w-card-id');
    if (!setId) { sel.innerHTML = '<option>Select set first…</option>'; return; }
    sel.innerHTML = '<option>Loading…</option>';
    const cards = await Cards.getBySet(setId);
    sel.innerHTML = cards.map(c => `<option value="${c.id}">#${c.card_number} — ${c.player}${c.specialty?' ('+c.specialty+')':''}</option>`).join('');
  },

  async saveAdd() {
    const cardId = document.getElementById('w-card-id').value;
    if (!cardId || cardId === 'Select set first…') { showToast('Please select a card', 'error'); return; }
    try {
      await WantList.create({
        card_id: cardId,
        parallel_name: document.getElementById('w-parallel').value || null,
        priority: parseInt(document.getElementById('w-priority').value),
        max_price: parseFloat(document.getElementById('w-price').value) || null,
        notes: document.getElementById('w-notes').value || null
      });
      closeModal(); showToast('Added to want list!', 'success');
      this.loadTable(); updateSidebarStats();
    } catch(err) { showToast('Error: ' + err.message, 'error'); }
  },

  async deleteWant(id) {
    if (!confirm('Remove from want list?')) return;
    try { await WantList.delete(id); showToast('Removed', 'success'); this.loadTable(); updateSidebarStats(); }
    catch(err) { showToast('Error: ' + err.message, 'error'); }
  }
};

// ── Misc Cards Page ──
const MiscPage = {
  search: '', searchTimer: null,

  async render() {
    const el = document.getElementById('page-misc');
    el.innerHTML = `
      <div class="page-header flex-between">
        <div><div class="page-title">Misc Cards</div><div class="page-subtitle">Cards without a checklist — vintage, oddball, show pickups</div></div>
        <button class="btn btn-primary" onclick="MiscPage.openAddModal()">+ Add Misc Card</button>
      </div>
      <div class="toolbar">
        <input type="text" id="misc-search" placeholder="Search player…">
      </div>
      <div id="misc-table"></div>`;
    document.getElementById('misc-search').addEventListener('input', e => {
      clearTimeout(this.searchTimer);
      this.search = e.target.value;
      this.searchTimer = setTimeout(() => this.loadTable(), 300);
    });
    await this.loadTable();
  },

  async loadTable() {
    document.getElementById('misc-table').innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
    try {
      const data = await Misc.getAll(this.search);
      if (!data.length) {
        document.getElementById('misc-table').innerHTML = `<div class="table-wrap"><table><tr class="empty-row"><td colspan="8">No misc cards yet.</td></tr></table></div>`;
        return;
      }
      let html = `<div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Player</th><th>Team</th><th>Year / Set</th><th>Qty</th><th>Graded</th><th>Description</th><th>Actions</th></tr></thead><tbody>`;
      data.forEach(m => {
        html += `<tr>
          <td style="color:var(--text3)">${m.card_number ? escH(m.card_number) : '—'}</td>
          <td style="font-weight:500">${escH(m.player)}</td>
          <td style="font-size:12px;color:var(--text3)">${escH(m.team||'—')}</td>
          <td style="font-size:12px">${[m.year, m.brand, m.set_name].filter(Boolean).join(' ')}</td>
          <td style="font-weight:600;color:var(--accent)">${m.quantity}</td>
          <td>${m.is_graded ? `<span class="badge badge-${(m.grader||'').toLowerCase()}">${escH(m.grader)}</span> <span class="badge badge-grade">${escH(m.grade)}</span>` : '<span class="text-muted">Raw</span>'}</td>
          <td style="font-size:12px;color:var(--text3)">${escH(m.description||'—')}</td>
          <td><button class="btn btn-sm btn-danger" onclick="MiscPage.deleteCard(${m.id})">Del</button></td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
      document.getElementById('misc-table').innerHTML = html;
    } catch(err) {
      document.getElementById('misc-table').innerHTML = `<div class="loading" style="color:var(--danger)">Error: ${err.message}</div>`;
    }
  },

  openAddModal() {
    openModal('Add Misc Card', `
      <div class="form-grid">
        <div class="form-group"><label>Player Name *</label><input type="text" id="m-player" placeholder="e.g. Bo Jackson"></div>
        <div class="form-group"><label>Team</label><input type="text" id="m-team" placeholder="e.g. Kansas City Royals"></div>
        <div class="form-group"><label>Year</label><input type="number" id="m-year" placeholder="e.g. 1987" min="1900" max="2099"></div>
        <div class="form-group"><label>Brand</label><input type="text" id="m-brand" placeholder="e.g. Topps, Donruss"></div>
        <div class="form-group"><label>Set Name</label><input type="text" id="m-set" placeholder="e.g. Traded"></div>
        <div class="form-group"><label>Card Number</label><input type="text" id="m-num" placeholder="e.g. T-32"></div>
        <div class="form-group"><label>Quantity</label><input type="number" id="m-qty" value="1" min="1"></div>
        <div class="form-group"><label>Condition</label>
          <select id="m-condition"><option value="">—</option><option>Mint</option><option>Near Mint</option><option>Excellent</option><option>Very Good</option><option>Good</option><option>Fair</option><option>Poor</option></select>
        </div>
        <div class="form-group"><label>Purchase Price ($)</label><input type="number" id="m-price" step="0.01" placeholder="0.00"></div>
        <div class="form-group"><label>Purchase Date</label><input type="date" id="m-date"></div>
      </div>
      <div class="form-group mt-1">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="m-graded" onchange="document.getElementById('m-grading-fields').classList.toggle('hidden',!this.checked)">
          This card is graded
        </label>
      </div>
      <div id="m-grading-fields" class="hidden">
        <div class="form-grid mt-1">
          <div class="form-group"><label>Grader</label>
            <select id="m-grader"><option>PSA</option><option>BGS</option><option>SGC</option><option>CGC</option><option>Other</option></select>
          </div>
          <div class="form-group"><label>Grade</label>
            <select id="m-grade"><option>10</option><option>9.5</option><option>9</option><option>8.5</option><option>8</option><option>7</option><option>6</option><option>5</option><option>Authentic</option></select>
          </div>
          <div class="form-group"><label>Cert Number</label><input type="text" id="m-cert" placeholder="e.g. 12345678"></div>
        </div>
      </div>
      <div class="form-group mt-1"><label>Description / Notes</label><textarea id="m-desc" placeholder="Any notes about this card…"></textarea></div>
      <div class="form-actions">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="MiscPage.saveAdd()">Save Card</button>
      </div>`);
  },

  async saveAdd() {
    const player = document.getElementById('m-player').value.trim();
    if (!player) { showToast('Player name is required', 'error'); return; }
    const isGraded = document.getElementById('m-graded').checked;
    try {
      await Misc.create({
        player,
        team: document.getElementById('m-team').value || null,
        year: parseInt(document.getElementById('m-year').value) || null,
        brand: document.getElementById('m-brand').value || null,
        set_name: document.getElementById('m-set').value || null,
        card_number: document.getElementById('m-num').value || null,
        quantity: parseInt(document.getElementById('m-qty').value) || 1,
        condition: document.getElementById('m-condition').value || null,
        purchase_price: parseFloat(document.getElementById('m-price').value) || null,
        purchase_date: document.getElementById('m-date').value || null,
        is_graded: isGraded,
        grader: isGraded ? document.getElementById('m-grader').value : null,
        grade: isGraded ? document.getElementById('m-grade').value : null,
        cert_number: isGraded ? document.getElementById('m-cert').value || null : null,
        description: document.getElementById('m-desc').value || null
      });
      closeModal(); showToast('Misc card saved!', 'success');
      this.loadTable(); updateSidebarStats();
    } catch(err) { showToast('Error: ' + err.message, 'error'); }
  },

  async deleteCard(id) {
    if (!confirm('Delete this card?')) return;
    try { await Misc.delete(id); showToast('Deleted', 'success'); this.loadTable(); updateSidebarStats(); }
    catch(err) { showToast('Error: ' + err.message, 'error'); }
  }
};
