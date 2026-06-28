// ── Database Layer ──
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Sets ──
const Sets = {
  async getAll() {
    const { data, error } = await db.from('sets').select('*').order('year', { ascending: false }).order('brand').order('set_name');
    if (error) throw error;
    return data;
  },
  async create(set) {
    const { data, error } = await db.from('sets').insert(set).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id) {
    const { error } = await db.from('sets').delete().eq('id', id);
    if (error) throw error;
  }
};

// ── Cards ──
const Cards = {
  async getBySet(setId) {
    const { data, error } = await db.from('cards').select('*').eq('set_id', setId).order('card_number');
    if (error) throw error;
    return data;
  },
  async search(query) {
    const { data, error } = await db
      .from('cards')
      .select(`*, sets(year, brand, set_name, series)`)
      .ilike('player', `%${query}%`)
      .order('player')
      .limit(200);
    if (error) throw error;
    return data;
  },
  async bulkInsert(cards) {
    const chunkSize = 500;
    for (let i = 0; i < cards.length; i += chunkSize) {
      const chunk = cards.slice(i, i + chunkSize);
      const { error } = await db.from('cards').insert(chunk);
      if (error) throw error;
    }
  }
};

// ── Collection ──
const Collection = {
  async getAll(page = 1, pageSize = 50, filters = {}) {
    // Step 1 — if filtering by player or set, get matching card IDs first
    let cardIds = null;
    if (filters.player || filters.setId) {
      let cardQuery = db.from('cards').select('id');
      if (filters.player) cardQuery = cardQuery.ilike('player', `%${filters.player}%`);
      if (filters.setId) cardQuery = cardQuery.eq('set_id', filters.setId);
      const { data: matchingCards, error: cardError } = await cardQuery;
      if (cardError) throw cardError;
      cardIds = (matchingCards || []).map(c => c.id);
      if (!cardIds.length) return { data: [], count: 0 };
    }

    // Step 2 — fetch collection rows, filtered by card IDs if needed
    let query = db
      .from('collection')
      .select(`*, cards(id, card_number, player, team, specialty, set_id, sets(year, brand, set_name, series)), parallels(*)`, { count: 'exact' });

    if (cardIds !== null) query = query.in('card_id', cardIds);

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: (data || []).filter(r => r.cards), count };
  },

  async getByCard(cardId) {
    const { data, error } = await db
      .from('collection')
      .select(`*, parallels(*)`)
      .eq('card_id', cardId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsert(cardId, entry) {
    const existing = await this.getByCard(cardId);
    if (existing) {
      const { error } = await db.from('collection').update(entry).eq('id', existing.id);
      if (error) throw error;
      return existing.id;
    } else {
      const { data, error } = await db.from('collection').insert({ ...entry, card_id: cardId }).select().single();
      if (error) throw error;
      return data.id;
    }
  },

  async delete(id) {
    const { error } = await db.from('collection').delete().eq('id', id);
    if (error) throw error;
  },

  async getStats() {
    const { count: totalOwned } = await db.from('collection').select('*', { count: 'exact', head: true });
    const { count: totalSets } = await db.from('sets').select('*', { count: 'exact', head: true });
    const { count: totalGraded } = await db.from('graded_cards').select('*', { count: 'exact', head: true });
    const { count: totalWant } = await db.from('want_list').select('*', { count: 'exact', head: true });
    const { count: totalMisc } = await db.from('misc_cards').select('*', { count: 'exact', head: true });
    const { data: copySum } = await db.from('collection').select('quantity');
    const totalCopies = (copySum || []).reduce((a, b) => a + (b.quantity || 0), 0);
    return { totalOwned, totalSets, totalGraded, totalWant, totalMisc, totalCopies };
  }
};

// ── Parallels ──
const Parallels = {
  async upsertAll(collectionId, parallels) {
    await db.from('parallels').delete().eq('collection_id', collectionId);
    if (!parallels.length) return;
    const rows = parallels.map(p => ({ ...p, collection_id: collectionId }));
    const { error } = await db.from('parallels').insert(rows);
    if (error) throw error;
  }
};

// ── Graded Cards ──
const Graded = {
  async getAll(page = 1, pageSize = 50, search = '') {
    let query = db
      .from('graded_cards')
      .select(`*, cards(id, card_number, player, team, specialty, sets(year, brand, set_name))`, { count: 'exact' });
    if (search) query = query.ilike('cards.player', `%${search}%`);
    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1).order('created_at', { ascending: false });
    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data.filter(r => r.cards), count };
  },

  async getByCard(cardId) {
    const { data, error } = await db.from('graded_cards').select('*').eq('card_id', cardId);
    if (error) throw error;
    return data;
  },

  async create(entry) {
    const { data, error } = await db.from('graded_cards').insert(entry).select().single();
    if (error) throw error;
    return data;
  },

  async update(id, entry) {
    const { error } = await db.from('graded_cards').update(entry).eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await db.from('graded_cards').delete().eq('id', id);
    if (error) throw error;
  }
};

