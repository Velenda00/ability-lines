/* ===== IndexedDB 数据层 v2（完整版） ===== */
const DB_NAME = 'AbilityLinesDBv2';
const DB_VERSION = 1;
const STORE_NAME = 'dataStore';

// 数据结构（2026-05-06 v2 完整版）
//
// nameConfig: { topLevel, capability, project, process,
//               action, problem, learning, review,
//               module1, module2, module3 }
// capabilities: [{ id, name, importance, createdAt, projects: [{
//   id, name, importance, createdAt,
//   process: [{ id, text, importance, todoId, completedAt, relatedEntryIds }],
//   entries: { action:[{id,text,createdAt,importance,relatedTodoId}],
//              problem:[{id,text,createdAt,importance,relatedTodoId}],
//              learning:[{id,text,createdAt,importance}],
//              review:[{id,text,createdAt,importance}] }
// }]}]
// thoughts: [{ id, text, createdAt, tags:[] }]
// todos: [{ id, text, importance, createdAt, isToday, status,
//           completedAt,
//           sourceCapId, sourceProjId, sourceEntryType, sourceEntryId,
//           processCapId, processProjId, processEntryIds }]
// liberationEntries: [{ id, text, createdAt }]
// diplomacyEntries: [{ id, text, createdAt }]

