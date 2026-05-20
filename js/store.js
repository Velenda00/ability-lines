/* ===== IndexedDB 数据层 v2.1 ===== */
const DB_NAME = 'AbilityLinesDBv2';
const DB_VERSION = 1;
const STORE_NAME = 'dataStore';

// 数据结构（2026-05-08 v2.1 完整版）
//
// nameConfig: { topLevel, capability, project, process,
//               action, problem, learning, review, insight,
//               module1, module2, module3 }
// capabilities: [{ id, name, importance, createdAt, projects: [{
//   id, name, importance, createdAt,
//   process: [{ id, text, importance, todoId, completedAt, relatedEntryIds }],
//   entries: { action:[{id,text,createdAt,importance,relatedTodoId,relatedProcessId,createdFromTodoId,note}],
//              problem:[...], learning:[...], review:[...] },
//   relations: [{ id, fromId, toId, type }]  // type: discover|derive|harvest
// }]}]
// thoughts: [{ id, text, createdAt, tags:[], importance, note,
//              relatedCapId, relatedProjId, relatedEntryType, relatedEntryId, relatedLiberationId }]
// todos: [{ id, text, importance, createdAt, isToday, status, completedAt, note,
//           sourceCapId, sourceProjId, sourceEntryType, sourceEntryId,
//           processCapId, processProjId, processEntryIds }]
// goals: [{ id, name, importance, description, createdAt, status }]
// liberationEntries: [{ id, text, createdAt }]
// diplomacyEntries: [{ id, text, createdAt }]

