// ── Checklist Bulk Entry Page ──
const ChecklistPage = {
  sets: [],
  activeSetId: null,
  cards: [],
  activeSectionName: 'Base',
  sections: [],
  colMap: {},
  changes: {},

  async render() {
    const el = document.getElementById('page-checklist');
    el.innerHTML = `<div class="loading"><div class="spinner"></div> Loading sets...</div>`;
    try {
      this.sets = await Sets.getAll();
      if (!this.sets.length) {
        el.innerHTML = `
          <div class="page-header"><div class="page-title">Checklist Entry</div></div>
          <div style="text-align:center;padding:3rem;color:var(--text3)">
            <div style="font-size:48px;margin-bottom:1rem">📋</div>
            <div style="font-size:15px">No sets loaded yet</div>
            <div style="margin-top:1rem"><button class="btn btn-primary" onclick="navigate('upload')">Upload a Checklist</button></div>
          </div>`;
        return;
      }
      el.innerHTML = `
        <div class="page-header flex-between">
          <div>
            <div class="page-title">Checklist Entry</div>
            <div class="page-subtitle">Bulk add cards section by section</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <select id="cl-set-picker" style="height:36px;border:1px solid var(--border2);border-radius:var(--radius-sm);padding:0 10px;font-size:14px;min-width:300px">
              <option value="">Select a set to begin...</option>
              ${this.sets.map(s => '<option value="' + s.id + '">' + s.year + ' ' + s.brand + ' ' + s.set_name + (s.series ? ' - ' + s.series : '') + '</option>').join('')}
            </select>
            <button class="btn btn-primary" onclick="ChecklistPage.loadSet()">Load</button>
          </div>
        </div>
        <div id="cl-main"></div>`;
    } catch(err) {
      el.innerHTML = `<div class="loading" style="color:var(--danger)">Error: ${err.message}</div>`;
    }
  },

  async loadSet() {
    const setId = document.getElementById('cl-set-picker').value;
    if (!setId) { showToast('Please select a set', 'error'); return; }
    this.activeSetId = setId;
    this.changes = {};
    document.getElementById('cl-main').innerHTML = `<div class="loading"><div class="spinner"></div> Loading cards...</div>`;

    try {
      // Fetch ALL cards using pagination (Supabase max 1000 per request)
      var allCards = [];
      var fetchFrom = 0;
      var fetchSize = 1000;
      var fetchDone = false;
      while (!fetchDone) {
        var fetchRes = await db
          .from('cards')
          .select('id, card_number, player, team, specialty, section')
          .eq('set_id', setId)
          .order('id', { ascending: true })
          .range(fetchFrom, fetchFrom + fetchSize - 1);
        if (fetchRes.error) throw fetchRes.error;
        if (!fetchRes.data || fetchRes.data.length === 0) break;
        allCards = allCards.concat(fetchRes.data);
        if (fetchRes.data.length < fetchSize) fetchDone = true;
        fetchFrom += fetchSize;
      }
      var error = null;

      // Sort cards: first by section order of appearance, then numerically within section
      // We need to preserve the original section order from the checklist
      // Group by section preserving insertion order
      const sectionOrder = [];
      const sectionMap = {};
      allCards.forEach(card => {
        const sec = card.section || 'Base';
        if (!sectionMap[sec]) {
          sectionMap[sec] = [];
          sectionOrder.push(sec);
        }
        sectionMap[sec].push(card);
      });

      // Sort cards within each section numerically where possible
      sectionOrder.forEach(sec => {
        sectionMap[sec].sort((a, b) => {
          const aNum = parseInt(a.card_number);
          const bNum = parseInt(b.card_number);
          if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
          return String(a.card_number).localeCompare(String(b.card_number));
        });
      });

      this.cards = allCards;
      this.sections = sectionOrder.map(name => ({ name, cards: sectionMap[name] }));
      this.activeSectionName = this.sections[0].name;

      // Load existing collection entries in chunks (avoid URL length limit with large IN clauses)
      const cardIds = allCards.map(c => c.id);
      const colChunkSize = 200;
      let colData = [];
      for (let ci = 0; ci < cardIds.length; ci += colChunkSize) {
        const chunk = cardIds.slice(ci, ci + colChunkSize);
        const res = await db
          .from('collection')
          .select('id, card_id, quantity, parallels(*)')
          .in('card_id', chunk);
        if (res.data) colData = colData.concat(res.data);
      }

      this.colMap = {};
      colData.forEach(c => { this.colMap[c.card_id] = c; });

      this.renderMain();
    } catch(err) {
      document.getElementById('cl-main').innerHTML = `<div class="loading" style="color:var(--danger)">Error: ${err.message}</div>`;
    }
  },

  renderMain() {
    const setInfo = this.sets.find(s => s.id == this.activeSetId);
    const totalOwned = this.countTotalOwned();
    const pct = this.cards.length ? Math.round(totalOwned / this.cards.length * 100) : 0;

    let html = '';

    // Top bar
    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">';
    html += '<div>';
    html += '<div style="font-weight:600;font-size:15px">' + setInfo.year + ' ' + setInfo.brand + ' ' + setInfo.set_name + (setInfo.series ? ' - ' + setInfo.series : '') + '</div>';
    html += '<div style="font-size:12px;color:var(--text3);margin-top:2px" id="cl-progress-text">' + totalOwned + ' of ' + this.cards.length + ' cards owned (' + pct + '%)</div>';
    html += '</div>';
    html += '<div style="display:flex;gap:8px">';
    html += '<button class="btn" onclick="ChecklistPage.render()">Change Set</button>';
    html += '<button class="btn btn-primary" id="cl-save-btn" onclick="ChecklistPage.saveAll()">Save All Changes</button>';
    html += '</div>';
    html += '</div>';

    // Progress bar
    html += '<div class="progress-bar" style="margin-bottom:12px"><div class="progress-fill" id="cl-prog-fill" style="width:' + pct + '%"></div></div>';

    // Section dropdown
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">';
    html += '<label style="font-size:12px;font-weight:600;color:var(--text2);white-space:nowrap">Section:</label>';
    html += '<select id="cl-section-select" onchange="ChecklistPage.switchSection(this.value)" style="flex:1;height:36px;border:1px solid var(--border2);border-radius:var(--radius-sm);padding:0 10px;font-size:13px;background:var(--surface);color:var(--text)">';
    this.sections.forEach(sec => {
      const secOwned = this.countSectionOwned(sec);
      const isActive = sec.name === this.activeSectionName;
      html += '<option value="' + sec.name.replace(/"/g, '&quot;') + '"' + (isActive ? ' selected' : '') + '>';
      html += sec.name + ' (' + secOwned + '/' + sec.cards.length + ')';
      html += '</option>';
    });
    html += '</select>';
    html += '</div>';

    // Active section
    const activeSection = this.sections.find(s => s.name === this.activeSectionName);
    if (activeSection) {
      const secOwned = this.countSectionOwned(activeSection);
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
      html += '<div style="font-size:13px;font-weight:600;color:var(--text2)" id="cl-sec-hdr">' + activeSection.name + ' &mdash; ' + secOwned + ' of ' + activeSection.cards.length + ' owned</div>';
      html += '<div style="display:flex;gap:6px">';
      html += '<button class="btn btn-sm" onclick="ChecklistPage.markAllOwned()">Mark All Owned</button>';
      html += '<button class="btn btn-sm" onclick="ChecklistPage.clearAll()">Clear All</button>';
      html += '</div>';
      html += '</div>';

      html += '<div class="table-wrap"><table>';
      html += '<thead><tr>';
      html += '<th style="width:70px">#</th>';
      html += '<th>Player</th>';
      html += '<th style="width:170px">Team</th>';
      html += '<th style="width:120px">Section / Type</th>';
      html += '<th style="width:80px;text-align:center">Owned</th>';
      html += '<th style="width:100px;text-align:center">Qty</th>';
      html += '<th style="width:70px;text-align:center">Parallels</th>';
      html += '</tr></thead>';
      html += '<tbody id="cl-tbody">';

      activeSection.cards.forEach(card => {
        html += this.buildCardRow(card);
      });

      html += '</tbody></table></div>';
    }

    // Bottom save
    html += '<div style="margin-top:1rem;display:flex;justify-content:flex-end">';
    html += '<button class="btn btn-primary" onclick="ChecklistPage.saveAll()">Save All Changes</button>';
    html += '</div>';

    document.getElementById('cl-main').innerHTML = html;
  },

  tabId(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
  },

  buildCardRow(card) {
    const change = this.changes[card.id];
    const existing = this.colMap[card.id];
    const isOwned = change !== undefined ? change.owned : !!existing;
    const qty = change !== undefined ? change.qty : (existing ? existing.quantity : 1);
    const parallels = change !== undefined ? change.parallels : (existing ? existing.parallels || [] : []);

    let html = '<tr id="row-' + card.id + '" style="background:' + (isOwned ? 'var(--accent-bg)' : 'transparent') + '">';

    // Card number
    html += '<td style="color:var(--text3);font-size:12px;font-weight:500">' + card.card_number + '</td>';

    // Player + specialty
    html += '<td><span style="font-weight:500">' + card.player + '</span>';
    if (card.specialty) {
      const specMap = { RC: 'badge-rc', 'Future Stars': 'badge-fs', 'Team Card': 'badge-tc', 'Combo Card': 'badge-cc' };
      const lblMap = { RC: 'RC', 'Future Stars': 'FS', 'Team Card': 'TC', 'Combo Card': 'CC' };
      html += '<span class="badge ' + (specMap[card.specialty] || 'badge-tc') + '" style="margin-left:5px">' + (lblMap[card.specialty] || card.specialty) + '</span>';
    }
    html += '</td>';

    // Team
    html += '<td style="font-size:12px;color:var(--text3)">' + (card.team || '') + '</td>';

    // Section
    html += '<td style="font-size:11px;color:var(--text3)">' + (card.section || 'Base') + '</td>';

    // Owned toggle
    html += '<td style="text-align:center"><button onclick="ChecklistPage.toggleOwned(' + card.id + ')" style="width:32px;height:32px;border-radius:50%;border:1.5px solid ' + (isOwned ? 'var(--accent)' : 'var(--border2)') + ';background:' + (isOwned ? 'var(--accent)' : 'var(--surface)') + ';color:' + (isOwned ? '#fff' : 'var(--text3)') + ';cursor:pointer;font-size:15px;font-weight:600">' + (isOwned ? '✓' : '+') + '</button></td>';

    // Qty
    html += '<td style="text-align:center">';
    if (isOwned) {
      html += '<input type="number" min="1" value="' + qty + '" onchange="ChecklistPage.setQty(' + card.id + ',this.value)" style="width:54px;height:28px;text-align:center;border:1px solid var(--border2);border-radius:var(--radius-sm);font-size:13px">';
    } else {
      html += '<span style="color:var(--text3)">—</span>';
    }
    html += '</td>';

    // Parallels button
    const hasPars = parallels.length > 0;
    html += '<td style="text-align:center"><button onclick="ChecklistPage.toggleParPanel(' + card.id + ')" style="width:30px;height:28px;border-radius:6px;border:1px solid ' + (hasPars ? 'var(--purple)' : 'var(--border2)') + ';background:' + (hasPars ? 'var(--purple-bg)' : 'var(--surface)') + ';color:' + (hasPars ? 'var(--purple)' : 'var(--text3)') + ';cursor:pointer;font-size:12px;font-weight:600">' + (hasPars ? parallels.length : '+') + '</button></td>';

    html += '</tr>';

    // Parallel panel
    html += '<tr id="parpanel-' + card.id + '" style="display:none;background:#f8f6ff"><td colspan="7" style="padding:10px 16px">';
    html += '<div style="font-size:11px;font-weight:600;color:var(--purple);margin-bottom:8px">PARALLELS FOR #' + card.card_number + ' ' + card.player + '</div>';
    html += '<div id="parlist-' + card.id + '" style="display:flex;flex-wrap:wrap;gap:6px">';
    parallels.forEach((p, idx) => { html += this.buildParItem(card.id, idx, p); });
    html += '</div>';
    html += '<button onclick="ChecklistPage.addParallel(' + card.id + ')" style="margin-top:8px;font-size:11px;color:var(--purple);background:none;border:1px dashed var(--purple);border-radius:6px;padding:3px 10px;cursor:pointer">+ Add Parallel</button>';
    html += '</td></tr>';

    return html;
  },

  buildParItem(cardId, idx, p) {
    const opts = PARALLEL_OPTIONS.map(o => '<option' + (o === p.parallel_name ? ' selected' : '') + '>' + o + '</option>').join('');
    return '<div id="pi-' + cardId + '-' + idx + '" style="display:flex;align-items:center;gap:4px;background:#fff;border:1px solid var(--border);border-radius:8px;padding:4px 8px">' +
      '<select onchange="ChecklistPage.updatePar(' + cardId + ',' + idx + ',\'parallel_name\',this.value)" style="height:24px;font-size:11px;border:1px solid var(--border2);border-radius:4px;max-width:170px">' + opts + '</select>' +
      '<input type="number" min="1" value="' + (p.quantity || 1) + '" onchange="ChecklistPage.updatePar(' + cardId + ',' + idx + ',\'quantity\',this.value)" style="width:42px;height:24px;font-size:11px;text-align:center;border:1px solid var(--border2);border-radius:4px">' +
      '<input type="text" placeholder="e.g. 31/99" value="' + (p.serial_number || '') + '" onchange="ChecklistPage.updatePar(' + cardId + ',' + idx + ',\'serial_number\',this.value)" style="width:85px;height:24px;font-size:11px;border:1px solid var(--border2);border-radius:4px;padding:0 4px">' +
      '<button onclick="ChecklistPage.removePar(' + cardId + ',' + idx + ')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px;padding:0 2px">×</button>' +
      '</div>';
  },

  getOrInitChange(cardId) {
    if (this.changes[cardId] === undefined) {
      const existing = this.colMap[cardId];
      this.changes[cardId] = {
        owned: !!existing,
        qty: existing ? existing.quantity : 1,
        parallels: existing ? JSON.parse(JSON.stringify(existing.parallels || [])) : []
      };
    }
    return this.changes[cardId];
  },

  toggleOwned(cardId) {
    const c = this.getOrInitChange(cardId);
    c.owned = !c.owned;
    if (c.owned && c.qty < 1) c.qty = 1;
    this.refreshRow(cardId);
    this.refreshCounters();
  },

  setQty(cardId, val) {
    const c = this.getOrInitChange(cardId);
    c.qty = Math.max(1, parseInt(val) || 1);
    c.owned = true;
  },

  toggleParPanel(cardId) {
    const p = document.getElementById('parpanel-' + cardId);
    if (p) p.style.display = p.style.display === 'none' ? '' : 'none';
  },

  addParallel(cardId) {
    const c = this.getOrInitChange(cardId);
    c.owned = true;
    const idx = c.parallels.length;
    c.parallels.push({ parallel_name: 'Gold Mirror', quantity: 1, serial_number: '' });
    const list = document.getElementById('parlist-' + cardId);
    if (list) {
      const tmp = document.createElement('div');
      tmp.innerHTML = this.buildParItem(cardId, idx, c.parallels[idx]);
      list.appendChild(tmp.firstChild);
    }
    this.refreshRow(cardId);
    this.refreshCounters();
  },

  updatePar(cardId, idx, field, val) {
    const c = this.getOrInitChange(cardId);
    if (c.parallels[idx]) {
      c.parallels[idx][field] = field === 'quantity' ? (parseInt(val) || 1) : val;
    }
  },

  removePar(cardId, idx) {
    const c = this.getOrInitChange(cardId);
    c.parallels.splice(idx, 1);
    const item = document.getElementById('pi-' + cardId + '-' + idx);
    if (item) item.remove();
    this.refreshRow(cardId);
  },

  refreshRow(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (!card) return;
    const oldRow = document.getElementById('row-' + cardId);
    const oldPanel = document.getElementById('parpanel-' + cardId);
    if (!oldRow) return;
    const panelOpen = oldPanel && oldPanel.style.display !== 'none';
    const tmp = document.createElement('tbody');
    tmp.innerHTML = this.buildCardRow(card);
    const newRow = tmp.querySelector('#row-' + cardId);
    const newPanel = tmp.querySelector('#parpanel-' + cardId);
    if (newRow) oldRow.replaceWith(newRow);
    if (oldPanel && newPanel) {
      if (panelOpen) newPanel.style.display = '';
      oldPanel.replaceWith(newPanel);
    }
  },

  countTotalOwned() {
    return this.cards.filter(c => {
      const ch = this.changes[c.id];
      return ch !== undefined ? ch.owned : !!this.colMap[c.id];
    }).length;
  },

  countSectionOwned(sec) {
    return sec.cards.filter(c => {
      const ch = this.changes[c.id];
      return ch !== undefined ? ch.owned : !!this.colMap[c.id];
    }).length;
  },

  refreshCounters() {
    const totalOwned = this.countTotalOwned();
    const pct = this.cards.length ? Math.round(totalOwned / this.cards.length * 100) : 0;
    const txt = document.getElementById('cl-progress-text');
    if (txt) txt.textContent = totalOwned + ' of ' + this.cards.length + ' cards owned (' + pct + '%)';
    const fill = document.getElementById('cl-prog-fill');
    if (fill) fill.style.width = pct + '%';

    // Update active section header and dropdown
    const activeSection = this.sections.find(s => s.name === this.activeSectionName);
    if (activeSection) {
      const secOwned = this.countSectionOwned(activeSection);
      const hdr = document.getElementById('cl-sec-hdr');
      if (hdr) hdr.textContent = activeSection.name + ' — ' + secOwned + ' of ' + activeSection.cards.length + ' owned';
      // Update dropdown option text for active section
      const sel = document.getElementById('cl-section-select');
      if (sel) {
        Array.from(sel.options).forEach(opt => {
          const sec = this.sections.find(s => s.name === opt.value);
          if (sec) {
            const owned = this.countSectionOwned(sec);
            opt.text = sec.name + ' (' + owned + '/' + sec.cards.length + ')';
          }
        });
      }
    }
  },

  switchSection(name) {
    this.activeSectionName = name;
    this.renderMain();
  },

  markAllOwned() {
    const sec = this.sections.find(s => s.name === this.activeSectionName);
    if (!sec) return;
    sec.cards.forEach(card => {
      const c = this.getOrInitChange(card.id);
      c.owned = true;
      if (c.qty < 1) c.qty = 1;
    });
    this.renderMain();
  },

  clearAll() {
    const sec = this.sections.find(s => s.name === this.activeSectionName);
    if (!sec) return;
    sec.cards.forEach(card => {
      const c = this.getOrInitChange(card.id);
      c.owned = false;
    });
    this.renderMain();
  },

  async saveAll() {
    const btn = document.getElementById('cl-save-btn');
    if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

    const cardIds = Object.keys(this.changes);
    if (!cardIds.length) {
      showToast('No changes to save', '');
      if (btn) { btn.textContent = 'Save All Changes'; btn.disabled = false; }
      return;
    }

    let saved = 0, errors = 0;

    for (const cardId of cardIds) {
      const change = this.changes[cardId];
      try {
        if (change.owned) {
          const existing = this.colMap[cardId];
          let colId;
          if (existing) {
            await db.from('collection').update({ quantity: change.qty }).eq('id', existing.id);
            colId = existing.id;
          } else {
            const { data, error } = await db.from('collection')
              .insert({ card_id: parseInt(cardId), quantity: change.qty })
              .select().single();
            if (error) throw error;
            colId = data.id;
          }
          await db.from('parallels').delete().eq('collection_id', colId);
          if (change.parallels && change.parallels.length > 0) {
            const parRows = change.parallels.map(p => ({
              collection_id: colId,
              parallel_name: p.parallel_name,
              quantity: p.quantity || 1,
              serial_number: p.serial_number || null
            }));
            await db.from('parallels').insert(parRows);
          }
          this.colMap[cardId] = { id: colId, card_id: parseInt(cardId), quantity: change.qty, parallels: change.parallels || [] };
        } else if (this.colMap[cardId]) {
          await db.from('collection').delete().eq('id', this.colMap[cardId].id);
          delete this.colMap[cardId];
        }
        saved++;
      } catch(err) {
        console.error('Error saving card ' + cardId, err);
        errors++;
      }
    }

    this.changes = {};
    if (errors > 0) {
      showToast(saved + ' saved, ' + errors + ' errors', 'error');
    } else {
      showToast(saved + ' cards saved!', 'success');
    }
    if (btn) { btn.textContent = 'Save All Changes'; btn.disabled = false; }
    updateSidebarStats();
    this.renderMain();
  }
};