const Store = {
  db: null,

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
      topLevel: '能力线',
      capability: '能力', project: '专项', process: '过程',
      action: '行动', problem: '问题', learning: '学习', review: '总结',
      module1: '解放脑', module2: '独立自主', module3: '外交墙'
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
    if (!data.nameConfig.topLevel) data.nameConfig.topLevel = '能力线';
    if (!data.nameConfig.process) data.nameConfig.process = '过程';
    if (!data.goals) data.goals = [];
    if (!data.thoughts) data.thoughts = [];
    if (!data.todos) data.todos = [];
    // 为旧数据补 importance 字段
    data.capabilities.forEach(c => { if (c.importance === undefined) c.importance = 0; });
    data.capabilities.forEach(c => {
      c.projects.forEach(p => {
        if (p.importance === undefined) p.importance = 0;
        if (!p.process) p.process = [];
        Object.keys(p.entries).forEach(k => {
          p.entries[k].forEach(e => {
            if (e.importance === undefined) e.importance = 0;
            if (e.relatedProcessId === undefined) e.relatedProcessId = null;
            if (e.createdFromTodoId === undefined) e.createdFromTodoId = null;
          });
        });
      });
    });
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
  async updateCapability(id, name, importance) {
    const data = await this.getAll(); const c = data.capabilities.find(x => x.id === id);
    if (!c) return null;
    if (name !== undefined) c.name = name;
    if (importance !== undefined) c.importance = importance;
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
      createdAt: new Date().toISOString(), process: [],
      entries: { action: [], problem: [], learning: [], review: [] } };
    cap.projects.push(p);
    await this.saveAll(data); return p;
  },
  async updateProject(capId, projId, name, importance) {
    const data = await this.getAll(); const cap = data.capabilities.find(c => c.id === capId);
    if (!cap) return null; const p = cap.projects.find(x => x.id === projId);
    if (!p) return null;
    if (name !== undefined) p.name = name;
    if (importance !== undefined) p.importance = importance;
    await this.saveAll(data); return p;
  },
  async deleteProject(capId, projId) {
    const data = await this.getAll(); const cap = data.capabilities.find(c => c.id === capId);
    if (!cap) return;
    cap.projects = cap.projects.filter(x => x.id !== projId);
    await this.saveAll(data);
  },

  // ==================== 条目（行动/问题/学习/总结） ====================
  async addEntry(capId, projId, type, text, importance, relatedTodoId, relatedProcessId, createdFromTodoId) {
    const data = await this.getAll(); const cap = data.capabilities.find(c => c.id === capId);
    if (!cap) return null; const proj = cap.projects.find(p => p.id === projId);
    if (!proj) return null;
    const entry = { id: uid('entry'), text, createdAt: new Date().toISOString(),
      importance: importance || 0, relatedTodoId: relatedTodoId || null,
      relatedProcessId: relatedProcessId || null, createdFromTodoId: createdFromTodoId || null };
    if (!proj.entries[type]) proj.entries[type] = [];
    proj.entries[type].push(entry);
    // 同步更新过程/待办的关联
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
  async updateEntry(capId, projId, type, entryId, text, importance, relatedProcessId) {
    const data = await this.getAll(); const cap = data.capabilities.find(c => c.id === capId);
    if (!cap) return null; const proj = cap.projects.find(p => p.id === projId);
    if (!proj) return null; const entry = (proj.entries[type]||[]).find(e => e.id === entryId);
    if (!entry) return null;
    if (text !== undefined) entry.text = text;
    if (importance !== undefined) entry.importance = importance;
    if (relatedProcessId !== undefined) {
      // 解除旧关联
      if (entry.relatedProcessId) {
        const oldPe = (proj.process||[]).find(x => x.id === entry.relatedProcessId);
        if (oldPe) oldPe.relatedEntryIds = oldPe.relatedEntryIds.filter(id => id !== entryId);
      }
      entry.relatedProcessId = relatedProcessId;
      // 建立新关联
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
  async addThought(text, tags) {
    const data = await this.getAll();
    const t = { id: uid('th'), text, createdAt: new Date().toISOString(), tags: tags || [] };
    data.thoughts.unshift(t);
    await this.saveAll(data); return t;
  },
  async updateThought(id, text, tags) {
    const data = await this.getAll(); const t = data.thoughts.find(x => x.id === id);
    if (!t) return null;
    if (text !== undefined) t.text = text;
    if (tags !== undefined) t.tags = tags;
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
  /** 获取所有已使用过的标签（去重） */
  getAllTags() {
    if (!this._allData) return [];
    const tags = new Set();
    this._allData.thoughts.forEach(t => (t.tags||[]).forEach(tag => tags.add(tag)));
    return [...tags].sort();
  },

  // ==================== 待办 ====================
  async addTodo(text, importance, source) {
    const data = await this.getAll();
    const todo = { id: uid('todo'), text, importance: importance || 0,
      createdAt: new Date().toISOString(),
      isToday: false, status: 'active', completedAt: null,
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
    todo.processCapId = processCapId || todo.sourceCapId;
    todo.processProjId = processProjId || todo.sourceProjId;
    // 归档到过程
    const proj = data.capabilities
      .find(c => c.id === todo.processCapId)?.projects
      .find(p => p.id === todo.processProjId);
    if (proj) {
      if (!proj.process) proj.process = [];
      const pe = { id: uid('proc'), text: todo.text,
        importance: todo.importance, todoId: todo.id,
        completedAt: todo.completedAt, relatedEntryIds: [] };
      proj.process.push(pe);
      todo.processEntryIds = [pe.id]; // 关联过程条目
    }
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
  async addLiberationEntry(text) {
    const data = await this.getAll();
    data.liberationEntries.unshift({ id: uid('lib'), text, createdAt: new Date().toISOString() });
    await this.saveAll(data);
  },
  async updateLiberationEntry(id, text) {
    const data = await this.getAll(); const e = data.liberationEntries.find(x => x.id === id);
    if (!e) return null; e.text = text; await this.saveAll(data);
  },
  async deleteLiberationEntry(id) {
    const data = await this.getAll();
    data.liberationEntries = data.liberationEntries.filter(x => x.id !== id);
    await this.saveAll(data);
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

  // ==================== 导出 ====================
  async exportJSON() {
    const data = await this.getAll();
    download(JSON.stringify(data, null, 2), `能力线_${today()}.json`, 'application/json');
  },
  async exportMarkdown() {
    const data = await this.getAll(); const n = data.nameConfig;
    let md = `# ${n.topLevel} 数据导出\n导出时间：${new Date().toLocaleString('zh-CN')}\n\n---\n\n`;
    // 待办
    const { today: td, library: lib, completed: comp } = this.getTodos(data);
    md += `## 📋 今日${n.topLevel}待办\n\n`;
    td.sort((a,b) => b.importance - a.importance).forEach(t => md += `- [ ] ${'⭐'.repeat(t.importance||1)} ${t.text}\n`);
    md += '\n';
    md += `## 📦 待办库\n\n`;
    lib.sort((a,b) => b.importance - a.importance).forEach(t => md += `- ${'⭐'.repeat(t.importance||1)} ${t.text}\n`);
    md += '\n';
    md += `## ✅ 已完成待办\n\n`;
    comp.forEach(t => md += `- ~~${t.text}~~（${new Date(t.completedAt).toLocaleDateString('zh-CN')}）\n`);
    md += '\n';
    // 解放脑
    md += `## 🧠 ${n.module1}\n\n`;
    data.liberationEntries.forEach(e => md += `- ${e.text}（${fmtDateShort(e.createdAt)}）\n`);
    md += '\n';
    // 独立自主
    md += `## 💪 ${n.module2}\n\n`;
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
            entries.forEach(e => md += `- ${'⭐'.repeat(e.importance||1)} ${e.text}\n`);
            md += '\n';
          }
        });
        // 过程
        if (proj.process && proj.process.length) {
          md += `**${n.process}**\n`;
          proj.process.forEach(p => md += `- ✅ ${p.text}（${fmtDateShort(p.completedAt)}）\n`);
          md += '\n';
        }
      });
    });
    // 思绪
    md += `## 💭 思绪\n\n`;
    data.thoughts.forEach(t => {
      const tags = (t.tags||[]).length ? ` [${t.tags.join(', ')}]` : '';
      md += `- ${t.text}${tags}（${fmtDateShort(t.createdAt)}）\n`;
    });
    md += '\n';
    // 外交墙
    md += `## 🎨 ${n.module3}\n\n`;
    data.diplomacyEntries.forEach(e => md += `- ${e.text}（${fmtDateShort(e.createdAt)}）\n`);
    download(md, `能力线_${today()}.md`, 'text/markdown');
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
            if (!data.thoughts) data.thoughts = [];
            if (!data.todos) data.todos = [];
            data.todos.forEach(t => { if (!t.generatedEntryIds) t.generatedEntryIds = []; });
            data.capabilities.forEach(c => c.projects.forEach(p => {
              Object.keys(p.entries).forEach(k => p.entries[k].forEach(e => { if (!e.createdFromTodoId) e.createdFromTodoId = null; }));
            }));
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

function download(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