// ── Want List ──
const WantList = {
  async getAll(search = '') {
    let query = db
      .from('want_list')
      .select(`*, cards(id, card_number, player, team, specialty, sets(year, brand, set_name))`)
      .order('priority').order('added_date', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    let results = data.filter(r => r.cards);
    if (search) results = results.filter(r => r.cards.player.toLowerCase().includes(search.toLowerCase()));
    return results;
  },

  async create(entry) {
    const { data, error } = await db.from('want_list').insert(entry).select().single();
    if (error) throw error;
    return data;
  },

  async update(id, entry) {
    const { error } = await db.from('want_list').update(entry).eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await db.from('want_list').delete().eq('id', id);
    if (error) throw error;
  }
};

// ── Misc Cards ──
const Misc = {
  async getAll(search = '') {
    let query = db.from('misc_cards').select('*').order('created_at', { ascending: false });
    if (search) query = query.ilike('player', `%${search}%`);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async create(entry) {
    const { data, error } = await db.from('misc_cards').insert(entry).select().single();
    if (error) throw error;
    return data;
  },

  async update(id, entry) {
    const { error } = await db.from('misc_cards').update(entry).eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await db.from('misc_cards').delete().eq('id', id);
    if (error) throw error;
  }
};

// ── Search (master cross-set) ──
const Search = {
  async player(query) {
    if (!query || query.length < 2) return { cards: [], misc: [] };

    const { data: cardMatches, error } = await db
      .from('cards')
      .select('id, card_number, player, team, specialty, set_id, sets(year, brand, set_name, series)')
      .ilike('player', '%' + query + '%')
      .order('player');

    if (error) throw error;
    if (!cardMatches || !cardMatches.length) return { cards: [], misc: [] };

    const cardIds = cardMatches.map(c => c.id);

    const colRes = await db
      .from('collection')
      .select('id, quantity, card_id, parallels(*)')
      .in('card_id', cardIds);

    const gradedRes = await db
      .from('graded_cards')
      .select('id, card_id, grader, grade, cert_number')
      .in('card_id', cardIds);

    const wantRes = await db
      .from('want_list')
      .select('id, card_id, parallel_name, priority')
      .in('card_id', cardIds);

    const miscRes = await db
      .from('misc_cards')
      .select('*')
      .ilike('player', '%' + query + '%');

    const colMap = {};
    (colRes.data || []).forEach(c => { colMap[c.card_id] = c; });

    const gradedMap = {};
    (gradedRes.data || []).forEach(g => {
      if (!gradedMap[g.card_id]) gradedMap[g.card_id] = [];
      gradedMap[g.card_id].push(g);
    });

    const wantMap = {};
    (wantRes.data || []).forEach(w => {
      if (!wantMap[w.card_id]) wantMap[w.card_id] = [];
      wantMap[w.card_id].push(w);
    });

    const enriched = cardMatches.map(card => ({
      id: card.id,
      card_number: card.card_number,
      player: card.player,
      team: card.team,
      specialty: card.specialty,
      sets: card.sets,
      collection: colMap[card.id] || null,
      graded: gradedMap[card.id] || [],
      wanted: wantMap[card.id] || []
    }));

    return {
      cards: enriched,
      misc: miscRes.data || []
    };
  }
};