const Store = {
  db: null,

  getDB() { return this.db; },

  async open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME))
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      };
      req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async get(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async set(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  getDefaultNameConfig() {
    return {
      topLevel: '再塑法典',
      capability: '能力', project: '专项', process: '过程',
      action: '行动', problem: '问题', learning: '学习', review: '总结', insight: '收获',
      module1: '思维枷锁-破', module2: '核心能力-铸', module3: '风采展示-显'
    };
  },

  async init() {
    await this.open();
    const data = await this.get('allData');
    if (!data) {
      const def = {
        nameConfig: this.getDefaultNameConfig(),
        capabilities: [],
        goals: [],
        habits: [],
        thoughts: [],
        todos: [],
        liberationEntries: [],
        diplomacyEntries: []
      };
      await this.set('allData', def);
      return def;
    }
    // 向前兼容
    if (!data.nameConfig) data.nameConfig = this.getDefaultNameConfig();
    if (!data.nameConfig.topLevel) data.nameConfig.topLevel = '再塑法典';
    if (!data.nameConfig.process) data.nameConfig.process = '过程';
    if (!data.nameConfig.insight) data.nameConfig.insight = '收获';
    if (!data.goals) data.goals = [];
    if (!data.habits) data.habits = [];
    if (!data.thoughts) data.thoughts = [];
    if (!data.todos) data.todos = [];
    // 为旧数据补字段
    data.capabilities.forEach(c => { if (c.importance === undefined) c.importance = 0; if (c.status === undefined) c.status = 'active'; });
    data.capabilities.forEach(c => {
      c.projects.forEach(p => {
        if (p.importance === undefined) p.importance = 0;
        if (p.status === undefined) p.status = 'active';
        if (!p.process) p.process = [];
        if (!p.relations) p.relations = [];
        Object.keys(p.entries).forEach(k => {
          p.entries[k].forEach(e => {
            if (e.importance === undefined) e.importance = 0;
            if (e.relatedProcessId === undefined) e.relatedProcessId = null;
            if (e.createdFromTodoId === undefined) e.createdFromTodoId = null;
            if (e.note === undefined) e.note = '';
            if (e.status === undefined) e.status = 'active';
            if (e.occurrenceCount === undefined) e.occurrenceCount = 1;
            if (e.updatedAt === undefined) e.updatedAt = e.createdAt || new Date().toISOString();
          });
        });
      });
    });
    // 思绪补新字段
    data.thoughts.forEach(t => {
      if (t.importance === undefined) t.importance = 0;
      if (t.note === undefined) t.note = '';
      if (t.relatedCapId === undefined) t.relatedCapId = null;
      if (t.relatedProjId === undefined) t.relatedProjId = null;
      if (t.relatedEntryType === undefined) t.relatedEntryType = null;
      if (t.relatedEntryId === undefined) t.relatedEntryId = null;
      if (t.relatedLiberationId === undefined) t.relatedLiberationId = null;
    });
    // 待办补备注和关联字段
    data.todos.forEach(t => {
      if (t.note === undefined) t.note = '';
      if (t.sourceCapId === undefined) t.sourceCapId = null;
      if (t.sourceProjId === undefined) t.sourceProjId = null;
      if (t.sourceEntryType === undefined) t.sourceEntryType = null;
      if (t.sourceEntryId === undefined) t.sourceEntryId = null;
    });
    // 习惯补新字段
    data.habits.forEach(h => {
      if (h.importance === undefined) h.importance = 0;
      if (h.status === undefined) h.status = 'pool';
      if (h.sourceType === undefined) h.sourceType = 'direct';
      if (!h.completedDates) h.completedDates = [];
      if (h.currentStreak === undefined) h.currentStreak = 0;
      if (h.bestStreak === undefined) h.bestStreak = 0;
      if (h.note === undefined) h.note = '';
      if (h.sourceCapId === undefined) h.sourceCapId = null;
      if (h.sourceProjId === undefined) h.sourceProjId = null;
      if (h.sourceEntryId === undefined) h.sourceEntryId = null;
      if (h.sourceEntryType === undefined) h.sourceEntryType = null;
      if (h.sourceLiberationId === undefined) h.sourceLiberationId = null;
      if (h.archivedAt === undefined) h.archivedAt = null;
    });
    // 解放脑补重要度
    data.liberationEntries.forEach(e => {
      if (e.importance === undefined) e.importance = 0;
    });
    // 保存补字段后的数据回 IDB
    await this.set('allData', data);
    return data;
  },

  async getAll() {
    this._allData = (await this.get('allData')) || await this.init();
    return this._allData;
  },

  async saveAll(data) {
    await this.set('allData', data);
  },

  // ==================== 命名配置 ====================
  async updateNameConfig(partial) {
    const data = await this.getAll();
    data.nameConfig = { ...data.nameConfig, ...partial };
    await this.saveAll(data);
    return data.nameConfig;
  },

  // ==================== 能力 ====================
  async addCapability(name, importance) {
    const data = await this.getAll();
    const cap = { id: uid('cap'), name, importance: importance || 0,
      createdAt: new Date().toISOString(), projects: [] };
    data.capabilities.push(cap);
    await this.saveAll(data);
    return cap;
  },
  async updateCapability(id, name, importance, status) {
    const data = await this.getAll(); const c = data.capabilities.find(x => x.id === id);
    if (!c) return null;
    if (name !== undefined) c.name = name;
    if (importance !== undefined) c.importance = importance;
    if (status !== undefined) c.status = status;
    await this.saveAll(data); return c;
  },
  async deleteCapability(id) {
    const data = await this.getAll();
    data.capabilities = data.capabilities.filter(x => x.id !== id);
    await this.saveAll(data);
  },

  // ==================== 专项 ====================
  async addProject(capId, name, importance) {
    const data = await this.getAll(); const cap = data.capabilities.find(c => c.id === capId);
    if (!cap) return null;
    const p = { id: uid('proj'), name, importance: importance || 0,
      createdAt: new Date().toISOString(), process: [], relations: [],
      entries: { action: [], problem: [], learning: [], review: [] } };
    cap.projects.push(p);
    await this.saveAll(data); return p;
  },
  async updateProject(capId, projId, name, importance, status) {
    const data = await this.getAll(); const cap = data.capabilities.find(c => c.id === capId);
    if (!cap) return null; const p = cap.projects.find(x => x.id === projId);
    if (!p) return null;
    if (name !== undefined) p.name = name;
    if (importance !== undefined) p.importance = importance;
    if (status !== undefined) p.status = status;
    await this.saveAll(data); return p;
  },
  async deleteProject(capId, projId) {
    const data = await this.getAll(); const cap = data.capabilities.find(c => c.id === capId);
    if (!cap) return;
    cap.projects = cap.projects.filter(x => x.id !== projId);
    await this.saveAll(data);
  },

  // ==================== 条目（行动/问题/学习/总结） ====================
  async addEntry(capId, projId, type, text, importance, relatedTodoId, relatedProcessId, createdFromTodoId, note) {
    const data = await this.getAll(); const cap = data.capabilities.find(c => c.id === capId);
    if (!cap) return null; const proj = cap.projects.find(p => p.id === projId);
    if (!proj) return null;
    const entry = { id: uid('entry'), text, createdAt: new Date().toISOString(),
      importance: importance || 0, relatedTodoId: relatedTodoId || null,
      relatedProcessId: relatedProcessId || null, createdFromTodoId: createdFromTodoId || null,
      note: note || '', syncThoughtId: null };
    if (!proj.entries[type]) proj.entries[type] = [];
    proj.entries[type].push(entry);
    if (relatedProcessId) {
      const pe = (proj.process||[]).find(x => x.id === relatedProcessId);
      if (pe && !pe.relatedEntryIds.includes(entry.id)) pe.relatedEntryIds.push(entry.id);
    }
    if (createdFromTodoId) {
      const todo = data.todos.find(t => t.id === createdFromTodoId);
      if (todo) { if (!todo.generatedEntryIds) todo.generatedEntryIds = []; if (!todo.generatedEntryIds.includes(entry.id)) todo.generatedEntryIds.push(entry.id); }
    }
    await this.saveAll(data); return entry;
  },
  async updateEntry(capId, projId, type, entryId, text, importance, relatedProcessId, note, status, occurrenceCount, updatedAt) {
    const data = await this.getAll(); const cap = data.capabilities.find(c => c.id === capId);
    if (!cap) return null; const proj = cap.projects.find(p => p.id === projId);
    if (!proj) return null; const entry = (proj.entries[type]||[]).find(e => e.id === entryId);
    if (!entry) return null;
    if (text !== undefined) entry.text = text;
    if (importance !== undefined) entry.importance = importance;
    if (note !== undefined) entry.note = note;
    if (status !== undefined) entry.status = status;
    if (occurrenceCount !== undefined) entry.occurrenceCount = occurrenceCount;
    if (updatedAt !== undefined) entry.updatedAt = updatedAt;
    if (relatedProcessId !== undefined) {
      if (entry.relatedProcessId) {
        const oldPe = (proj.process||[]).find(x => x.id === entry.relatedProcessId);
        if (oldPe) oldPe.relatedEntryIds = oldPe.relatedEntryIds.filter(id => id !== entryId);
      }
      entry.relatedProcessId = relatedProcessId;
      if (relatedProcessId) {
        const newPe = (proj.process||[]).find(x => x.id === relatedProcessId);
        if (newPe && !newPe.relatedEntryIds.includes(entryId)) newPe.relatedEntryIds.push(entryId);
      }
    }
    await this.saveAll(data); return entry;
  },
  async deleteEntry(capId, projId, type, entryId) {
    const data = await this.getAll(); const cap = data.capabilities.find(c => c.id === capId);
    if (!cap) return; const proj = cap.projects.find(p => p.id === projId);
    if (!proj) return;
    proj.entries[type] = (proj.entries[type]||[]).filter(e => e.id !== entryId);
    // 同时删除相关关联
    if (proj.relations) proj.relations = proj.relations.filter(r => r.fromId !== entryId && r.toId !== entryId);
    await this.saveAll(data);
  },

  // ==================== 关联关系 ====================
  async addRelation(capId, projId, fromId, toId, type) {
    const data = await this.getAll(); const cap = data.capabilities.find(c => c.id === capId);
    if (!cap) return null; const proj = cap.projects.find(p => p.id === projId);
    if (!proj) return null;
    if (!proj.relations) proj.relations = [];
    // 检查是否已存在相同关联（双向检查）
    if (proj.relations.some(r => (r.fromId===fromId&&r.toId===toId&&r.type===type)||(r.fromId===toId&&r.toId===fromId&&r.type===type))) return null;
    const rel = { id: uid('rel'), fromId, toId, type: type || 'discover' };
    proj.relations.push(rel);
    await this.saveAll(data); return rel;
  },
  async deleteRelation(capId, projId, relationId) {
    const data = await this.getAll(); const cap = data.capabilities.find(c => c.id === capId);
    if (!cap) return; const proj = cap.projects.find(p => p.id === projId);
    if (!proj || !proj.relations) return;
    proj.relations = proj.relations.filter(r => r.id !== relationId);
    await this.saveAll(data);
  },

  // ==================== 过程（已完成待办归档） ====================
  async addProcessEntry(capId, projId, text, importance, todoId) {
    const data = await this.getAll(); const cap = data.capabilities.find(c => c.id === capId);
    if (!cap) return null; const proj = cap.projects.find(p => p.id === projId);
    if (!proj) return null;
    const pe = { id: uid('proc'), text, importance: importance || 0,
      todoId: todoId || null, completedAt: new Date().toISOString(), relatedEntryIds: [] };
    if (!proj.process) proj.process = [];
    proj.process.push(pe);
    await this.saveAll(data); return pe;
  },
  async addRelatedEntryToProcess(capId, projId, processId, entryId) {
    const data = await this.getAll(); const cap = data.capabilities.find(c => c.id === capId);
    if (!cap) return; const proj = cap.projects.find(p => p.id === projId);
    if (!proj) return; const pe = (proj.process||[]).find(x => x.id === processId);
    if (!pe) return;
    if (!pe.relatedEntryIds.includes(entryId)) pe.relatedEntryIds.push(entryId);
    await this.saveAll(data);
  },

  // ==================== 思绪 ====================
  async addThought(text, tags, importance, note) {
    const data = await this.getAll();
    const t = { id: uid('th'), text, createdAt: new Date().toISOString(), tags: tags || [],
      importance: importance || 0, note: note || '',
      relatedCapId: null, relatedProjId: null, relatedEntryType: null, relatedEntryId: null, relatedLiberationId: null };
    data.thoughts.unshift(t);
    await this.saveAll(data); return t;
  },
  async updateThought(id, text, tags, importance, note) {
    const data = await this.getAll(); const t = data.thoughts.find(x => x.id === id);
    if (!t) return null;
    if (text !== undefined) t.text = text;
    if (tags !== undefined) t.tags = tags;
    if (importance !== undefined) t.importance = importance;
    if (note !== undefined) t.note = note;
    await this.saveAll(data); return t;
  },
  async linkThought(id, relatedCapId, relatedProjId, relatedEntryType, relatedEntryId, relatedLiberationId) {
    const data = await this.getAll(); const t = data.thoughts.find(x => x.id === id);
    if (!t) return null;
    t.relatedCapId = relatedCapId || null;
    t.relatedProjId = relatedProjId || null;
    t.relatedEntryType = relatedEntryType || null;
    t.relatedEntryId = relatedEntryId || null;
    t.relatedLiberationId = relatedLiberationId || null;
    // 如果关联到行为/专项，自动创建收获条目（双向同步）
    if (relatedCapId && relatedProjId) {
      const cap = data.capabilities.find(c => c.id === relatedCapId);
      const proj = cap?.projects.find(p => p.id === relatedProjId);
      if (proj) {
        // 检查是否已有同步的收获
        const exists = (proj.entries.review||[]).some(r => r.syncThoughtId === id);
        if (!exists) {
          const review = { id: uid('entry'), text: t.text, createdAt: t.createdAt,
            importance: t.importance || 0, relatedTodoId: null, relatedProcessId: null,
            createdFromTodoId: null, note: t.note || '', syncThoughtId: id };
          if (!proj.entries.review) proj.entries.review = [];
          proj.entries.review.push(review);
          t.sourceReviewId = review.id;
          t.sourceReviewCapId = relatedCapId;
          t.sourceReviewProjId = relatedProjId;
        }
      }
    }
    await this.saveAll(data); return t;
  },
  async deleteThought(id) {
    const data = await this.getAll();
    data.thoughts = data.thoughts.filter(x => x.id !== id);
    await this.saveAll(data);
  },
  async searchThoughts(q) {
    const data = await this.getAll();
    const kw = q.toLowerCase();
    return data.thoughts.filter(t =>
      t.text.toLowerCase().includes(kw) ||
      (t.tags||[]).some(tag => tag.toLowerCase().includes(kw))
    );
  },
  getAllTags() {
    if (!this._allData) return [];
    const tags = new Set();
    this._allData.thoughts.forEach(t => (t.tags||[]).forEach(tag => tags.add(tag)));
    return [...tags].sort();
  },

  // ==================== 待办 ====================
  async addTodo(text, importance, source, note) {
    const data = await this.getAll();
    const todo = { id: uid('todo'), text, importance: importance || 0,
      createdAt: new Date().toISOString(),
      isToday: false, status: 'active', completedAt: null,
      note: note || '',
      sourceCapId: source?.capId || null,
      sourceProjId: source?.projId || null,
      sourceEntryType: source?.entryType || null,
      sourceEntryId: source?.entryId || null,
      processCapId: null, processProjId: null, processEntryIds: [] };
    data.todos.push(todo);
    await this.saveAll(data); return todo;
  },
  async updateTodo(id, updates) {
    const data = await this.getAll(); const todo = data.todos.find(x => x.id === id);
    if (!todo) return null;
    Object.assign(todo, updates);
    await this.saveAll(data); return todo;
  },
  async completeTodo(id, processCapId, processProjId) {
    const data = await this.getAll(); const todo = data.todos.find(x => x.id === id);
    if (!todo) return null;
    todo.status = 'completed';
    todo.completedAt = new Date().toISOString();
    await this.saveAll(data); return todo;
  },
  async deleteTodo(id) {
    const data = await this.getAll();
    data.todos = data.todos.filter(x => x.id !== id);
    await this.saveAll(data);
  },
  getTodos(data) {
    return {
      today: data.todos.filter(t => t.isToday && t.status === 'active'),
      library: data.todos.filter(t => !t.isToday && t.status === 'active'),
      completed: data.todos.filter(t => t.status === 'completed')
    };
  },

  // ==================== 解放脑 ====================
  async addLiberationEntry(text, importance) {
    const data = await this.getAll();
    data.liberationEntries.unshift({ id: uid('lib'), text, createdAt: new Date().toISOString(), importance: importance || 0 });
    await this.saveAll(data);
  },
  async updateLiberationEntry(id, text, importance) {
    const data = await this.getAll(); const e = data.liberationEntries.find(x => x.id === id);
    if (!e) return null;
    if (text !== undefined) e.text = text;
    if (importance !== undefined) e.importance = importance;
    await this.saveAll(data);
  },
  async deleteLiberationEntry(id) {
    const data = await this.getAll();
    data.liberationEntries = data.liberationEntries.filter(x => x.id !== id);
    await this.saveAll(data);
  },

  // ==================== 问题计数 ====================
  async addProblemOccurrence(capId, projId, entryId) {
    const data = await this.getAll();
    const cap = data.capabilities.find(c => c.id === capId);
    if (!cap) return null;
    const proj = cap.projects.find(p => p.id === projId);
    if (!proj) return null;
    const entry = (proj.entries.problem || []).find(e => e.id === entryId);
    if (!entry) return null;
    entry.occurrenceCount = (entry.occurrenceCount || 1) + 1;
    entry.updatedAt = new Date().toISOString();
    await this.saveAll(data);
    return entry;
  },

  // ==================== 外交墙 ====================
  async addDiplomacyEntry(text) {
    const data = await this.getAll();
    data.diplomacyEntries.unshift({ id: uid('dip'), text, createdAt: new Date().toISOString() });
    await this.saveAll(data);
  },
  async updateDiplomacyEntry(id, text) {
    const data = await this.getAll(); const e = data.diplomacyEntries.find(x => x.id === id);
    if (!e) return null; e.text = text; await this.saveAll(data);
  },
  async deleteDiplomacyEntry(id) {
    const data = await this.getAll();
    data.diplomacyEntries = data.diplomacyEntries.filter(x => x.id !== id);
    await this.saveAll(data);
  },

  // ==================== 目标 ====================
  async addGoal(name, importance, description) {
    const data = await this.getAll();
    const g = { id: uid('goal'), name, description: description || '',
      importance: importance || 0, createdAt: new Date().toISOString(), status: 'active' };
    data.goals.push(g);
    await this.saveAll(data); return g;
  },
  async updateGoal(id, name, importance, description, status) {
    const data = await this.getAll(); const g = data.goals.find(x => x.id === id);
    if (!g) return null;
    if (name !== undefined) g.name = name;
    if (importance !== undefined) g.importance = importance;
    if (description !== undefined) g.description = description;
    if (status !== undefined) g.status = status;
    await this.saveAll(data); return g;
  },
  async deleteGoal(id) {
    const data = await this.getAll();
    data.goals = data.goals.filter(x => x.id !== id);
    await this.saveAll(data);
  },

  // ==================== 习惯 ====================
  async addHabit(text, importance, source) {
    const data = await this.getAll();
    const habit = {
      id: uid('hab'), text, importance: importance || 0,
      status: 'pool',
      sourceType: source?.type || 'direct',
      sourceCapId: source?.capId || null,
      sourceProjId: source?.projId || null,
      sourceEntryId: source?.entryId || null,
      sourceEntryType: source?.entryType || null,
      sourceLiberationId: source?.liberationId || null,
      note: source?.note || '',
      createdAt: new Date().toISOString(),
      archivedAt: null,
      completedDates: [],
      currentStreak: 0, bestStreak: 0
    };
    data.habits.push(habit);
    await this.saveAll(data); return habit;
  },
  async updateHabit(id, updates) {
    const data = await this.getAll(); const h = data.habits.find(x => x.id === id);
    if (!h) return null;
    Object.assign(h, updates);
    if (updates.completedDates !== undefined) {
      const s = calcStreaks(h.completedDates);
      h.currentStreak = s.current; h.bestStreak = s.best;
    }
    await this.saveAll(data); return h;
  },
  async toggleHabitDate(id, dateStr) {
    const data = await this.getAll(); const h = data.habits.find(x => x.id === id);
    if (!h) return null;
    const idx = h.completedDates.indexOf(dateStr);
    if (idx >= 0) h.completedDates.splice(idx, 1);
    else { h.completedDates.push(dateStr); h.completedDates.sort(); }
    const s = calcStreaks(h.completedDates);
    h.currentStreak = s.current; h.bestStreak = s.best;
    await this.saveAll(data); return h;
  },
  async activateHabit(id) {
    const data = await this.getAll(); const h = data.habits.find(x => x.id === id);
    if (!h) return null; h.status = 'active';
    await this.saveAll(data); return h;
  },
  async archiveHabit(id) {
    const data = await this.getAll(); const h = data.habits.find(x => x.id === id);
    if (!h) return null; h.status = 'archived'; h.archivedAt = new Date().toISOString();
    await this.saveAll(data); return h;
  },
  async unarchiveHabit(id) {
    const data = await this.getAll(); const h = data.habits.find(x => x.id === id);
    if (!h) return null; h.status = 'pool'; h.archivedAt = null;
    await this.saveAll(data); return h;
  },
  async deleteHabit(id) {
    const data = await this.getAll();
    data.habits = data.habits.filter(x => x.id !== id);
    await this.saveAll(data);
  },
  getHabits(data) {
    return {
      active: data.habits.filter(h => h.status === 'active'),
      pool: data.habits.filter(h => h.status === 'pool'),
      archived: data.habits.filter(h => h.status === 'archived')
    };
  },

  // ==================== 导出 ====================
  async exportJSON() {
    const data = await this.getAll();
    download(JSON.stringify(data, null, 2), `再塑法典_${today()}.json`, 'application/json');
  },
  async exportMarkdown() {
    const data = await this.getAll(); const n = data.nameConfig;
    let md = `# ${n.topLevel} 数据导出\n导出时间：${new Date().toLocaleString('zh-CN')}\n\n---\n\n`;
    const { today: td, library: lib, completed: comp } = this.getTodos(data);
    md += `## 📋 今日待办\n\n`;
    td.sort((a,b) => b.importance - a.importance).forEach(t => md += `- [ ] ${'⭐'.repeat(t.importance||1)} ${t.text}${t.note ? '（备注: '+t.note+'）' : ''}\n`);
    md += '\n';
    md += `## 📦 待办库\n\n`;
    lib.sort((a,b) => b.importance - a.importance).forEach(t => md += `- ${'⭐'.repeat(t.importance||1)} ${t.text}${t.note ? '（备注: '+t.note+'）' : ''}\n`);
    md += '\n';
    md += `## ✅ 已完成待办\n\n`;
    comp.forEach(t => md += `- ~~${t.text}~~（${new Date(t.completedAt).toLocaleDateString('zh-CN')}）\n`);
    md += '\n';
    md += `## 🧠 ${n.module1}\n\n`;
    data.liberationEntries.forEach(e => md += `- ${e.text}（${fmtDateShort(e.createdAt)}）\n`);
    md += '\n';
    md += `## 💪 ${n.capability}\n\n`;
    const sortedCaps = [...data.capabilities].sort((a,b) => b.importance - a.importance);
    sortedCaps.forEach(cap => {
      md += `### ${'⭐'.repeat(cap.importance||1)} ${cap.name}\n\n`;
      const sortedProjs = [...cap.projects].sort((a,b) => b.importance - a.importance);
      sortedProjs.forEach(proj => {
        md += `#### ${'⭐'.repeat(proj.importance||1)} ${proj.name}\n\n`;
        const types = { action: n.action, problem: n.problem, learning: n.learning, review: n.review };
        Object.entries(types).forEach(([key, label]) => {
          const entries = (proj.entries[key]||[]).sort((a,b) => b.importance - a.importance);
          if (entries.length) {
            md += `**${label}**\n`;
            entries.forEach(e => md += `- ${'⭐'.repeat(e.importance||1)} ${e.text}${e.note ? '（备注: '+e.note+'）' : ''}\n`);
            md += '\n';
          }
        });
        if (proj.process && proj.process.length) {
          md += `**${n.process}**\n`;
          proj.process.forEach(p => md += `- ✅ ${p.text}（${fmtDateShort(p.completedAt)}）\n`);
          md += '\n';
        }
      });
    });
    md += `## 💭 思绪\n\n`;
    data.thoughts.forEach(t => {
      const tags = (t.tags||[]).length ? ` [${t.tags.join(', ')}]` : '';
      md += `- ${'⭐'.repeat(t.importance||1)} ${t.text}${tags}${t.note ? '（备注: '+t.note+'）' : ''}（${fmtDateShort(t.createdAt)}）\n`;
    });
    md += '\n';
    md += `## 🎨 ${n.module3}\n\n`;
    data.diplomacyEntries.forEach(e => md += `- ${e.text}（${fmtDateShort(e.createdAt)}）\n`);
    download(md, `再塑法典_${today()}.md`, 'text/markdown');
  },
  async importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.capabilities !== undefined) {
            if (!data.nameConfig) data.nameConfig = this.getDefaultNameConfig();
            if (!data.goals) data.goals = [];
            if (!data.habits) data.habits = [];
            if (!data.thoughts) data.thoughts = [];
            if (!data.todos) data.todos = [];
            data.todos.forEach(t => { if (!t.generatedEntryIds) t.generatedEntryIds = []; if (t.note === undefined) t.note = ''; });
            data.capabilities.forEach(c => c.projects.forEach(p => {
              if (!p.relations) p.relations = [];
              Object.keys(p.entries).forEach(k => p.entries[k].forEach(e => {
                if (!e.createdFromTodoId) e.createdFromTodoId = null;
                if (e.note === undefined) e.note = '';
              }));
            }));
            data.thoughts.forEach(t => {
              if (t.importance === undefined) t.importance = 0;
              if (t.note === undefined) t.note = '';
              if (t.relatedCapId === undefined) t.relatedCapId = null;
              if (t.relatedProjId === undefined) t.relatedProjId = null;
              if (t.relatedEntryType === undefined) t.relatedEntryType = null;
              if (t.relatedEntryId === undefined) t.relatedEntryId = null;
              if (t.relatedLiberationId === undefined) t.relatedLiberationId = null;
            });
            await this.set('allData', data);
            resolve(data);
          } else reject(new Error('数据格式不正确'));
        } catch (err) { reject(err); }
      };
      reader.readAsText(file);
    });
  }
};

// ===== 工具函数 =====
function uid(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }
function today() { return new Date().toISOString().slice(0,10); }
function fmtDateShort(iso) { return new Date(iso).toLocaleDateString('zh-CN'); }

function calcStreaks(dates) {
  if (!dates || !dates.length) return { current: 0, best: 0 };
  const sorted = [...dates].sort();
  const t = today();
  // current streak: 从今天/昨天往前数
  let current = 0;
  let d = new Date(t);
  const datesSet = new Set(sorted);
  // 如果今天完成了，从今天开始数
  if (datesSet.has(t)) {
    while (datesSet.has(d.toISOString().slice(0, 10))) { current++; d.setDate(d.getDate() - 1); }
  } else {
    // 从昨天开始数
    d.setDate(d.getDate() - 1);
    while (datesSet.has(d.toISOString().slice(0, 10))) { current++; d.setDate(d.getDate() - 1); }
  }
  // best streak
  let best = 0, temp = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000;
    if (Math.abs(diff - 1) < 0.5) temp++;
    else { best = Math.max(best, temp); temp = 1; }
  }
  best = Math.max(best, temp);
  return { current, best };
}

function download(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
