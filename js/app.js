/* ===== 应用主逻辑 v5 ===== */
let appData = null;
let currentPage = 'home';
let currentCapId = null, currentProjId = null, currentProjTab = 'action';
let projSelectedEntryId = null; // 项目详情页当前展开的行为条目ID
let _impPickerCallback = null, _confirmCallback = null;
let _abilityTab = 'independence'; // liberation | independence | diplomacy
let _habitTab = 'active'; // active | pool | archived
let _todoTab = 'today'; // today | library | completed

function nc() { return appData.nameConfig || Store.getDefaultNameConfig(); }

document.addEventListener('DOMContentLoaded', async () => {
  appData = await Store.init(); updateAllTitles(); renderHome();
});

// ==================== 页面切换 ====================

function switchPage(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const map = { home:'page-home', ability:'page-ability', goals:'page-goals',
    thoughts:'page-thoughts', todos:'page-todos', project:'page-project' };
  document.getElementById(map[page]||'page-home').classList.add('active');
  updateTitle(); renderPage(); updateNav(); updateFabs();
}

function updateFabs() {
  document.querySelectorAll('.page-fab').forEach(f=>f.classList.remove('visible'));
  const fabMap = {ability:'fab-ability', goals:'fab-goals', thoughts:'fab-thoughts', todos:'fab-todos'};
  if(fabMap[currentPage]) document.getElementById(fabMap[currentPage])?.classList.add('visible');
}

function handleAbilityFab() {
  if(_abilityTab==='liberation') showAddModal('liberation');
  else if(_abilityTab==='diplomacy') showAddModal('diplomacy');
  else showAddCapabilityModal();
}

function updateTitle() {
  const n=nc();
  const t = { home:n.topLevel, ability:'💪 '+n.capability, goals:'🎯 目标',
    thoughts:'💭 思绪', todos:'📋 待办', project:'📋 '+n.project+'详情' };
  document.getElementById('pageTitle').textContent = t[currentPage]||n.topLevel;
  document.getElementById('pageTitleA').textContent = '💪 '+n.capability;
}

function updateNav() {
  const idx = { home:0, ability:1, goals:2, thoughts:3, todos:4 };
  document.querySelectorAll('.nav-item').forEach((n,i)=>n.classList.toggle('active',i===(idx[currentPage]??0)));
}

function renderPage() {
  switch(currentPage) {
    case 'home': renderHome(); break;
    case 'ability': renderAbility(); break;
    case 'goals': renderHabits(); break;
    case 'thoughts': renderThoughts(); break;
    case 'todos': renderTodos(); break;
    case 'project': renderProject(); break;
  }
}

async function refresh() { appData = await Store.getAll(); updateAllTitles(); renderPage(); }
function updateAllTitles() { updateTitle(); }

function fmtDate(iso) {
  if(!iso) return '';
  return new Date(iso).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
}

function sortByImpThenTime(arr) {
  return [...arr].sort((a,b)=>{
    // active优先，completed/resolved置底
    const sa=(a.status==='completed'||a.status==='resolved')?1:0;
    const sb=(b.status==='completed'||b.status==='resolved')?1:0;
    if(sa!==sb) return sa-sb;
    const imp = (b.importance||0) - (a.importance||0);
    if(imp!==0) return imp;
    return new Date(b.createdAt||0) - new Date(a.createdAt||0);
  });
}

// ==================== 查找关联思绪 ====================

function findLinkedThoughts(opts) {
  return appData.thoughts.filter(t => {
    if (opts.todoId && t.relatedTodoId === opts.todoId) return true;
    if (opts.entryId && opts.entryType && t.relatedEntryId === opts.entryId && t.relatedEntryType === opts.entryType
        && t.relatedCapId === opts.capId && t.relatedProjId === opts.projId) return true;
    if (opts.capId && opts.projId && !opts.entryId && t.relatedCapId === opts.capId && t.relatedProjId === opts.projId) return true;
    if (opts.capId && !opts.projId && !opts.entryId && t.relatedCapId === opts.capId) return true;
    return false;
  });
}

function resolveThoughtLink(t) {
  if (!t) return null;
  if (t.relatedLiberationId) {
    const le = appData.liberationEntries.find(x => x.id === t.relatedLiberationId);
    if (le) return { icon: '🧠', label: nc().module1, text: le.text, type: 'liberation' };
  }
  if (t.relatedEntryId && t.relatedEntryType) {
    const cap = appData.capabilities.find(c => c.id === t.relatedCapId);
    const proj = cap?.projects.find(p => p.id === t.relatedProjId);
    const entry = (proj?.entries[t.relatedEntryType]||[]).find(e => e.id === t.relatedEntryId);
    if (entry) {
      const typeLabels = { action:'行动', problem:'问题', learning:'学习', review:'收获' };
      const typeIcons = { action:'🏃', problem:'⚠️', learning:'📖', review:'⭐' };
      return { icon: typeIcons[t.relatedEntryType]||'📝', label: typeLabels[t.relatedEntryType]||t.relatedEntryType,
        text: (cap?cap.name+' > ':'') + (proj?proj.name+' > ':'') + entry.text, type: 'entry',
        capId: t.relatedCapId, projId: t.relatedProjId, entryType: t.relatedEntryType, entryId: t.relatedEntryId };
    }
  }
  if (t.relatedProjId) {
    const cap = appData.capabilities.find(c => c.id === t.relatedCapId);
    const proj = cap?.projects.find(p => p.id === t.relatedProjId);
    if (proj) return { icon: '📂', label: '专项', text: (cap?cap.name+' > ':'') + proj.name, type: 'project' };
  }
  if (t.relatedCapId) {
    const cap = appData.capabilities.find(c => c.id === t.relatedCapId);
    if (cap) return { icon: '💪', label: '能力', text: cap.name, type: 'capability' };
  }
  return null;
}

// ==================== 确认弹窗 ====================

function showConfirmModal(msg, onConfirm) {
  _confirmCallback = onConfirm;
  const overlay = document.createElement('div'); overlay.className='modal-overlay';
  overlay.innerHTML=`<div class="modal-box"><p style="font-size:15px;color:#333;margin-bottom:16px">${esc(msg)}</p>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeConfirm(false)">取消</button>
    <button class="btn-primary" onclick="closeConfirm(true)" style="background:#c0392b">确认删除</button></div></div>`;
  document.body.appendChild(overlay);
  window.closeConfirm = ok => { overlay.remove(); delete window.closeConfirm; if(ok&&_confirmCallback) _confirmCallback(); _confirmCallback=null; };
  overlay.addEventListener('click', e => { if(e.target===overlay) window.closeConfirm(false); });
}

// ==================== 重要性 ====================

function impStars(level) {
  if(!level) return '';
  return '<span class="imp-stars">'+Array.from({length:3},(_,i)=>`<span class="${i<level?'on':'off'}">★</span>`).join('')+'</span>';
}

function renderImpPicker(selected, onChange) {
  _impPickerCallback = onChange;
  const labels = ['','普通','重要','非常重要'];
  return '<div class="imp-picker">'+[0,1,2,3].map(i=>`<button data-val="${i}" class="${i===selected?'selected':''}" onclick="pickImp(${i})">
    ${i===0?'—':''}${i>0?'★'.repeat(i):''}${i>0?'<span style="font-size:11px;color:#999;margin-left:2px">'+labels[i]+'</span>':''}</button>`).join('')+'</div>';
}
function pickImp(lv) {
  document.querySelectorAll('.imp-picker button').forEach(b=>b.classList.toggle('selected',parseInt(b.dataset.val)===lv));
  if(_impPickerCallback) _impPickerCallback(lv);
}

// ==================== 首页（4卡片矩阵） ====================

function renderHome() {
  const h = document.getElementById('page-home');
  const capCnt = appData.capabilities.length;
  const { active: activeHabits } = Store.getHabits(appData);
  const habitCnt = activeHabits.length;
  const thCnt = appData.thoughts.length;
  const {today:td} = Store.getTodos(appData);
  const topCap = capCnt ? sortByImpThenTime(appData.capabilities)[0] : null;
  const topHabit = habitCnt ? sortByImpThenTime(activeHabits)[0] : null;
  const tagFreq = {};
  appData.thoughts.forEach(t=>(t.tags||[]).forEach(tag=>{tagFreq[tag]=(tagFreq[tag]||0)+1;}));
  const topTag = Object.entries(tagFreq).sort((a,b)=>b[1]-a[1])[0];
  const topTodos = sortByImpThenTime(td).slice(0,2);

  h.innerHTML = `
    <div class="home-grid">
      <div class="home-card" onclick="switchPage('ability')">
        <div class="hc-icon">💪</div>
        <div class="hc-num">${capCnt}</div>
        <div class="hc-label">${nc().capability}</div>
        <div class="hc-sub">${topCap ? '⭐'+topCap.name : ''}</div>
      </div>
      <div class="home-card" onclick="switchPage('goals')">
        <div class="hc-icon">🔥</div>
        <div class="hc-num">${habitCnt}</div>
        <div class="hc-label">进行中习惯</div>
        <div class="hc-sub">${topHabit ? '🔥'+(topHabit.currentStreak||0)+'天 '+esc(topHabit.text.slice(0,8)) : ''}</div>
      </div>
      <div class="home-card" onclick="switchPage('thoughts')">
        <div class="hc-icon">💭</div>
        <div class="hc-num">${thCnt}</div>
        <div class="hc-label">思绪</div>
        <div class="hc-sub">${topTag ? '🏷️'+topTag[0] : ''}</div>
      </div>
      <div class="home-card" onclick="switchPage('todos')">
        <div class="hc-icon">📋</div>
        <div class="hc-num">${td.length}</div>
        <div class="hc-label">今日待办</div>
        <div class="hc-sub">${topTodos.map(t=>'· '+esc(t.text.slice(0,12))).join('<br>')}</div>
      </div>
    </div>`;
}

// ==================== 能力页 ====================

function renderAbility() {
  const n=nc();
  const tabs = [
    {key:'liberation',label:n.module1,emoji:'🧠'},
    {key:'independence',label:n.module2,emoji:'💪'},
    {key:'diplomacy',label:n.module3,emoji:'🎨'} ];
  document.getElementById('abilityTabs').innerHTML = tabs.map(t=>
    `<div class="tab ${t.key===_abilityTab?'active':''}" onclick="switchAbilityTab('${t.key}')">${t.emoji} ${t.label}</div>`
  ).join('');

  const con = document.getElementById('abilityContent');
  if (_abilityTab === 'liberation') {
    if(!appData.liberationEntries.length) { con.innerHTML='<div class="empty-state">暂无记录</div>'; return; }
    con.innerHTML = appData.liberationEntries.map(e=>{
      const libHabits = findHabitsByLiberation(e.id);
      const habitBadge = libHabits.length > 0 ? `<span style="font-size:11px;color:#D85A30;margin-left:6px">🔥 ${libHabits.length}</span>` : '';
      return `<div class="entry-card"><div class="entry-meta"><span>${fmtDate(e.createdAt)}${habitBadge}</span>
        <span class="entry-actions"><button class="icon-btn" onclick="showAddHabitForLiberation('${e.id}')" title="创建习惯" style="font-size:12px">🔥</button>
        <button class="icon-btn" onclick="editLiberation('${e.id}')">✏️</button>
        <button class="icon-btn" onclick="deleteItem('liberation','${e.id}')">🗑️</button></span></div>
      <div class="entry-text">${esc(e.text)}</div></div>`;
    }).join('');
  } else if (_abilityTab === 'diplomacy') {
    if(!appData.diplomacyEntries.length) { con.innerHTML='<div class="empty-state">暂无记录</div>'; return; }
    con.innerHTML = appData.diplomacyEntries.map(e=>`
      <div class="entry-card"><div class="entry-meta"><span>${fmtDate(e.createdAt)}</span>
        <span class="entry-actions"><button class="icon-btn" onclick="editDiplomacy('${e.id}')">✏️</button>
        <button class="icon-btn" onclick="deleteItem('diplomacy','${e.id}')">🗑️</button></span></div>
      <div class="entry-text">${esc(e.text)}</div></div>`).join('');
  } else {
    renderCapabilitiesIn(con);
  }
}

function switchAbilityTab(tab) { _abilityTab=tab; renderAbility(); }

function renderCapabilitiesIn(con) {
  const n=nc();
  if(!appData.capabilities.length) { con.innerHTML='<div class="empty-state">还没有'+n.capability+'</div>'; return; }
  const sorted = sortByImpThenTime(appData.capabilities);
  con.innerHTML = sorted.map(cap=>{
    const isComp = cap.status==='completed';
    const total = cap.projects.reduce((s,p)=>s+Object.values(p.entries).reduce((a,arr)=>a+arr.length,0),0);
    const projCount = cap.projects.length;
    const sortedProjs = sortByImpThenTime(cap.projects);
    return `<div class="cap-section" style="${isComp?'opacity:0.5':''}">
      <div class="cap-header" onclick="toggleCapSection(this)">
        <span class="cap-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>
        <div style="flex:1;min-width:0">
          <div class="cap-name" style="${isComp?'text-decoration:line-through':''}">${isComp?'✅ ':''}${esc(cap.name)}${impStars(cap.importance)}</div>
          <div class="cap-count">${projCount} 个${n.project} · ${total} 条记录</div>
        </div>
        <div class="cap-actions">
          <button class="icon-btn" onclick="event.stopPropagation();toggleCapStatus('${cap.id}')" title="${isComp?'恢复':'完成'}">${isComp?'🔄':'✅'}</button>
          <button class="icon-btn" onclick="event.stopPropagation();editCap('${cap.id}')">✏️</button>
          <button class="icon-btn" onclick="event.stopPropagation();deleteItem('capability','${cap.id}')">🗑️</button>
          <button class="icon-btn" style="font-size:11px;color:var(--color-primary);font-weight:600" onclick="event.stopPropagation();showAddProjectModal('${cap.id}')">+${n.project}</button>
        </div>
      </div>
      <div class="proj-list">
        ${sortedProjs.length===0?'<div class="cap-empty">暂无'+n.project+'</div>'
          : sortedProjs.map(p=>{
            const pComp = p.status==='completed';
            const pTotal = Object.values(p.entries).reduce((a,arr)=>a+arr.length,0);
            const projThoughts = findLinkedThoughts({ capId: cap.id, projId: p.id });
            return `<div class="project-item" onclick="openProject('${cap.id}','${p.id}')" style="${pComp?'opacity:0.5':''}">
              <div class="proj-indicator" style="background:var(--color-primary);opacity:.55"></div>
              <div style="flex:1;min-width:0">
                <span class="pj-name" style="${pComp?'text-decoration:line-through':''}">${pComp?'✅ ':''}${esc(p.name)}${impStars(p.importance)}</span>
                <div class="pj-stats">${pTotal}条${projThoughts.length?' · 💭'+projThoughts.length:''}</div>
              </div>
              <span style="display:flex;align-items:center;gap:2px">
                <button class="icon-btn" onclick="event.stopPropagation();toggleProjStatus('${cap.id}','${p.id}')" title="${pComp?'恢复':'完成'}" style="font-size:12px">${pComp?'🔄':'✅'}</button>
                <button class="icon-btn" onclick="event.stopPropagation();editProj('${cap.id}','${p.id}')">✏️</button>
                <button class="icon-btn" onclick="event.stopPropagation();deleteItem('project','${cap.id}','${p.id}')">🗑️</button>
                <span class="proj-item-arrow" style="color:var(--text-hint);display:flex;align-items:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px"><path d="M9 18l6-6-6-6"/></svg></span>
              </span>
            </div>`;
          }).join('')}
      </div>
    </div>`;
  }).join('');
}

function toggleCapSection(header) {
  const section = header.closest('.cap-section');
  const projList = section.querySelector('.proj-list');
  const chevron = header.querySelector('.cap-chevron');
  if(!projList) return;
  const isExpanded = projList.classList.contains('expanded');
  projList.classList.toggle('expanded');
  if(chevron) chevron.classList.toggle('expanded', !isExpanded);
}

// ==================== 习惯 ====================

function renderHabits() {
  const tabs = [
    { key: 'active', label: '进行中', emoji: '🔥' },
    { key: 'pool', label: '习惯池', emoji: '📦' },
    { key: 'archived', label: '归档库', emoji: '🗄️' }
  ];
  document.getElementById('habitTabs').innerHTML = tabs.map(t =>
    `<div class="tab ${t.key === _habitTab ? 'active' : ''}" onclick="switchHabitTab('${t.key}')">${t.emoji} ${t.label}</div>`
  ).join('');

  const con = document.getElementById('habitContent');
  const { active, pool, archived } = Store.getHabits(appData);
  const td = today();

  if (_habitTab === 'active') {
    if (!active.length) {
      con.innerHTML = '<div class="empty-state">暂无进行中的习惯<br><span style="font-size:12px;color:var(--text-hint)">从习惯池激活，或点击 + 直接创建</span></div>';
      return;
    }
    con.innerHTML = `<div class="habit-list">${sortByImpThenTime(active).map(h => renderHabitCard(h, td)).join('')}</div>`;
  } else if (_habitTab === 'pool') {
    if (!pool.length) {
      con.innerHTML = '<div class="empty-state">习惯池为空<br><span style="font-size:12px;color:var(--text-hint)">从行为条目或解放脑创建习惯</span></div>';
      return;
    }
    con.innerHTML = `<div class="habit-list">${sortByImpThenTime(pool).map(h => renderHabitPoolCard(h)).join('')}</div>`;
  } else {
    if (!archived.length) {
      con.innerHTML = '<div class="empty-state">暂无归档习惯</div>';
      return;
    }
    con.innerHTML = `<div class="habit-list">${[...archived].sort((a, b) => new Date(b.archivedAt || 0) - new Date(a.archivedAt || 0)).map(h => renderArchivedHabitCard(h)).join('')}</div>`;
  }
}

function switchHabitTab(tab) { _habitTab = tab; renderHabits(); }

function isHabitDoneToday(h, td) { return (h.completedDates || []).includes(td); }

function getStreakEmoji(s) {
  if (s >= 30) return '🔥🔥🔥';
  if (s >= 14) return '🔥🔥';
  if (s >= 3) return '🔥';
  return '';
}

function getStreakMsg(s) {
  if (s >= 30) return '坚持了一个月！太强了！';
  if (s >= 14) return '两周了！继续保持！';
  if (s >= 7) return '一周达成！习惯正在形成！';
  if (s >= 3) return '连续3天，不错的开始！';
  if (s >= 1) return '连续打卡中';
  return '';
}

function findHabitsByEntry(capId, projId, entryId, entryType) {
  return appData.habits.filter(h =>
    h.sourceType === 'behavior' &&
    h.sourceCapId === capId &&
    h.sourceProjId === projId &&
    h.sourceEntryId === entryId &&
    h.sourceEntryType === entryType
  );
}
function findHabitsByLiberation(liberationId) {
  return appData.habits.filter(h =>
    h.sourceType === 'liberation' && h.sourceLiberationId === liberationId
  );
}
function resolveHabitSource(h) {
  if (h.sourceType === 'liberation' && h.sourceLiberationId) {
    const le = appData.liberationEntries.find(x => x.id === h.sourceLiberationId);
    if (le) return { icon: '🧠', label: nc().module1, text: le.text, link: "switchPage('ability')" };
  }
  if (h.sourceType === 'behavior' && h.sourceCapId && h.sourceProjId) {
    const cap = appData.capabilities.find(c => c.id === h.sourceCapId);
    const proj = cap?.projects.find(p => p.id === h.sourceProjId);
    const entry = proj ? (proj.entries[h.sourceEntryType] || []).find(e => e.id === h.sourceEntryId) : null;
    if (cap && proj) {
      const link = `openProject('${cap.id}','${proj.id}')`;
      if (entry) return { icon: '🏃', label: '行为', text: cap.name + ' > ' + proj.name + ' > ' + entry.text, link };
      return { icon: '📂', label: '专项', text: cap.name + ' > ' + proj.name, link };
    }
  }
  return null;
}

function renderHabitCard(h, td) {
  const done = isHabitDoneToday(h, td);
  const streak = h.currentStreak || 0;
  const emoji = getStreakEmoji(streak);
  const msg = getStreakMsg(streak);
  const total = (h.completedDates || []).length;
  const src = resolveHabitSource(h);

  let srcHtml = '';
  if (src) {
    srcHtml = `<div class="habit-source" onclick="${src.link}">
      <span>${src.icon} ${esc(src.label)}：${esc(src.text.slice(0, 30))}${src.text.length > 30 ? '...' : ''}</span></div>`;
  }
  let streakHtml = '';
  if (streak > 0) {
    streakHtml = `<div class="habit-streak"><span class="streak-count">${emoji} ${streak}天</span><span class="streak-msg">${msg}</span></div>`;
  }

  return `<div class="habit-card${done ? ' habit-done' : ''}">
    <div class="habit-card-main">
      <input type="checkbox" ${done ? 'checked' : ''} onchange="toggleHabitToday('${h.id}')"
        style="width:20px;height:20px;margin-top:2px;flex-shrink:0;accent-color:var(--color-primary);cursor:pointer">
      <div class="habit-body">
        <div class="habit-text">${done ? '<s>' + esc(h.text) + '</s>' : esc(h.text)}${impStars(h.importance)}</div>
        ${srcHtml}${streakHtml}
      </div>
      <div class="habit-actions">
        <button class="icon-btn" onclick="editHabit('${h.id}')">✏️</button>
        <button class="icon-btn" onclick="archiveHabit('${h.id}')">📁</button>
        <button class="icon-btn" onclick="deleteItem('habit','${h.id}')">🗑️</button>
      </div>
    </div>
    <div class="habit-stats"><span>总计 ${total} 次</span><span>最长 ${h.bestStreak || 0} 天</span></div>
  </div>`;
}

function renderHabitPoolCard(h) {
  const src = resolveHabitSource(h);
  let srcHtml = '';
  if (src) {
    srcHtml = `<div class="habit-source"><span>${src.icon} ${esc(src.label)}：${esc(src.text.slice(0, 30))}${src.text.length > 30 ? '...' : ''}</span></div>`;
  }
  return `<div class="habit-card habit-pool-card">
    <div class="habit-card-main">
      <div class="habit-body">
        <div class="habit-text">${esc(h.text)}${impStars(h.importance)}</div>
        ${srcHtml}
      </div>
      <div class="habit-actions">
        <button class="icon-btn" style="font-size:12px;color:var(--color-success)" onclick="activateHabit('${h.id}')" title="激活">✅</button>
        <button class="icon-btn" onclick="editHabit('${h.id}')">✏️</button>
        <button class="icon-btn" onclick="deleteItem('habit','${h.id}')">🗑️</button>
      </div>
    </div>
    ${h.note ? `<div class="habit-stats"><span>💬 ${esc(h.note.slice(0, 25))}</span></div>` : ''}
  </div>`;
}

function renderArchivedHabitCard(h) {
  const total = (h.completedDates || []).length;
  const src = resolveHabitSource(h);
  let srcHtml = '';
  if (src) {
    srcHtml = `<div class="habit-source"><span>${src.icon} ${esc(src.label)}：${esc(src.text.slice(0, 30))}${src.text.length > 30 ? '...' : ''}</span></div>`;
  }
  return `<div class="habit-card habit-archived-card">
    <div class="habit-card-main">
      <div class="habit-body">
        <div class="habit-text" style="text-decoration:line-through">${esc(h.text)}${impStars(h.importance)}</div>
        ${srcHtml}
      </div>
      <div class="habit-actions">
        <button class="icon-btn" onclick="unarchiveHabit('${h.id}')" style="font-size:12px">🔄</button>
        <button class="icon-btn" onclick="deleteItem('habit','${h.id}')">🗑️</button>
      </div>
    </div>
    <div class="habit-stats">
      <span>归档于 ${h.archivedAt ? fmtDateShort(h.archivedAt) : '-'}</span>
      <span>总计 ${total} 次</span>
      <span>最长 ${h.bestStreak || 0} 天</span>
    </div>
  </div>`;
}

function showAddHabitModal() {
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
  let _imp = 0;
  overlay.innerHTML = `<div class="modal-box"><h3>🔥 新建习惯</h3>
    <textarea id="mText" rows="2" placeholder="描述你的习惯..." style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical"></textarea>
    ${renderImpPicker(0, l => { _imp = l; })}
    <textarea id="mNote" placeholder="💬 备注（选填）" rows="2" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical"></textarea>
    <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:10px">直接创建的习惯将进入习惯池，激活后开始追踪</div>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeAddHabitM()">取消</button>
    <button class="btn-primary" onclick="confirmAddHabitM()">创建</button></div></div>`;
  document.body.appendChild(overlay); overlay.querySelector('#mText').focus();
  window.confirmAddHabitM = async () => {
    const txt = overlay.querySelector('#mText').value.trim(); if (!txt) { showToast('内容不能为空'); return; }
    const note = overlay.querySelector('#mNote').value.trim();
    overlay.remove(); delete window.confirmAddHabitM; delete window.closeAddHabitM; _impPickerCallback = null;
    try {
      await Store.addHabit(txt, _imp, { type: 'direct', note });
      _habitTab = 'pool';
      await refresh(); showToast('✅ 习惯已创建，在习惯池中');
    } catch(err) { showToast('❌ 创建失败: ' + err.message); console.error(err); }
  };
  window.closeAddHabitM = () => { overlay.remove(); delete window.confirmAddHabitM; delete window.closeAddHabitM; _impPickerCallback = null; };
  overlay.addEventListener('click', e => { if (e.target === overlay) window.closeAddHabitM(); });
}

function editHabit(id) {
  const h = appData.habits.find(x => x.id === id); if (!h) return;
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
  let _imp = h.importance || 0;
  overlay.innerHTML = `<div class="modal-box"><h3>编辑习惯</h3>
    <textarea id="mText" rows="2" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(h.text)}</textarea>
    ${renderImpPicker(_imp, l => { _imp = l; })}
    <textarea id="mNote" placeholder="💬 备注（选填）" rows="2" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(h.note || '')}</textarea>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeEditHabitM()">取消</button>
    <button class="btn-primary" onclick="confirmEditHabitM('${id}')">保存</button></div></div>`;
  document.body.appendChild(overlay); overlay.querySelector('#mText').focus();
  window.confirmEditHabitM = async (hid) => {
    const txt = overlay.querySelector('#mText').value.trim(); if (!txt) { showToast('内容不能为空'); return; }
    const note = overlay.querySelector('#mNote').value.trim();
    overlay.remove(); delete window.confirmEditHabitM; delete window.closeEditHabitM; _impPickerCallback = null;
    await Store.updateHabit(hid, { text: txt, importance: _imp, note });
    await refresh();
  };
  window.closeEditHabitM = () => { overlay.remove(); delete window.confirmEditHabitM; delete window.closeEditHabitM; _impPickerCallback = null; };
  overlay.addEventListener('click', e => { if (e.target === overlay) window.closeEditHabitM(); });
}

async function toggleHabitToday(id) {
  const td = today();
  await Store.toggleHabitDate(id, td);
  await refresh();
  const h = appData.habits.find(x => x.id === id);
  if (h && isHabitDoneToday(h, td)) {
    showToast('✅ 打卡成功！' + getStreakEmoji(h.currentStreak));
  }
}

async function activateHabit(id) {
  await Store.activateHabit(id);
  _habitTab = 'active';
  await refresh(); showToast('✅ 习惯已激活，开始打卡吧！');
}

async function archiveHabit(id) {
  await Store.archiveHabit(id);
  await refresh(); showToast('📁 习惯已归档');
}

async function unarchiveHabit(id) {
  await Store.unarchiveHabit(id);
  _habitTab = 'pool';
  await refresh(); showToast('🔄 习惯已恢复到习惯池');
}

function showAddHabitForEntry(entryId, entryType) {
  const proj = getProj(); if (!proj) return;
  const e = findEntryInProj(entryId); if (!e) return;
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
  let _imp = 0;
  overlay.innerHTML = `<div class="modal-box"><h3>🔥 创建习惯</h3>
    <p style="font-size:11px;color:var(--text-tertiary);margin-bottom:8px">将关联到「${esc(e.entry.text.slice(0, 15))}」，进入习惯池</p>
    <textarea id="mText" rows="2" placeholder="描述要养成的习惯..." style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical"></textarea>
    ${renderImpPicker(0, l => { _imp = l; })}
    <textarea id="mNote" placeholder="💬 备注（选填）" rows="2" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical"></textarea>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeHabitEntryM()">取消</button>
    <button class="btn-primary" onclick="confirmHabitEntryM('${entryId}','${entryType}')">创建</button></div></div>`;
  document.body.appendChild(overlay); overlay.querySelector('#mText').focus();
  window.confirmHabitEntryM = async (eid, eType) => {
    const txt = overlay.querySelector('#mText').value.trim(); if (!txt) { showToast('内容不能为空'); return; }
    const note = overlay.querySelector('#mNote').value.trim();
    overlay.remove(); delete window.confirmHabitEntryM; delete window.closeHabitEntryM; _impPickerCallback = null;
    try {
      await Store.addHabit(txt, _imp, { type: 'behavior', capId: currentCapId, projId: currentProjId, entryType: eType, entryId: eid, note });
      _habitTab = 'pool';
      await refresh(); showToast('✅ 习惯已创建，在习惯池中');
    } catch(err) { showToast('❌ 创建失败: ' + err.message); console.error(err); }
  };
  window.closeHabitEntryM = () => { overlay.remove(); delete window.confirmHabitEntryM; delete window.closeHabitEntryM; _impPickerCallback = null; };
  overlay.addEventListener('click', e => { if (e.target === overlay) window.closeHabitEntryM(); });
}

function showAddHabitForLiberation(liberationId) {
  const le = appData.liberationEntries.find(x => x.id === liberationId); if (!le) return;
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
  let _imp = 0;
  overlay.innerHTML = `<div class="modal-box"><h3>🔥 创建习惯</h3>
    <p style="font-size:11px;color:var(--text-tertiary);margin-bottom:8px">关联到解放脑记录「${esc(le.text.slice(0, 15))}」</p>
    <textarea id="mText" rows="2" placeholder="描述要养成的习惯..." style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical"></textarea>
    ${renderImpPicker(0, l => { _imp = l; })}
    <textarea id="mNote" placeholder="💬 备注（选填）" rows="2" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical"></textarea>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeHabitLibM()">取消</button>
    <button class="btn-primary" onclick="confirmHabitLibM('${liberationId}')">创建</button></div></div>`;
  document.body.appendChild(overlay); overlay.querySelector('#mText').focus();
  window.confirmHabitLibM = async (libId) => {
    const txt = overlay.querySelector('#mText').value.trim(); if (!txt) { showToast('内容不能为空'); return; }
    const note = overlay.querySelector('#mNote').value.trim();
    overlay.remove(); delete window.confirmHabitLibM; delete window.closeHabitLibM; _impPickerCallback = null;
    try {
      await Store.addHabit(txt, _imp, { type: 'liberation', liberationId: libId, note });
      _habitTab = 'pool';
      await refresh(); showToast('✅ 习惯已创建，在习惯池中');
    } catch(err) { showToast('❌ 创建失败: ' + err.message); console.error(err); }
  };
  window.closeHabitLibM = () => { overlay.remove(); delete window.confirmHabitLibM; delete window.closeHabitLibM; _impPickerCallback = null; };
  overlay.addEventListener('click', e => { if (e.target === overlay) window.closeHabitLibM(); });
}

// ==================== 专项详情 ====================

function openProject(capId, projId) {
  currentCapId=capId; currentProjId=projId; currentProjTab='action'; projSelectedEntryId=null; switchPage('project');
}

function getProj() {
  return appData.capabilities.find(c=>c.id===currentCapId)?.projects.find(p=>p.id===currentProjId)||null;
}

function renderProject() {
  const cap=appData.capabilities.find(c=>c.id===currentCapId); if(!cap){switchPage('ability');return;}
  const proj=cap.projects.find(p=>p.id===currentProjId); if(!proj){switchPage('ability');return;}
  const n=nc();
  document.getElementById('projectTitle').textContent = cap.name+' · '+proj.name;

  // 合并行为列表: action + learning
  const allTracks = sortByImpThenTime([...(proj.entries.action||[]), ...(proj.entries.learning||[])]);
  const problems = sortByImpThenTime(proj.entries.problem||[]);
  const insights = sortByImpThenTime(proj.entries.review||[]);
  const relations = proj.relations||[];

  // 统计该项目的待办数
  const projTodos = appData.todos.filter(t => t.sourceCapId===cap.id && t.sourceProjId===proj.id);
  const activeTodos = projTodos.filter(t => t.status==='active');

  // ── 统计条 ──
  document.getElementById('projectStats').innerHTML = `
    <div class="ps"><b>${allTracks.length}</b> ${n.action}</div>
    <span class="ps-dot"></span>
    <div class="ps"><b>${problems.length}</b> ${n.problem}</div>
    <span class="ps-dot"></span>
    <div class="ps"><b>${insights.length}</b> ${n.insight||'收获'}</div>
    <span class="ps-dot"></span>
    <div class="ps"><b>${activeTodos.length}</b> 进行中</div>`;

  // ── 行为区 ──
  let tracksHtml = '';
  if (!allTracks.length) {
    tracksHtml = `<div class="proj-empty">暂无${n.action}记录<button class="proj-empty-btn" onclick="showAddEntryInProj('action')">+ 添加${n.action}</button></div>`;
  } else {
    allTracks.forEach(e => {
      const eType = (proj.entries.action||[]).find(x=>x.id===e.id) ? 'action' : 'learning';
      const eStatus = e.status||'active';
      const eIsDone = eStatus==='completed'||eStatus==='resolved';
      // 查找该条目的待办
      const entryTodos = projTodos.filter(t => t.sourceEntryId===e.id);
      const doneTodos = entryTodos.filter(t => t.status==='completed').length;
      const totalTodos = entryTodos.length;
      const todoText = totalTodos > 0 ? (doneTodos===totalTodos ? '已完成' : (totalTodos-doneTodos)+' 进行中') : '';
      // 查找思绪
      const linkedThoughts = findLinkedThoughts({ capId:currentCapId, projId:currentProjId, entryType:eType, entryId:e.id });
      const thoughtCount = linkedThoughts.length;
      // 查找关联中是否有衍生关系（问题→衍生行为 或 行为→衍生行为）
      const deriveRel = relations.find(r => r.type==='derive' && r.toId===e.id);
      const deriveSourceId = deriveRel ? deriveRel.fromId : null;
      let deriveSource = null;
      let deriveSourceLabel = '';
      if (deriveSourceId) {
        // 先查问题列表
        deriveSource = (proj.entries.problem||[]).find(x=>x.id===deriveSourceId);
        if (deriveSource) {
          deriveSourceLabel = '衍生于问题：';
        } else {
          // 再查行为列表
          deriveSource = [...(proj.entries.action||[]), ...(proj.entries.learning||[])].find(x=>x.id===deriveSourceId);
          if (deriveSource) {
            deriveSourceLabel = '衍生于行为：';
          }
        }
      }
      const subText = deriveSource ? `${deriveSourceLabel}${deriveSource.text} · ${todoText}` : todoText;
      const dotClass = deriveSource ? 'derived' : 'track';
      const isSel = projSelectedEntryId === e.id ? ' sel' : '';
      // 徽章
      let badges = '';
      if (totalTodos > 0) {
        const allDone = doneTodos === totalTodos;
        badges += `<span class="proj-meta proj-meta-todo ${allDone?'done':''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> ${doneTodos}/${totalTodos}</span>`;
      }
      if (thoughtCount > 0) badges += `<span class="proj-meta">💭 ${thoughtCount}</span>`;
      // 查找关联习惯
      const entryHabits = findHabitsByEntry(currentCapId, currentProjId, e.id, eType);
      if (entryHabits.length > 0) badges += `<span class="proj-meta">🔥 ${entryHabits.length}</span>`;

      // 权重和备注
      const impHtml = e.importance ? impStars(e.importance) : '';
      const notePreview = e.note ? `<span class="proj-note-hint">💬 ${esc(e.note.slice(0,20))}${e.note.length>20?'…':''}</span>` : '';
      const subParts = [subText, impHtml, notePreview].filter(Boolean).join(' · ');

      tracksHtml += `<div class="proj-li${isSel}" onclick="toggleProjEntry('${e.id}','${eType}')">
        <div class="proj-dot ${dotClass}"></div>
        <div class="proj-li-body">
          <div class="proj-li-name" style="${eIsDone?'opacity:.5;text-decoration:line-through':''}">${esc(e.text)}</div>
          <div class="proj-li-sub">${subParts}</div>
        </div>
        ${badges}
        <button class="icon-btn" onclick="event.stopPropagation();toggleEntryStatus('${currentCapId}','${currentProjId}','${eType}','${e.id}')" title="${eIsDone?'恢复':'完成'}" style="font-size:12px;margin-left:4px">${eIsDone?'🔄':'✅'}</button>
      </div>`;

      // 关系图面板
      const gpOpen = projSelectedEntryId === e.id ? ' open' : '';
      tracksHtml += `<div class="proj-gp${gpOpen}">${buildGraphPanel(e, eType, proj, relations)}</div>`;
    });
  }

  // ── 问题区 ──
  let issuesHtml = '';
  if (!problems.length) {
    issuesHtml = `<div class="proj-empty">暂无${n.problem}记录<button class="proj-empty-btn" onclick="showAddEntryInProj('problem')">+ 记录${n.problem}</button></div>`;
  } else {
    problems.forEach(e => {
      const eStatus = e.status||'active';
      const eIsDone = eStatus==='resolved';
      const linkedThoughts = findLinkedThoughts({ capId:currentCapId, projId:currentProjId, entryType:'problem', entryId:e.id });
      // 查找关联的行为（discover: 该问题由哪个行为发现; derive: 该问题衍生出了哪个行为）
      const linkedActions = relations.filter(r =>
        (r.type==='discover' && r.toId===e.id) || (r.type==='derive' && r.fromId===e.id)
      ).map(r => {
        const actId = r.type==='discover' ? r.fromId : r.toId;
        const act = [...(proj.entries.action||[]), ...(proj.entries.learning||[])].find(x=>x.id===actId);
        return act ? { text: act.text, type: r.type } : null;
      }).filter(Boolean);
      let badges = '';
      if (linkedThoughts.length) badges += `<span class="proj-meta">💭 ${linkedThoughts.length}</span>`;

      const impHtml2 = e.importance ? impStars(e.importance) : '';
      const noteP2 = e.note ? `<span class="proj-note-hint">💬 ${esc(e.note.slice(0,20))}${e.note.length>20?'…':''}</span>` : '';
      const extraInfo2 = [eIsDone?'已解决':'未解决', impHtml2, noteP2].filter(Boolean).join(' · ');

      issuesHtml += `<div class="proj-ii">
        <div class="proj-idot ${eIsDone?'issue-ok':'issue'}">
          ${eIsDone?'<svg class="proj-issue-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>':''}
        </div>
        <div style="flex:1" onclick="editProjEntryById('${e.id}')">
          <div class="proj-iname" style="${eIsDone?'opacity:.5;text-decoration:line-through':''}">${esc(e.text)}</div>
          ${extraInfo2?`<div class="proj-li-sub" style="margin-top:2px">${extraInfo2}</div>`:''}
          ${linkedActions.length?`<div class="proj-thought-line">🏃 关联${n.action}：${linkedActions.slice(0,2).map(a=>esc(a.text.slice(0,20))+(a.type==='derive'?'（衍生）':'')).join('、')}${linkedActions.length>2?' 等'+linkedActions.length+'条':''}</div>`:''}
        </div>
        ${badges}
        <button class="icon-btn" onclick="event.stopPropagation();toggleEntryStatus('${currentCapId}','${currentProjId}','problem','${e.id}')" title="${eIsDone?'恢复':'解决'}" style="font-size:12px">${eIsDone?'🔄':'✔️'}</button>
        <button class="icon-btn" onclick="event.stopPropagation();projDeleteEntry('${e.id}','problem')" title="删除" style="font-size:12px">🗑️</button>
      </div>`;
    });
  }

  // ── 收获区 ──
  const insightLabel = n.insight || '收获';
  let insightsHtml = '';
  if (!insights.length) {
    insightsHtml = `<div class="proj-empty">暂无${insightLabel}记录<button class="proj-empty-btn" onclick="showAddEntryInProj('review')">+ 记录${insightLabel}</button></div>`;
  } else {
    insights.forEach(e => {
      const linkedThoughts = findLinkedThoughts({ capId:currentCapId, projId:currentProjId, entryType:'review', entryId:e.id });
      // 查找关联的行为（harvest: 该收获来自哪个行为）
      const linkedActions = relations.filter(r => r.type==='harvest' && r.toId===e.id).map(r => {
        const act = [...(proj.entries.action||[]), ...(proj.entries.learning||[])].find(x=>x.id===r.fromId);
        return act ? act.text : null;
      }).filter(Boolean);
      const _noteP = e.note ? `<span class="proj-note-hint">💬 ${esc(e.note.slice(0,20))}${e.note.length>20?'…':''}</span>` : '';
      const syncMark = e.syncThoughtId ? ' <span style="font-size:10px;color:#D4A017;opacity:.7">💭已同步</span>' : '';
      let badges = '';
      if (linkedThoughts.length) badges += `<span class="proj-meta">💭 ${linkedThoughts.length}</span>`;
      if (e.syncThoughtId) badges += `<span class="proj-meta" style="color:#D4A017">🔄</span>`;

      insightsHtml += `<div class="proj-ii">
        <div class="proj-idot insight"></div>
        <div style="flex:1" onclick="editProjEntryById('${e.id}')">
          <div class="proj-iname">${esc(e.text)}${impStars(e.importance)}${syncMark}</div>
          ${_noteP?`<div class="proj-li-sub" style="margin-top:2px">${_noteP}</div>`:''}
          ${linkedActions.length?`<div class="proj-thought-line">🏃 关联${n.action}：${linkedActions.slice(0,2).map(a=>esc(a.slice(0,20))).join('、')}${linkedActions.length>2?' 等'+linkedActions.length+'条':''}</div>`:''}
        </div>
        ${badges}
        <button class="icon-btn" onclick="event.stopPropagation();editProjEntryById('${e.id}')" title="编辑" style="font-size:12px">✏️</button>
        <button class="icon-btn" onclick="event.stopPropagation();projDeleteEntry('${e.id}','review')" title="删除" style="font-size:12px">🗑️</button>
      </div>`;
    });
  }

  // ── 组装页面 ──
  const content = document.getElementById('projectContent');
  content.innerHTML = `
    <div class="proj-sec">
      <span class="proj-sec-icon track"><svg viewBox="0 0 24 24" fill="none" stroke="#5a7d6b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></span>
      <span class="proj-sec-title">${n.action}</span>
      <span class="proj-sec-line"></span>
    </div>
    <div class="proj-sec-content tracks">${tracksHtml}</div>
    <div class="proj-sep"><span class="proj-sep-dot"></span><div class="proj-sep-line"></div><span class="proj-sep-dot"></span></div>
    <div class="proj-sec" onclick="toggleProjSection('issues')" style="cursor:pointer">
      <span class="proj-sec-icon issue"><svg viewBox="0 0 24 24" fill="none" stroke="#D85A30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
      <span class="proj-sec-title">${n.problem}${problems.length?` (${problems.length})`:''}</span>
      <span class="proj-sec-line"></span>
      <svg id="projSecArrow_issues" class="proj-sec-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </div>
    <div id="projSecContent_issues" class="proj-sec-content issues">${issuesHtml}</div>
    <div class="proj-sep"><span class="proj-sep-dot"></span><div class="proj-sep-line"></div><span class="proj-sep-dot"></span></div>
    <div class="proj-sec" onclick="toggleProjSection('insights')" style="cursor:pointer">
      <span class="proj-sec-icon insight"><svg viewBox="0 0 24 24" fill="none" stroke="#D4A017" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg></span>
      <span class="proj-sec-title">${insightLabel}${insights.length?` (${insights.length})`:''}</span>
      <span class="proj-sec-line"></span>
      <svg id="projSecArrow_insights" class="proj-sec-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </div>
    <div id="projSecContent_insights" class="proj-sec-content insights">${insightsHtml}</div>`;

  // ── 浮动按钮 ──
  document.getElementById('projectFab').innerHTML = `
    <button class="proj-fab pri" onclick="showAddEntryInProj('action')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> ${n.action}
    </button>
    <button class="proj-fab gho" onclick="showAddEntryInProj('problem')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> ${n.problem}
    </button>
    <button class="proj-fab thi" onclick="showAddEntryInProj('review')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> ${insightLabel}
    </button>`;
}

// 展开/折叠行为条目的关系图
function toggleProjEntry(entryId, entryType) {
  if (projSelectedEntryId === entryId) {
    projSelectedEntryId = null;
  } else {
    projSelectedEntryId = entryId;
  }
  renderProject();
}

// ── 查找条目所在的类型 ──
function findEntryInProj(entryId) {
  const proj = getProj(); if (!proj) return null;
  for (const type of ['action','problem','learning','review']) {
    const e = (proj.entries[type]||[]).find(x => x.id === entryId);
    if (e) return { entry: e, type };
  }
  return null;
}

// ── 编辑条目（通过ID查找类型）──
function editProjEntryById(eid) {
  const found = findEntryInProj(eid);
  if (!found) return;
  currentProjTab = found.type; // 临时设置用于editProjEntry
  editProjEntry(eid);
}

// ── 关系图面板 ──
function buildGraphPanel(entry, entryType, proj, relations) {
  const entryRelations = relations.filter(r => r.fromId===entry.id || r.toId===entry.id);
  let h = '<div class="proj-gp-inner">';

  // 待办列表（简洁展示，无进度条）
  const projTodos = appData.todos.filter(t => t.sourceCapId===currentCapId && t.sourceProjId===currentProjId && t.sourceEntryId===entry.id);
  if (projTodos.length > 0) {
    h += `<div style="margin-top:10px;padding-top:8px;border-top:.5px dashed var(--pj-border)">
      <div style="font-size:12px;color:#666;font-weight:500;margin-bottom:6px">📋 关联待办</div>
      ${projTodos.map(t => `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;color:#555">
        <span style="font-size:11px">${t.status==='completed'?'✅':'⬜'}</span>
        <span style="${t.status==='completed'?'text-decoration:line-through;color:#999':''}">${esc(t.text.slice(0,40))}</span>
      </div>`).join('')}
    </div>`;
  }

  // 习惯列表
  const entryHabits = findHabitsByEntry(currentCapId, currentProjId, entry.id, entryType);
  if (entryHabits.length > 0) {
    h += `<div style="margin-top:10px;padding-top:8px;border-top:.5px dashed var(--pj-border)">
      <div style="font-size:12px;color:#666;font-weight:500;margin-bottom:6px">🔥 关联习惯</div>
      ${entryHabits.map(hab => {
        const done = isHabitDoneToday(hab, today());
        const streak = hab.currentStreak || 0;
        return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;color:#555">
          <span style="font-size:11px">${done?'✅':'⬜'}</span>
          <span style="${done?'text-decoration:line-through;color:#999':''}">${esc(hab.text.slice(0,40))}</span>
          ${streak>0?`<span style="font-size:10px;color:#D85A30">🔥 ${streak}天</span>`:''}
        </div>`;
      }).join('')}
    </div>`;
  }

  // 关系图
  if (!entryRelations.length) {
    h += '<div style="font-size:12px;color:var(--pj-muted);text-align:center;padding:16px 0">暂无关联 — 可编辑条目添加关联</div>';
  } else {
    const graphData = buildGraphData(entry, proj, relations);
    const gid = 'graph_' + entry.id;
    h += `<div class="proj-graph-wrap" id="${gid}"
      ontouchstart="gTouchStart(event,'${gid}')" ontouchmove="gTouchMove(event,'${gid}')" ontouchend="gTouchEnd(event,'${gid}')"
      onmousedown="gMouseDown(event,'${gid}')">`;
    h += renderProjSVG(graphData);
    h += '</div>';
  }

  // 操作按钮
  h += `<div style="display:flex;gap:6px;margin-top:10px;justify-content:center;flex-wrap:wrap">
    <button class="proj-fab gho" style="flex:none;padding:6px 12px;font-size:11px" onclick="event.stopPropagation();editProjEntryById('${entry.id}')">✏️ 编辑</button>
    <button class="proj-fab gho" style="flex:none;padding:6px 12px;font-size:11px" onclick="event.stopPropagation();showAddTodoForEntry('${entry.id}','${entryType}')">📋 待办</button>
    <button class="proj-fab gho" style="flex:none;padding:6px 12px;font-size:11px" onclick="event.stopPropagation();showAddHabitForEntry('${entry.id}','${entryType}')">🔥 习惯</button>
    <button class="proj-fab gho" style="flex:none;padding:6px 12px;font-size:11px;color:#D85A30" onclick="event.stopPropagation();showAddProblemFromEntry('${entry.id}')">⚠️ 问题</button>
    <button class="proj-fab gho" style="flex:none;padding:6px 12px;font-size:11px" onclick="event.stopPropagation();showAddRelationModal('${entry.id}')">🔗 关联</button>
    <button class="proj-fab gho" style="flex:none;padding:6px 12px;font-size:11px;color:#D85A30" onclick="event.stopPropagation();projDeleteEntry('${entry.id}','${entryType}')">🗑️ 删除</button>
  </div>`;

  h += '</div>';
  return h;
}

// ── 构建关系图数据 ──
function buildGraphData(entry, proj, relations) {
  const entryRels = relations.filter(r => r.fromId===entry.id || r.toId===entry.id);
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();

  // 中心节点（固定最大尺寸，不随权重变化）
  nodes.push({ x:180, y:110, label: entry.text.slice(0,8), type:'center', fullId:entry.id, w: 1 });
  nodeIds.add(entry.id);

  entryRels.forEach(rel => {
    const isFromMe = rel.fromId === entry.id;
    const targetId = isFromMe ? rel.toId : rel.fromId;
    if (nodeIds.has(targetId)) return;
    const target = findEntryInProj(targetId);
    if (!target) return;

    const nodeType = target.type === 'problem' ? 'issue' : target.type === 'review' ? 'insight' : (target.type === 'action' || target.type === 'learning') ? 'track' : 'ctx';
    const w = 0.5 + (target.entry.importance||0)*0.5;

    // 确定是否是衍生行为
    const isDeriveTarget = rel.type === 'derive' && !isFromMe;

    nodes.push({ x: 0, y: 0, label: target.entry.text.slice(0,8), type: isDeriveTarget ? 'derived' : nodeType, fullId: targetId, w, ok: target.entry.status==='resolved' });
    nodeIds.add(targetId);

    // 边
    const edgeType = rel.type;
    const edgeLabels = { discover:'发现问题', derive:'衍生行为', harvest:'关联收获' };
    const edgeLabelsReverse = { discover:'发现问题', derive:'源头行为', harvest:'关联收获' };
    const edgeColors = { discover:'#D85A30', derive:'#7F77DD', harvest:'#D4A017' };
    const isDash = edgeType === 'derive';

    if (isFromMe) {
      edges.push({ a:0, b:nodes.length-1, l:edgeLabels[edgeType], c:edgeColors[edgeType], dash:isDash });
    } else {
      // 反向边
      edges.push({ a:nodes.length-1, b:0, l:edgeLabelsReverse[edgeType], c:edgeColors[edgeType], dash:isDash });
    }
  });

  // 布局：围绕中心节点分布
  if (nodes.length > 1) {
    const cx=180, cy=110, rx=140, ry=85;
    for (let i=1; i<nodes.length; i++) {
      const angle = (2*Math.PI*(i-1))/(nodes.length-1) - Math.PI/2;
      nodes[i].x = cx + rx * Math.cos(angle);
      nodes[i].y = cy + ry * Math.sin(angle);
    }
  }

  return { nodes, edges };
}

// ── 渲染SVG关系图 ──
function renderProjSVG(g) {
  const W=380, H=260;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  // 装饰环
  s += `<circle cx="${W/2}" cy="${H/2}" r="95" fill="none" stroke="rgba(0,0,0,.018)" stroke-width="1" stroke-dasharray="4 4"/>`;

  // 边（细线、无箭头，标签可点击）
  g.edges.forEach((e,ei) => {
    const f=g.nodes[e.a], t=g.nodes[e.b];
    const dash = e.dash ? ' stroke-dasharray="4 3"' : '';
    const mx=(f.x+t.x)/2, my=(f.y+t.y)/2;
    const dx=t.x-f.x, dy=t.y-f.y;
    const cx2=mx-dy*0.12, cy2=my+dx*0.12;
    s += `<path d="M${f.x},${f.y} Q${cx2},${cy2} ${t.x},${t.y}" stroke="${e.c}" stroke-width="1"${dash} opacity="0.3" fill="none"/>`;
    if(e.l){
      const lw=e.l.length*8+14;
      const targetNode = g.nodes[e.a===0?e.b:e.a]; // 点击标签跳到非中心节点
      s+=`<rect x="${cx2-lw/2}" y="${cy2-8}" width="${lw}" height="16" rx="8" fill="white" opacity="0.95" style="cursor:pointer" onclick="editProjEntryById('${targetNode.fullId}')"/>`;
      s+=`<text x="${cx2}" y="${cy2+1}" text-anchor="middle" dominant-baseline="central" fill="${e.c}" font-size="8" font-weight="500" style="cursor:pointer;pointer-events:none">${e.l}</text>`;
    }
  });

  // 节点
  g.nodes.forEach(n => {
    const isC = n.type==='center';
    const wMul = 0.7 + (n.w||0.5)*0.6;
    const nodeOp = 0.55 + (n.w||0.5)*0.45;
    let fill, glow;
    switch(n.type){
      case 'center': fill='#5a7d6b'; glow='rgba(90,125,107,.14)'; break;
      case 'issue': fill='#D85A30'; glow='rgba(216,90,48,.12)'; break;
      case 'derived': fill='#7F77DD'; glow='rgba(127,119,221,.12)'; break;
      case 'insight': fill='#D4A017'; glow='rgba(212,160,23,.12)'; break;
      case 'track': fill='#4A90B8'; glow='rgba(74,144,184,.10)'; break;
      default: fill='#aaa'; glow='rgba(170,170,170,.06)';
    }
    if(isC){
      const lbl=n.label.length>10?n.label.slice(0,10)+'…':n.label;
      const baseR=lbl.length>5?28:24, r=Math.round(baseR*wMul), fs=lbl.length>5?9:11;
      s+=`<circle cx="${n.x}" cy="${n.y}" r="${r+8}" fill="${glow}"/>`;
      s+=`<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${fill}" opacity="${nodeOp}" onclick="editProjEntryById('${n.fullId}')"/>`;
      s+=`<text x="${n.x}" y="${n.y}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="${fs}" font-weight="600" style="pointer-events:none">${lbl}</text>`;
    } else {
      const rawLbl=n.label.length>8?n.label.slice(0,8)+'…':n.label;
      const lbl=n.type==='derived'?'衍·'+rawLbl:rawLbl;
      const baseR=9, r=Math.round(baseR*wMul);
      s+=`<circle cx="${n.x}" cy="${n.y}" r="${r+5}" fill="${glow}"/>`;
      if(n.type==='derived'){
        s+=`<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="none" stroke="${fill}" stroke-width="1.5" opacity="${nodeOp}" onclick="editProjEntryById('${n.fullId}')"/>`;
        s+=`<circle cx="${n.x}" cy="${n.y}" r="2.5" fill="${fill}" opacity="${nodeOp*0.5}" style="pointer-events:none"/>`;
      } else {
        s+=`<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${fill}" opacity="${nodeOp}" onclick="editProjEntryById('${n.fullId}')"/>`;
      }
      if(n.type==='issue'&&n.ok){
        s+=`<path d="M${n.x-3},${n.y} L${n.x-1},${n.y+2.5} L${n.x+3.5},${n.y-2.5}" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.9" style="pointer-events:none"/>`;
      }
      let ly=n.y;
      if(n.type==='issue'||n.type==='track'||n.type==='ctx') ly=n.y-16;
      else if(n.type==='insight'||n.type==='derived') ly=n.y+18;
      // 文字用pill背景
      const tw=lbl.length*9+8;
      s+=`<rect x="${n.x-tw/2}" y="${ly-7}" width="${tw}" height="14" rx="7" fill="white" opacity="0.88" style="pointer-events:none"/>`;
      s+=`<text x="${n.x}" y="${ly}" text-anchor="middle" dominant-baseline="central" fill="#2c2c2c" font-size="10" font-weight="500" style="pointer-events:none">${lbl}</text>`;
    }
  });
  s += '</svg>';
  return s;
}

// ── SVG 拖动交互（touch + mouse） ──
const _graphDrag = {};
function gTouchStart(e, gid) {
  if (e.touches.length===1) { _graphDrag[gid]={sx:e.touches[0].clientX,sy:e.touches[0].clientY,ox:0,oy:0,drag:false}; }
}
function gTouchMove(e, gid) {
  const d=_graphDrag[gid]; if(!d||e.touches.length!==1) return; e.preventDefault();
  const dx=e.touches[0].clientX-d.sx, dy=e.touches[0].clientY-d.sy;
  if(!d.drag&&(Math.abs(dx)>5||Math.abs(dy)>5)) d.drag=true;
  if(d.drag){ d.ox+=dx; d.oy+=dy; d.sx=e.touches[0].clientX; d.sy=e.touches[0].clientY;
    const wrap=document.getElementById(gid); if(wrap){const svg=wrap.querySelector('svg');if(svg){svg.style.transform=`translate(${d.ox}px,${d.oy}px)`;svg.style.transition='none';}}
  }
}
function gTouchEnd(e, gid) {
  const d=_graphDrag[gid];
  if(d&&!d.drag){const wrap=document.getElementById(gid);if(wrap){const svg=wrap.querySelector('svg');if(svg){svg.style.transition='transform .3s ease';svg.style.transform='translate(0,0)';}}}
  _graphDrag[gid]={sx:0,sy:0,ox:0,oy:0,drag:false};
}
function gMouseDown(e, gid) {
  if(e.button!==0) return;
  _graphDrag[gid]={sx:e.clientX,sy:e.clientY,ox:0,oy:0,drag:false};
  const onUp=ev=>{
    document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);
    const d=_graphDrag[gid];
    if(d&&!d.drag){const wrap=document.getElementById(gid);if(wrap){const svg=wrap.querySelector('svg');if(svg){svg.style.transition='transform .3s ease';svg.style.transform='translate(0,0)';}}}
    _graphDrag[gid]={sx:0,sy:0,ox:0,oy:0,drag:false};
  };
  const onMove=ev=>{
    const d=_graphDrag[gid]; if(!d) return;
    const dx=ev.clientX-d.sx, dy=ev.clientY-d.sy;
    if(!d.drag&&(Math.abs(dx)>3||Math.abs(dy)>3)) d.drag=true;
    if(d.drag){d.ox+=dx;d.oy+=dy;d.sx=ev.clientX;d.sy=ev.clientY;
      const wrap=document.getElementById(gid);if(wrap){const svg=wrap.querySelector('svg');if(svg){svg.style.transform=`translate(${d.ox}px,${d.oy}px)`;svg.style.transition='none';}}
    }
  };
  document.addEventListener('mousemove',onMove);
  document.addEventListener('mouseup',onUp);
}

// ── 项目页删除条目（通过ID查找类型）──
function projDeleteEntry(eid, hintType) {
  const found = findEntryInProj(eid);
  const type = found ? found.type : (hintType || 'action');
  deleteItem('entry', currentCapId, currentProjId, type, eid);
}

// ── 待办折叠切换 ──
function projTfToggle(labelEl) {
  const arrow=labelEl.querySelector('svg');
  const list=labelEl.parentElement.querySelector('.proj-tf-list');
  arrow.classList.toggle('open');
  list.classList.toggle('open');
}

// ── 关联弹窗类型筛选 ──
function filterRelTargets() {
  const typeMap = { discover:'problem', harvest:'review', derive:'action' };
  const sel = document.querySelector('#relTypeSelect');
  if (!sel) return;
  const targetType = typeMap[sel.value] || 'problem';
  document.querySelectorAll('.rel-sec').forEach(sec => {
    sec.style.display = sec.dataset.secType === targetType ? '' : 'none';
  });
}

// ── 关联录入弹窗（多选 + 管理已有关联） ──
function showAddRelationModal(fromEntryId) {
  const proj=getProj(); if(!proj) return;
  const n=nc();
  const fromInfo = findEntryInProj(fromEntryId);
  if(!fromInfo) return;
  const relations = proj.relations||[];
  const existingRels = relations.filter(r => r.fromId===fromEntryId || r.toId===fromEntryId);
  const relLabels = {discover:'发现问题',derive:'衍生行为',harvest:'关联收获'};

  const overlay=document.createElement('div'); overlay.className='modal-overlay';
  let html = `<div class="modal-box" style="max-height:85vh;display:flex;flex-direction:column">
    <h3>🔗 关联管理（「${esc(fromInfo.entry.text.slice(0,15))}」）</h3>
    <div style="flex:1;overflow-y:auto;min-height:0;margin-bottom:10px">`;

  // 已有关联列表
  if (existingRels.length) {
    html += `<div style="margin-bottom:10px;padding:8px;background:#f8f6f3;border-radius:8px">
      <div style="font-size:11px;color:#888;margin-bottom:6px;font-weight:600">已有关联 (${existingRels.length})</div>`;
    existingRels.forEach(r => {
      const targetId = r.fromId===fromEntryId ? r.toId : r.fromId;
      const targetInfo = findEntryInProj(targetId);
      const targetText = targetInfo ? targetInfo.entry.text.slice(0,20) : '已删除';
      const isFrom = r.fromId===fromEntryId;
      const dirIcon = isFrom ? '→' : '←';
      html += `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px">
        <span style="color:#888">${dirIcon}</span>
        <span style="flex:1">${relLabels[r.type]||r.type}：${esc(targetText)}</span>
        <button style="background:none;border:none;color:#D85A30;font-size:12px;cursor:pointer;padding:2px 6px" onclick="deleteRelFromModal('${r.id}','${fromEntryId}')">✕</button>
      </div>`;
    });
    html += `</div>`;
  }

  html += `<div style="margin-bottom:10px">
      <label style="font-size:12px;color:#888;display:block;margin-bottom:6px">添加新关联 — 类型</label>
      <select id="relTypeSelect" onchange="filterRelTargets()" style="width:100%;padding:8px;border:1px solid #e0d8d0;border-radius:8px;font-size:13px;outline:none;background:#fff">
        <option value="discover">发现问题（关联到问题条目）</option>
        <option value="harvest">关联收获（关联到收获条目）</option>
        <option value="derive">衍生行为（关联到行为条目）</option>
      </select>
    </div>
    <div style="margin-bottom:10px">
      <label style="font-size:12px;color:#888;display:block;margin-bottom:6px">目标条目（可多选）</label>
      <div id="relTargetList" style="max-height:250px;overflow-y:auto;border:1px solid #e0d8d0;border-radius:8px;padding:4px">`;

  // 预渲染所有分组（初始只显示discover对应的）
  const sections = [
    { type:'problem', label:n.problem, items: proj.entries.problem||[] },
    { type:'action', label:n.action, items: [...(proj.entries.action||[]),...(proj.entries.learning||[])] },
    { type:'review', label:n.review||'收获', items: proj.entries.review||[] }
  ];
  sections.forEach(sec => {
    if(!sec.items.length) return;
    const typeIcons = {problem:'⚠️',action:'🏃',review:'⭐'};
    html += `<div class="rel-sec" data-sec-type="${sec.type}" style="display:none">
      <div style="font-size:11px;color:#999;padding:6px 4px 3px;font-weight:600">${typeIcons[sec.type]||'📝'} ${sec.label}</div>`;
    sec.items.forEach(item => {
      const disabled = item.id === fromEntryId ? 'opacity:.4;pointer-events:none' : '';
      const alreadyLinked = existingRels.some(r => (r.fromId===fromEntryId&&r.toId===item.id)||(r.toId===fromEntryId&&r.fromId===item.id));
      html += `<label style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;font-size:12px;cursor:pointer;border:1px solid #e0d8d0;margin-bottom:3px;${disabled}${alreadyLinked?'opacity:.5':''}" data-eid="${item.id}">
        <input type="checkbox" name="relTarget" value="${item.id}" ${alreadyLinked?'disabled':''} style="accent-color:#5a7d6b">
        <span>${esc(item.text.slice(0,30))}${alreadyLinked?' ✓':''}</span></label>`;
    });
    html += `</div>`;
  });

  html += `</div></div>
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      <button class="btn-primary" onclick="confirmAddRelation('${fromEntryId}')">添加选中</button>
    </div>
  </div>`;

  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  filterRelTargets(); // 初始按默认类型筛选
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
}

async function deleteRelFromModal(relId, fromEntryId) {
  await Store.deleteRelation(currentCapId, currentProjId, relId);
  // 重新渲染弹窗
  const overlay = document.querySelector('.modal-overlay');
  if(overlay) overlay.remove();
  showAddRelationModal(fromEntryId);
  await refresh();
  showToast('关联已删除');
}

async function confirmAddRelation(fromEntryId) {
  const typeEl = document.querySelector('#relTypeSelect');
  const targets = document.querySelectorAll('input[name="relTarget"]:checked');
  if(!targets.length){showToast('请选择目标条目');return;}
  const relType = typeEl.value;
  let added = 0;
  for (const t of targets) {
    const toEntryId = t.value;
    const result = await Store.addRelation(currentCapId, currentProjId, fromEntryId, toEntryId, relType);
    if (result) added++;
  }
  // 重新渲染弹窗（不关闭）
  const overlay = document.querySelector('.modal-overlay');
  if(overlay) overlay.remove();
  showAddRelationModal(fromEntryId);
  await refresh();
  if(added>0) showToast(`✅ 已添加${added}条关联`);
  else showToast('所选关联已存在');
}

// ── 行动卡片中创建待办 ──
function showAddTodoForEntry(entryId, entryType) {
  const proj=getProj();if(!proj)return;
  const e=findEntryInProj(entryId);if(!e)return;
  const overlay=document.createElement('div');overlay.className='modal-overlay';
  let _imp=0;
  overlay.innerHTML=`<div class="modal-box"><h3>📋 创建待办</h3>
    <p style="font-size:11px;color:#999;margin-bottom:8px">将关联到「${esc(e.entry.text.slice(0,15))}」</p>
    <textarea id="mText" rows="2" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical"></textarea>
    ${renderImpPicker(0,l=>{_imp=l;})}
    <textarea id="mNote" placeholder="💬 备注（选填）" rows="2" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical"></textarea>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeTodoEntryM()">取消</button>
    <button class="btn-primary" onclick="confirmTodoEntryM('${entryId}','${entryType}')">创建</button></div></div>`;
  document.body.appendChild(overlay);overlay.querySelector('#mText').focus();
  window.confirmTodoEntryM=async(eid,eType)=>{
    const txt=overlay.querySelector('#mText').value.trim();if(!txt){showToast('内容不能为空');return;}
    const note=overlay.querySelector('#mNote').value.trim();
    overlay.remove();delete window.confirmTodoEntryM;delete window.closeTodoEntryM;
    await Store.addTodo(txt,_imp,{capId:currentCapId,projId:currentProjId,entryType:eType,entryId:eid},note);
    await refresh();showToast('✅ 待办已创建');
  };
  window.closeTodoEntryM=()=>{overlay.remove();delete window.confirmTodoEntryM;delete window.closeTodoEntryM;};
  overlay.addEventListener('click',e=>{if(e.target===overlay)window.closeTodoEntryM();});
}

// ── 行动卡片中录入问题 ──
function showAddProblemFromEntry(entryId) {
  const proj=getProj();if(!proj)return;
  const e=findEntryInProj(entryId);if(!e)return;
  const overlay=document.createElement('div');overlay.className='modal-overlay';
  let _imp=0;
  overlay.innerHTML=`<div class="modal-box"><h3>⚠️ 录入问题</h3>
    <p style="font-size:11px;color:#999;margin-bottom:8px">从「${esc(e.entry.text.slice(0,15))}」中发现的问题，自动建立关联</p>
    <textarea id="mText" rows="2" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical"></textarea>
    ${renderImpPicker(0,l=>{_imp=l;})}
    <textarea id="mNote" placeholder="💬 备注（选填）" rows="2" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical"></textarea>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeProblemEntryM()">取消</button>
    <button class="btn-primary" onclick="confirmProblemEntryM('${entryId}')">录入</button></div></div>`;
  document.body.appendChild(overlay);overlay.querySelector('#mText').focus();
  window.confirmProblemEntryM=async(eid)=>{
    const txt=overlay.querySelector('#mText').value.trim();if(!txt){showToast('内容不能为空');return;}
    const note=overlay.querySelector('#mNote').value.trim();
    overlay.remove();delete window.confirmProblemEntryM;delete window.closeProblemEntryM;
    const newEntry = await Store.addEntry(currentCapId,currentProjId,'problem',txt,_imp,null,null,null,note);
    if(newEntry){
      await Store.addRelation(currentCapId,currentProjId,eid,newEntry.id,'discover');
    }
    await refresh();showToast('✅ 问题已录入并关联');
  };
  window.closeProblemEntryM=()=>{overlay.remove();delete window.confirmProblemEntryM;delete window.closeProblemEntryM;};
  overlay.addEventListener('click',e=>{if(e.target===overlay)window.closeProblemEntryM();});
}

// ── 问题区/收获区折叠切换 ──
function toggleProjSection(secType) {
  const el = document.getElementById('projSecContent_'+secType);
  const icon = document.getElementById('projSecArrow_'+secType);
  if(el) el.classList.toggle('collapsed');
  if(icon) icon.classList.toggle('rotated');
}

function showEntryWithProcessModal(title,defaultValue,onSave,existingImp,existingProcId,existingNote){
  const overlay=document.createElement('div');overlay.className='modal-overlay';
  let _imp=existingImp||0;
  overlay.innerHTML=`<div class="modal-box" style="max-height:80vh;overflow-y:auto"><h3>${title}</h3>
    <textarea id="mText" rows="3" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(defaultValue)}</textarea>
    ${renderImpPicker(_imp,l=>{_imp=l;})}
    <textarea id="mNote" placeholder="💬 备注（选填）" rows="2" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(existingNote||'')}</textarea>
    <div class="modal-actions"><button class="btn-cancel" onclick="closePE()">取消</button>
    <button class="btn-primary" onclick="confirmPE()">保存</button></div></div>`;
  document.body.appendChild(overlay);overlay.querySelector('#mText').focus();
  window.confirmPE=()=>{const txt=overlay.querySelector('#mText').value.trim();if(!txt){showToast('内容不能为空');return;}
    const note=overlay.querySelector('#mNote').value.trim();
    overlay.remove();delete window.confirmPE;delete window.closePE;onSave(txt,_imp,null,note);};
  window.closePE=()=>{overlay.remove();delete window.confirmPE;delete window.closePE;};
  overlay.addEventListener('click',e=>{if(e.target===overlay)window.closePE();});
}

function showEntryWithNoteModal(title,defaultValue,onSave,existingNote){
  const overlay=document.createElement('div');overlay.className='modal-overlay';
  overlay.innerHTML=`<div class="modal-box"><h3>${title}</h3>
    <textarea id="mText" rows="3" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(defaultValue)}</textarea>
    <textarea id="mNote" placeholder="💬 备注（选填）" rows="2" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(existingNote||'')}</textarea>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeNoteM()">取消</button>
    <button class="btn-primary" onclick="confirmNoteM()">保存</button></div></div>`;
  document.body.appendChild(overlay);overlay.querySelector('#mText').focus();
  window.confirmNoteM=()=>{const txt=overlay.querySelector('#mText').value.trim();if(!txt){showToast('内容不能为空');return;}
    const note=overlay.querySelector('#mNote').value.trim();
    overlay.remove();delete window.confirmNoteM;delete window.closeNoteM;onSave(txt,note);};
  window.closeNoteM=()=>{overlay.remove();delete window.confirmNoteM;delete window.closeNoteM;};
  overlay.addEventListener('click',e=>{if(e.target===overlay)window.closeNoteM();});
}

// ── 收获编辑弹窗（含归入思绪开关） ──
function showReviewEditModal(title, entry, onSave) {
  const overlay=document.createElement('div');overlay.className='modal-overlay';
  const alreadySynced = !!entry.syncThoughtId;
  const overlayId = 'reviewEditModal_' + Date.now();
  overlay.id = overlayId;
  overlay.innerHTML=`<div class="modal-box" style="max-height:80vh;overflow-y:auto"><h3>${title}</h3>
    <textarea id="mText" rows="3" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(entry.text)}</textarea>
    ${renderImpPicker(entry.importance||0,l=>{window._reviewImp=l;})}
    <textarea id="mNote" placeholder="💬 备注（选填）" rows="2" style="width:100%;border:1px solid #e0d8d0;border-radius:8px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(entry.note||'')}</textarea>
    <div style="display:flex;align-items:center;gap:8px;padding:8px;background:#f8f6f3;border-radius:8px;margin-bottom:10px">
      <input type="checkbox" id="syncToThought" ${alreadySynced?'checked':''} style="accent-color:#D4A017;width:18px;height:18px">
      <label for="syncToThought" style="font-size:13px;color:#555;cursor:pointer">💭 归入思绪${alreadySynced?'（已同步）':''}</label>
    </div>
    ${alreadySynced?`<div style="font-size:11px;color:#999;margin-bottom:10px;padding:4px 8px;background:#fff8e1;border-radius:6px">已同步为思绪，编辑后可再次勾选以更新</div>`:''}
    <div class="modal-actions"><button class="btn-cancel" onclick="closeReviewM()">取消</button>
    <button class="btn-primary" onclick="confirmReviewM()">保存</button></div></div>`;
  document.body.appendChild(overlay);overlay.querySelector('#mText').focus();
  window._reviewImp = entry.importance||0;
  window.confirmReviewM=()=>{const txt=overlay.querySelector('#mText').value.trim();if(!txt){showToast('内容不能为空');return;}
    const note=overlay.querySelector('#mNote').value.trim();
    const sync = overlay.querySelector('#syncToThought').checked;
    overlay.remove();delete window.confirmReviewM;delete window.closeReviewM;delete window._reviewImp;_impPickerCallback=null;
    onSave(txt,note,sync);};
  window.closeReviewM=()=>{overlay.remove();delete window.confirmReviewM;delete window.closeReviewM;delete window._reviewImp;_impPickerCallback=null;};
  overlay.addEventListener('click',e=>{if(e.target===overlay)window.closeReviewM();});
}

// ── 收获同步到思绪 ──
async function syncReviewToThought(reviewId, text, note) {
  const proj = getProj(); if(!proj) return;
  const entry = (proj.entries.review||[]).find(e => e.id === reviewId);
  if (!entry) return;
  if (entry.syncThoughtId) {
    // 更新已有思绪
    const thought = appData.thoughts.find(t => t.id === entry.syncThoughtId);
    if (thought) {
      await Store.updateThought(entry.syncThoughtId, text, thought.tags, entry.importance, note);
      showToast('✅ 已同步更新到思绪');
    }
  } else {
    // 创建新思绪（直接设置关联字段，不走 linkThought 避免自动创建重复收获）
    const thought = await Store.addThought(text, [], entry.importance||0, note);
    if (thought) {
      // 直接更新思绪的关联字段，而不是调用 linkThought（linkThought 会自动创建收获条目导致重复）
      const data = await Store.getAll();
      const t = data.thoughts.find(x => x.id === thought.id);
      if (t) {
        t.relatedCapId = currentCapId;
        t.relatedProjId = currentProjId;
        t.relatedEntryType = 'review';
        t.relatedEntryId = reviewId;
      }
      // 设置收获的 syncThoughtId
      const cap = data.capabilities.find(c => c.id === currentCapId);
      const p = cap?.projects.find(p => p.id === currentProjId);
      if (p) {
        const rev = (p.entries.review||[]).find(e => e.id === reviewId);
        if (rev) { rev.syncThoughtId = thought.id; }
      }
      await Store.saveAll(data);
      showToast('✅ 已归入思绪');
    }
  }
}

function showAddEntryInProj(type){
  const n=nc(); const labels={action:n.action,problem:n.problem,learning:n.learning,review:n.review||'收获'};
  if(type==='action'||type==='problem'||type==='learning'){
    showEntryWithProcessModal('添加'+(labels[type]||type),'',async(txt,imp,procId,note)=>{await Store.addEntry(currentCapId,currentProjId,type,txt,imp,null,procId,null,note);await refresh();});
  } else {
    showEntryWithNoteModal('添加'+(labels[type]||type),'',async(txt,note)=>{await Store.addEntry(currentCapId,currentProjId,type,txt,0,null,null,null,note);await refresh();});
  }
}

function editProjEntry(eid){
  const proj=getProj();if(!proj)return;
  // 先用 currentProjTab 查找，找不到则遍历全部类型
  let e = (proj.entries[currentProjTab]||[]).find(x=>x.id===eid);
  let entryType = currentProjTab;
  if(!e){
    const found = findEntryInProj(eid);
    if(found){ e=found.entry; entryType=found.type; currentProjTab=found.type; }
    else return;
  }
  const n=nc(); const labels={action:n.action,problem:n.problem,learning:n.learning,review:n.review||'收获'};
  if(entryType==='action'||entryType==='problem'||entryType==='learning'){
    showEntryWithProcessModal('修改'+(labels[entryType]||entryType),e.text,async(txt,imp,procId,note)=>{await Store.updateEntry(currentCapId,currentProjId,entryType,eid,txt,imp,procId,note);await refresh();},e.importance,e.relatedProcessId,e.note);
  } else if(entryType==='review'){
    showReviewEditModal('修改'+(labels[entryType]||entryType),e,async(txt,note,syncToThought)=>{await Store.updateEntry(currentCapId,currentProjId,entryType,eid,txt,undefined,undefined,note);if(syncToThought)await syncReviewToThought(eid,txt,note);await refresh();});
  } else {
    showEntryWithNoteModal('修改'+(labels[entryType]||entryType),e.text,async(txt,note)=>{await Store.updateEntry(currentCapId,currentProjId,entryType,eid,e.text,undefined,undefined,note);await refresh();},e.note);
  }
}

// ==================== 思绪 ====================

function renderThoughts(){
  const list=document.getElementById('thoughtList');
  const q=document.getElementById('thoughtSearch')?.value?.toLowerCase().trim()||'';
  let thoughts=appData.thoughts;
  if(q)thoughts=thoughts.filter(t=>t.text.toLowerCase().includes(q)||(t.tags||[]).some(tag=>tag.toLowerCase().includes(q)));
  thoughts=sortByImpThenTime(thoughts);
  if(!thoughts.length){list.innerHTML='<div class="empty-state">'+(q?'没有找到匹配的思绪':'暂无思绪')+'</div>';return;}
  list.innerHTML=thoughts.map(t=>{
    const linkInfo = resolveThoughtLink(t);
    const hasLink = !!linkInfo;
    // 灯泡图标（有关联） / 云朵图标（独立）
    const railIcon = hasLink
      ? `<div class="thought-rail-icon" style="background:var(--color-primary-light)">
           <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px">
             <path d="M12 2a7 7 0 017 7c0 2.5-1.3 4.7-3.3 6l-.7.5V18h-6v-2.5l-.7-.5A7 7 0 0112 2z"/>
             <path d="M9 21h6"/><path d="M10 18v1.5a2 2 0 004 0V18"/>
           </svg>
         </div>`
      : `<div class="thought-rail-icon" style="background:var(--bg-inset)">
           <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px">
             <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>
           </svg>
         </div>`;

    let linkHtml='';
    if(linkInfo) {
      const clickAction = linkInfo.type==='entry'?`openProject('${linkInfo.capId}','${linkInfo.projId}')`
        :linkInfo.type==='liberation'?`switchPage('ability');setTimeout(()=>{switchAbilityTab('liberation');},50)`
        :linkInfo.type==='project'?`openProject('${linkInfo.capId}','${linkInfo.projId}')`
        :`switchPage('ability')`;
      linkHtml = `<div class="thought-link" onclick="${clickAction}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
        ${esc(linkInfo.text.slice(0,35))}
      </div>`;
    }

    let noteHtml='';
    if(t.note) noteHtml=`<div style="font-size:12px;color:var(--text-tertiary);margin-top:4px">💬 ${escNL(t.note)}</div>`;
    let tagsHtml='';
    if((t.tags||[]).length) tagsHtml=`<div style="margin-top:4px">${t.tags.map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')}</div>`;

    return `<div class="thought-item">
      <div class="thought-rail">
        ${railIcon}
        <div class="thought-rail-line"></div>
      </div>
      <div class="thought-body">
        <div class="thought-title">${esc(t.text.slice(0,50))}${t.text.length>50?'...':''}</div>
        ${t.text.length>50?`<div class="thought-text">${esc(t.text)}</div>`:''}
        ${noteHtml}
        ${tagsHtml}
        ${linkHtml}
        <div class="thought-meta">
          <span>${fmtDate(t.createdAt)}${impStars(t.importance)}</span>
          ${hasLink?`<span class="tag primary">${esc(linkInfo.label)}</span>`:''}
          <div class="thought-actions">
            <button class="icon-btn" onclick="editThought('${t.id}')">✏️</button>
            <button class="icon-btn" onclick="showThoughtLinkModal('${t.id}')" title="关联">🔗</button>
            <button class="icon-btn" onclick="deleteItem('thought','${t.id}')">🗑️</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function showAddThoughtModal(){showThoughtEditModal('💭 新增思绪','',null,'',async(txt,tags,imp,note)=>{await Store.addThought(txt,tags,imp,note);await refresh();});}
function editThought(id){const t=appData.thoughts.find(x=>x.id===id);showThoughtEditModal('编辑思绪',t.text,t.tags||[],t.note,async(txt,tags,imp,note)=>{await Store.updateThought(id,txt,tags,imp,note);await refresh();},t.importance);}

function showThoughtEditModal(title,defaultValue,existingTags,existingNote,onSave,existingImp){
  const allTags=Store.getAllTags();const overlay=document.createElement('div');overlay.className='modal-overlay';
  window._editTags=existingTags?[...existingTags]:[];
  let _imp=existingImp||0;
  overlay.innerHTML=`<div class="modal-box" style="max-height:80vh;overflow-y:auto"><h3>${title}</h3>
    ${renderImpPicker(_imp,l=>{_imp=l;})}
    <div class="tag-input-area"><input id="thoughtTagInput" placeholder="输入标签，回车或点+" style="margin-bottom:0" list="tagSug"><datalist id="tagSug">${allTags.map(t=>`<option value="${esc(t)}">`).join('')}</datalist>
    <button onclick="addThoughtTag()">+</button></div>
    ${allTags.length>0?`<div style="font-size:11px;color:#999;margin-bottom:6px">已用：${allTags.map(t=>`<span class="tag" style="cursor:pointer" onclick="addTagByName('${esc(t)}')">${esc(t)}</span>`).join('')}</div>`:''}
    <div id="thoughtTags" style="margin-bottom:8px"></div>
    <textarea id="mThoughtText" rows="3" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(defaultValue)}</textarea>
    <textarea id="mThoughtNote" placeholder="💬 备注（选填）" rows="2" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(existingNote||'')}</textarea>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeThModal()">取消</button><button class="btn-primary" onclick="confirmThModal()">保存</button></div></div>`;
  document.body.appendChild(overlay);overlay.querySelector('#mThoughtText').focus();
  renderThTags();
  window.addThoughtTag=()=>{const inp=document.getElementById('thoughtTagInput');const tag=inp?.value?.trim();if(!tag||(window._editTags||[]).includes(tag))return;if(!window._editTags)window._editTags=[];window._editTags.push(tag);inp.value='';renderThTags();};
  window.addTagByName=tag=>{if(!window._editTags)window._editTags=[];if(window._editTags.includes(tag))return;window._editTags.push(tag);renderThTags();};
  window.removeThTag=tag=>{if(!window._editTags)return;window._editTags=window._editTags.filter(t=>t!==tag);renderThTags();};
  window.closeThModal=()=>{overlay.remove();cleanThModal();};
  window.confirmThModal=()=>{const txt=overlay.querySelector('#mThoughtText').value.trim();if(!txt){showToast('内容不能为空');return;}
    const tags=window._editTags||[];const note=overlay.querySelector('#mThoughtNote').value.trim();
    overlay.remove();cleanThModal();onSave(txt,tags,_imp,note);};
  overlay.addEventListener('click',e=>{if(e.target===overlay){overlay.remove();cleanThModal();}});
}
function renderThTags(){const el=document.getElementById('thoughtTags');if(!el)return;el.innerHTML=(window._editTags||[]).map(t=>`<span class="tag" style="cursor:pointer" onclick="removeThTag('${esc(t)}')">${esc(t)} ✕</span>`).join('');}
function cleanThModal(){delete window.addThoughtTag;delete window.addTagByName;delete window.removeThTag;delete window.closeThModal;delete window.confirmThModal;delete window._editTags;}

// ==================== 思绪关联弹窗 ====================

function showThoughtLinkModal(thoughtId){
  const t=appData.thoughts.find(x=>x.id===thoughtId);if(!t)return;
  const n=nc();
  // 构建树形数据
    const treeData = appData.capabilities.map(c=>({
    id:c.id, name:c.name, type:'capability',
    children: c.projects.map(p=>({
      id:p.id, name:p.name, type:'project', capId:c.id,
      children: ['action','problem','learning','review'].flatMap(et=>{
        const tl={action:n.action,problem:n.problem,learning:n.learning,review:n.review||'收获'};
        const ti={action:'🏃',problem:'⚠️',learning:'📖',review:'⭐'};
        return (p.entries[et]||[]).map(e=>({
          id:e.id, name:e.text.slice(0,25), type:'entry', capId:c.id, projId:p.id, entryType:et
        }));
      })
    }))
  }));
  const currentType=t.relatedEntryId?'entry':t.relatedProjId?'project':t.relatedCapId?'capability':t.relatedLiberationId?'liberation':'';
  const currentVal=t.relatedEntryId?(t.relatedEntryType+'_'+t.relatedEntryId):t.relatedProjId?('proj_'+t.relatedProjId):t.relatedCapId?t.relatedCapId:t.relatedLiberationId?('lib_'+t.relatedLiberationId):'';

  const overlay=document.createElement('div');overlay.className='modal-overlay';
  // 用点击折叠/展开的方式渲染树（默认全部折叠）
  let collapsedCaps = new Set(appData.capabilities.map(c=>c.id));
  let collapsedProjs = new Set(appData.capabilities.flatMap(c=>c.projects.map(p=>p.id)));

  function renderTreeHtml(){
    let html=`<label style="display:flex;align-items:center;gap:6px;padding:8px;border-radius:8px;font-size:13px;cursor:pointer;border:1px solid #e0d8d0;margin-bottom:4px;${!currentVal?'background:#f0f7f3':''}" onclick="selLinkOpt(null)">
        <input type="radio" name="linkR" value="" ${!currentVal?'checked':''} style="accent-color:#5a7d6b">
        <span style="color:#999">无关联</span></label>`;
    // 思维枷锁区
    if(appData.liberationEntries.length){
      html+=`<div style="font-size:11px;color:#999;padding:6px 0 4px;font-weight:600">🧠 ${n.module1}</div>`;
      appData.liberationEntries.slice(0,20).forEach(le=>{
        html+=`<label style="display:flex;align-items:center;gap:6px;padding:6px 8px 6px 12px;border-radius:6px;font-size:12px;cursor:pointer;border:1px solid #e0d8d0;margin-bottom:3px;${currentVal==='lib_'+le.id?'background:#f0f7f3':''}" onclick="selLinkOpt('lib_${le.id}','liberation','','','','','')">
          <input type="radio" name="linkR" value="lib_${le.id}" ${currentVal==='lib_'+le.id?'checked':''} style="accent-color:#5a7d6b">
          <span>${esc(le.text.slice(0,35))}</span></label>`;
      });
      if(appData.liberationEntries.length>20) html+=`<div style="font-size:10px;color:#aaa;padding:2px 12px">...等${appData.liberationEntries.length}条</div>`;
      html+=`<div style="border-top:1px solid #e0d8d0;margin:8px 0"></div>`;
    }
    // 能力树
    html+=`<div style="font-size:11px;color:#999;padding:6px 0 4px;font-weight:600">💪 ${n.capability}</div>`;
    treeData.forEach(cap=>{
      const isCollapsed = collapsedCaps.has(cap.id);
      html+=`<div style="display:flex;align-items:center;gap:4px;padding:6px 0;font-size:13px;cursor:pointer;user-select:none" onclick="toggleCapCollapse('${cap.id}')">
        <span style="font-size:10px;color:#aaa;width:14px;text-align:center">${isCollapsed?'▶':'▼'}</span>
        <label style="flex:1;display:flex;align-items:center;gap:6px;border-radius:6px;cursor:pointer;border:1px solid #e0d8d0;padding:6px 8px;margin-bottom:3px;${currentVal===cap.id?'background:#f0f7f3':''}" onclick="event.stopPropagation();selLinkOpt('${cap.id}','capability','${cap.id}')">
          <input type="radio" name="linkR" value="${cap.id}" ${currentVal===cap.id?'checked':''} style="accent-color:#5a7d6b">
          <span>💪 ${esc(cap.name)}</span></label></div>`;
      if(!isCollapsed){
        cap.children.forEach(proj=>{
          const pjCollapsed = collapsedProjs.has(proj.id);
          html+=`<div style="padding-left:18px;display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;user-select:none" onclick="toggleProjCollapse('${proj.id}')">
            <span style="font-size:10px;color:#aaa;width:12px;text-align:center">${pjCollapsed?'▶':'▼'}</span>
            <label style="flex:1;display:flex;align-items:center;gap:6px;border-radius:6px;cursor:pointer;border:1px solid #e0d8d0;padding:5px 8px;margin-bottom:3px;${currentVal==='proj_'+proj.id?'background:#f0f7f3':''}" onclick="event.stopPropagation();selLinkOpt('proj_${proj.id}','project','${cap.id}','${proj.id}')">
              <input type="radio" name="linkR" value="proj_${proj.id}" ${currentVal==='proj_'+proj.id?'checked':''} style="accent-color:#5a7d6b">
              <span>📂 ${esc(proj.name)}</span></label></div>`;
          if(!pjCollapsed && proj.children.length){
            html+=`<div style="padding-left:36px">`;
            proj.children.forEach(entry=>{
              const ti={action:'🏃',problem:'⚠️',learning:'📖',review:'⭐'};
              html+=`<label style="display:flex;align-items:center;gap:6px;border-radius:6px;cursor:pointer;border:1px solid #e0d8d0;padding:4px 8px;margin-bottom:2px;font-size:12px;${currentVal===entry.entryType+'_'+entry.id?'background:#f0f7f3':''}" onclick="selLinkOpt('${entry.entryType}_${entry.id}','entry','${cap.id}','${proj.id}','${entry.entryType}','${entry.id}')">
                <input type="radio" name="linkR" value="${entry.entryType}_${entry.id}" ${currentVal===entry.entryType+'_'+entry.id?'checked':''} style="accent-color:#5a7d6b">
                <span>${ti[entry.entryType]||'📝'} ${esc(entry.name)}</span></label>`;
            });
            html+=`</div>`;
          }
        });
      }
    });
    return html;
  }

  const boxId='thoughtLinkBox';
  overlay.innerHTML=`<div class="modal-box" id="${boxId}" style="max-height:80vh;display:flex;flex-direction:column"><h3>🔗 关联到</h3>
    <p style="font-size:12px;color:#999;margin-bottom:8px">选择要关联的目标（点击 ▼ 展开）</p>
    <div id="linkTreeContent" style="flex:1;overflow-y:auto;max-height:400px">${renderTreeHtml()}</div>
    <div class="modal-actions" style="margin-top:12px"><button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
    <button class="btn-primary" onclick="confirmThoughtLink('${thoughtId}')">保存</button></div></div>`;
  document.body.appendChild(overlay);

  window._linkSel={type:currentType,capId:t.relatedCapId,projId:t.relatedProjId,entryType:t.relatedEntryType,entryId:t.relatedEntryId,liberationId:t.relatedLiberationId};
  window.selLinkOpt=(val,type,capId,projId,entryType,entryId)=>{
    if(!val){window._linkSel={type:null};}else if(type==='liberation'){window._linkSel={type:'liberation',liberationId:val.replace('lib_',''),capId:null,projId:null,entryType:null,entryId:null};}else{window._linkSel={type,capId:capId||null,projId:projId||null,entryType:entryType||null,entryId:entryId||null};}
    overlay.querySelectorAll('label').forEach(l=>l.style.background='');
    if(val){const el=overlay.querySelector(`label:has(input[value="${val}"])`);if(el)el.style.background='#f0f7f3';}
    else overlay.querySelector('label')?.style.setProperty('background','#f0f7f3');
  };
  window.toggleCapCollapse=(capId)=>{
    if(collapsedCaps.has(capId))collapsedCaps.delete(capId);else collapsedCaps.add(capId);
    document.getElementById('linkTreeContent').innerHTML=renderTreeHtml();
  };
  window.toggleProjCollapse=(projId)=>{
    if(collapsedProjs.has(projId))collapsedProjs.delete(projId);else collapsedProjs.add(projId);
    document.getElementById('linkTreeContent').innerHTML=renderTreeHtml();
  };
  window.confirmThoughtLink=async(id)=>{
    const s=window._linkSel;overlay.remove();
    delete window.selLinkOpt;delete window.confirmThoughtLink;delete window._linkSel;
    delete window.toggleCapCollapse;delete window.toggleProjCollapse;
    await Store.linkThought(id,s.capId,s.projId,s.entryType,s.entryId,s.liberationId);
    await refresh();showToast('✅ 关联已更新');
  };
}

// ==================== 待办 ====================

function renderTodos(){
  const tabs = [
    { key: 'today', label: '今日待办', emoji: '📌' },
    { key: 'library', label: '待办库', emoji: '📦' },
    { key: 'completed', label: '已完成', emoji: '✅' }
  ];
  document.getElementById('todoTabs').innerHTML = tabs.map(t =>
    `<div class="tab ${t.key === _todoTab ? 'active' : ''}" onclick="switchTodoTab('${t.key}')">${t.emoji} ${t.label}</div>`
  ).join('');

  const con=document.getElementById('todoContent');const n=nc();
  const{today:td,library:lib,completed:comp}=Store.getTodos(appData);

  if (_todoTab === 'today') {
    const tdS=sortByImpThenTime(td);
    if (!tdS.length) {
      con.innerHTML = '<div class="empty-state">暂无今日待办<br><span style="font-size:12px;color:var(--text-hint)">从待办库添加，或点击 + 直接创建</span></div>';
      return;
    }
    con.innerHTML = tdS.map(t=>renderTodoCard(t,true)).join('');
  } else if (_todoTab === 'library') {
    const libS=sortByImpThenTime(lib);
    if (!libS.length) {
      con.innerHTML = '<div class="empty-state">待办库为空<br><span style="font-size:12px;color:var(--text-hint)">点击 + 创建新待办</span></div>';
      return;
    }
    con.innerHTML = libS.map(t=>renderTodoCard(t,false)).join('');
  } else {
    const compS=[...comp].sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt));
    if (!compS.length) {
      con.innerHTML = '<div class="empty-state">暂无已完成待办</div>';
      return;
    }
    con.innerHTML = compS.map(t=>`
      <div class="todo-card" style="opacity:0.6">
        <div style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:#5a7d6b">✅</div>
        <div class="todo-body"><div class="todo-text"><s>${esc(t.text)}</s></div>${t.note?`<div style="font-size:11px;color:#aaa;margin-top:2px">💬 ${escNL(t.note)}</div>`:''}<div class="todo-source">完成于 ${fmtDate(t.completedAt)}</div></div>
        <div class="todo-actions"><button class="icon-btn" onclick="deleteItem('todo','${t.id}')">🗑️</button></div>
      </div>`).join('');
  }
}

function switchTodoTab(tab) { _todoTab = tab; renderTodos(); }

function renderTodoCard(t,isToday){
  let srcEntry = null, srcCap = null, srcProj = null;
  if (t.sourceEntryId && t.sourceCapId && t.sourceProjId) {
    srcCap = appData.capabilities.find(c=>c.id===t.sourceCapId);
    srcProj = srcCap?.projects.find(p=>p.id===t.sourceProjId);
    if (srcProj) {
      srcEntry = (srcProj.entries[t.sourceEntryType]||[]).find(e=>e.id===t.sourceEntryId);
    }
  }
  const genEntries = (t.generatedEntryIds||[]).map(eid=>{
    for(const cap of appData.capabilities){
      for(const proj of cap.projects){
        for(const[tp,arr]of Object.entries(proj.entries)){
          const e=arr.find(x=>x.id===eid);
          if(e)return{cap,proj,type:tp,entry:e};
        }
      }
    }
    return null;
  }).filter(Boolean);

  let srcHtml = '';
  if(srcEntry && srcCap && srcProj){
    srcHtml = `<div class="linked-todo" style="font-size:11px;margin-top:4px">
      <span>📎 ${esc(srcCap.name)} > ${esc(srcProj.name)} > ${esc(srcEntry.text.slice(0,25))}</span>
    </div>`;
  } else if (t.sourceEntryId) {
    srcHtml = `<div class="linked-todo" style="font-size:11px;margin-top:4px;color:#D85A30">
      <span>📎 关联条目未找到（可能已删除）</span>
    </div>`;
  }
  let genHtml = '';
  if(genEntries.length){
    genHtml = `<div style="margin-top:6px;border-top:1px solid #f0ece7;padding-top:6px">
      <div style="font-size:11px;color:#888;margin-bottom:4px">📝 关联条目 (${genEntries.length})</div>
      ${genEntries.map(ge=>`<div style="font-size:12px;color:#333;padding:3px 6px;background:#f8f6f3;border-radius:6px;margin-bottom:2px">${esc(ge.entry.text.slice(0,35))}</div>`).join('')}
    </div>`;
  }
  return `<div class="todo-card">
    <input type="checkbox" onchange="completeTodo('${t.id}')">
    <div class="todo-body">
      <div class="todo-text">${esc(t.text)}${impStars(t.importance)}</div>
      ${srcHtml}
      ${collapseWrap('todo_'+t.id, (t.note?`<div style="font-size:12px;color:#888;margin-top:2px">💬 ${escNL(t.note)}</div>`:'')+genHtml)}
    </div>
    <div class="todo-actions">
      ${isToday?`<button class="todo-move-btn" onclick="moveTodoToLib('${t.id}')">移回库</button>`
        :`<button class="todo-move-btn" onclick="moveTodoToToday('${t.id}')">今日</button>`}
      <button class="icon-btn" onclick="editTodo('${t.id}')">✏️</button>
      <button class="icon-btn" onclick="deleteItem('todo','${t.id}')">🗑️</button>
    </div>
  </div>`;
}

function showAddTodoModal(){showTodoModalWithLink('📋 新建待办','',null,null,
  async(txt,note,source)=>{await Store.addTodo(txt,_addTodoImp||0,source,note);await refresh();},0,
  async imp=>{_addTodoImp=imp;});}
let _addTodoImp=0;
function editTodo(id){const t=appData.todos.find(x=>x.id===id);
  const existingSource = (t.sourceCapId&&t.sourceProjId) ? {capId:t.sourceCapId,projId:t.sourceProjId,entryType:t.sourceEntryType,entryId:t.sourceEntryId} : null;
  showTodoModalWithLink('编辑待办',t.text,t.note,existingSource,async(txt,note,source)=>{
    const updates = {text:txt,note:note};
    if(source){Object.assign(updates,{sourceCapId:source.capId,sourceProjId:source.projId,sourceEntryType:source.entryType,sourceEntryId:source.entryId});}
    else{Object.assign(updates,{sourceCapId:null,sourceProjId:null,sourceEntryType:null,sourceEntryId:null});}
    await Store.updateTodo(id,updates);await refresh();},t.importance,async imp=>{await Store.updateTodo(id,{importance:imp});await refresh();});}

function showTodoModalWithLink(title,defaultValue,existingNote,existingSource,onSave,importance,onImportanceChange){
  const overlay=document.createElement('div');overlay.className='modal-overlay';
  const hasImp=importance!==undefined&&importance!==null&&importance!==-1;
  let _imp=importance||0;
  const impHtml=hasImp?renderImpPicker(importance,imp=>{_imp=imp;if(onImportanceChange)onImportanceChange(imp);}):'';
  // 构建行动选择树（可折叠）
  const treeData = appData.capabilities.map(c=>({
    id:c.id, name:c.name, type:'capability',
    children: c.projects.map(p=>({
      id:p.id, name:p.name, type:'project', capId:c.id,
      children: [...(p.entries.action||[]),...(p.entries.learning||[])].map(e=>{
        const eType = (p.entries.action||[]).find(x=>x.id===e.id) ? 'action' : 'learning';
        return { id:e.id, name:e.text.slice(0,25), type:'entry', capId:c.id, projId:p.id, entryType:eType };
      })
    }))
  }));
  const currentVal = existingSource ? existingSource.capId+'|'+existingSource.projId+'|'+existingSource.entryType+'|'+existingSource.entryId : null;
  let collapsedCaps = new Set(appData.capabilities.map(c=>c.id));
  let collapsedProjs = new Set(appData.capabilities.flatMap(c=>c.projects.map(p=>p.id)));

  function renderLinkTree(){
    let html=`<label style="display:flex;align-items:center;gap:6px;padding:8px;border-radius:8px;font-size:13px;cursor:pointer;border:1px solid #e0d8d0;margin-bottom:4px;${!currentVal?'background:#f0f7f3':''}" onclick="selTodoLink(null)">
        <input type="radio" name="todoLinkR" value="" ${!currentVal?'checked':''} style="accent-color:#5a7d6b">
        <span style="color:#999">不关联</span></label>`;
    treeData.forEach(cap=>{
      const isCollapsed = collapsedCaps.has(cap.id);
      const capHasActions = cap.children.some(p=>p.children.length>0);
      html+=`<div style="display:flex;align-items:center;gap:4px;padding:6px 0;font-size:13px;cursor:pointer;user-select:none" onclick="toggleTodoCapCollapse('${cap.id}')">
        <span style="font-size:10px;color:#aaa;width:14px;text-align:center">${isCollapsed?'▶':'▼'}</span>
        <label style="flex:1;display:flex;align-items:center;gap:6px;border-radius:6px;cursor:pointer;border:1px solid #e0d8d0;padding:6px 8px;margin-bottom:3px" onclick="event.stopPropagation();if(!${capHasActions})toggleTodoCapCollapse('${cap.id}')">
          <span style="color:#888">💪 ${esc(cap.name)}</span>${!capHasActions?'<span style="font-size:10px;color:#ccc">（无行动）</span>':''}</label></div>`;
      if(!isCollapsed){
        cap.children.forEach(proj=>{
          const pjCollapsed = collapsedProjs.has(proj.id);
          const projHasActions = proj.children.length>0;
          html+=`<div style="padding-left:18px;display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;user-select:none" onclick="toggleTodoProjCollapse('${proj.id}')">
            <span style="font-size:10px;color:#aaa;width:12px;text-align:center">${pjCollapsed?'▶':'▼'}</span>
            <label style="flex:1;display:flex;align-items:center;gap:6px;border-radius:6px;cursor:pointer;border:1px solid #e0d8d0;padding:5px 8px;margin-bottom:3px" onclick="event.stopPropagation();if(!${projHasActions})toggleTodoProjCollapse('${proj.id}')">
              <span style="color:#888">📂 ${esc(proj.name)}</span>${!projHasActions?'<span style="font-size:10px;color:#ccc">（无行动）</span>':''}</label></div>`;
          if(!pjCollapsed && proj.children.length){
            html+=`<div style="padding-left:36px">`;
            proj.children.forEach(entry=>{
              const val = entry.capId+'|'+entry.projId+'|'+entry.entryType+'|'+entry.id;
              const sel = currentVal===val;
              html+=`<label style="display:flex;align-items:center;gap:6px;border-radius:6px;cursor:pointer;border:1px solid #e0d8d0;padding:4px 8px;margin-bottom:2px;font-size:12px;${sel?'background:#f0f7f3':''}" onclick="selTodoLink('${val}')">
                <input type="radio" name="todoLinkR" value="${val}" ${sel?'checked':''} style="accent-color:#5a7d6b">
                <span>🏃 ${esc(entry.name)}</span></label>`;
            });
            html+=`</div>`;
          }
        });
      }
    });
    if(!appData.capabilities.some(c=>c.projects.some(p=>(p.entries.action||[]).length||(p.entries.learning||[]).length))){
      html += '<div style="font-size:12px;color:#ccc;padding:8px;text-align:center">暂无行动可关联</div>';
    }
    return html;
  }

  let linkHtml = '<div style="margin-bottom:10px"><label style="font-size:12px;color:#888;display:block;margin-bottom:6px">关联到行动（可选，点击 ▼ 展开专项）</label>';
  linkHtml += `<div id="todoLinkTree" style="border:1px solid #e0d8d0;border-radius:8px;padding:4px">`;
  linkHtml += renderLinkTree();
  linkHtml += '</div></div>';

  overlay.innerHTML=`<div class="modal-box" style="max-height:85vh;display:flex;flex-direction:column"><h3>${title}</h3>
    <div style="flex:1;overflow-y:auto;min-height:0">
    <textarea id="modalText" rows="3" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(defaultValue)}</textarea>
    ${impHtml}
    <textarea id="modalNote" placeholder="💬 备注（选填）" rows="2" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(existingNote||'')}</textarea>
    ${linkHtml}
    </div>
    <div class="modal-actions" style="margin-top:10px"><button class="btn-cancel" onclick="closeTodoLinkM()">取消</button>
    <button class="btn-primary" onclick="confirmTodoLinkM()">保存</button></div></div>`;
  document.body.appendChild(overlay);overlay.querySelector('#modalText').focus();
  window._todoLinkVal = currentVal;
  window.selTodoLink=val=>{window._todoLinkVal=val;
    overlay.querySelectorAll('#todoLinkTree label').forEach(l=>l.style.background='');
    if(val){const inp=overlay.querySelector(`#todoLinkTree input[value="${val}"]`);if(inp)inp.closest('label').style.background='#f0f7f3';}
    else{overlay.querySelector('#todoLinkTree label')?.style.setProperty('background','#f0f7f3');}};
  window.toggleTodoCapCollapse=capId=>{if(collapsedCaps.has(capId))collapsedCaps.delete(capId);else collapsedCaps.add(capId);
    const treeEl=document.getElementById('todoLinkTree');if(treeEl)treeEl.innerHTML=renderLinkTree();
    if(window._todoLinkVal)window.selTodoLink(window._todoLinkVal);};
  window.toggleTodoProjCollapse=projId=>{if(collapsedProjs.has(projId))collapsedProjs.delete(projId);else collapsedProjs.add(projId);
    const treeEl=document.getElementById('todoLinkTree');if(treeEl)treeEl.innerHTML=renderLinkTree();
    if(window._todoLinkVal)window.selTodoLink(window._todoLinkVal);};
  window.confirmTodoLinkM=()=>{const txt=overlay.querySelector('#modalText').value.trim();if(!txt){showToast('内容不能为空');return;}
    const note=overlay.querySelector('#modalNote').value.trim();
    let source=null;
    if(window._todoLinkVal){const p=window._todoLinkVal.split('|');if(p.length===4)source={capId:p[0],projId:p[1],entryType:p[2],entryId:p[3]};}
    overlay.remove();delete window.confirmTodoLinkM;delete window.closeTodoLinkM;delete window.selTodoLink;delete window._todoLinkVal;delete window.toggleTodoCapCollapse;delete window.toggleTodoProjCollapse;_impPickerCallback=null;
    onSave(txt,note,source);};
  window.closeTodoLinkM=()=>{overlay.remove();delete window.confirmTodoLinkM;delete window.closeTodoLinkM;delete window.selTodoLink;delete window._todoLinkVal;delete window.toggleTodoCapCollapse;delete window.toggleTodoProjCollapse;_impPickerCallback=null;};
  overlay.addEventListener('click',e=>{if(e.target===overlay)window.closeTodoLinkM();});
}

async function completeTodo(id){
  // 完成待办只标记状态，不归档到任何过程
  await Store.completeTodo(id,null,null);
  await refresh();showToast('✅ 已完成');
}

async function moveTodoToToday(id){await Store.updateTodo(id,{isToday:true});await refresh();showToast('📌 已移至今日待办');}
async function moveTodoToLib(id){await Store.updateTodo(id,{isToday:false});await refresh();showToast('📦 已移回待办库');}

// ==================== 通用编辑弹窗 ====================

function showEditModal(title,defaultValue,onSave,importance,onImportanceChange){
  const overlay=document.createElement('div');overlay.className='modal-overlay';
  const hasImp=importance!==undefined&&importance!==null&&importance!==-1;
  const impHtml=hasImp?renderImpPicker(importance,imp=>{if(onImportanceChange)onImportanceChange(imp);}):'';
  overlay.innerHTML=`<div class="modal-box"><h3>${title}</h3>
    <textarea id="modalText" rows="3" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(defaultValue)}</textarea>
    ${impHtml}<div class="modal-actions"><button class="btn-cancel" onclick="closeEM()">取消</button>
    <button class="btn-primary" onclick="confirmEM()">保存</button></div></div>`;
  document.body.appendChild(overlay);overlay.querySelector('#modalText').focus();
  window.confirmEM=()=>{const txt=overlay.querySelector('#modalText').value.trim();if(!txt){showToast('内容不能为空');return;}
    overlay.remove();delete window.confirmEM;delete window.closeEM;_impPickerCallback=null;onSave(txt);};
  window.closeEM=()=>{overlay.remove();delete window.confirmEM;delete window.closeEM;_impPickerCallback=null;};
  overlay.querySelector('#modalText').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();window.confirmEM();}});
  overlay.addEventListener('click',e=>{if(e.target===overlay)window.closeEM();});
}

/** 带备注的编辑弹窗（待办、从条目创建待办） */
function showEditModalWithNote(title,defaultValue,existingNote,onSave,importance,onImportanceChange){
  const overlay=document.createElement('div');overlay.className='modal-overlay';
  const hasImp=importance!==undefined&&importance!==null&&importance!==-1;
  const impHtml=hasImp?renderImpPicker(importance,imp=>{if(onImportanceChange)onImportanceChange(imp);}):'';
  overlay.innerHTML=`<div class="modal-box"><h3>${title}</h3>
    <textarea id="modalText" rows="3" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(defaultValue)}</textarea>
    ${impHtml}
    <textarea id="modalNote" placeholder="💬 备注（选填）" rows="2" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(existingNote||'')}</textarea>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeEMN()">取消</button>
    <button class="btn-primary" onclick="confirmEMN()">保存</button></div></div>`;
  document.body.appendChild(overlay);overlay.querySelector('#modalText').focus();
  window.confirmEMN=()=>{const txt=overlay.querySelector('#modalText').value.trim();if(!txt){showToast('内容不能为空');return;}
    const note=overlay.querySelector('#modalNote').value.trim();
    overlay.remove();delete window.confirmEMN;delete window.closeEMN;_impPickerCallback=null;onSave(txt,note);};
  window.closeEMN=()=>{overlay.remove();delete window.confirmEMN;delete window.closeEMN;_impPickerCallback=null;};
  overlay.querySelector('#modalText').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();window.confirmEMN();}});
  overlay.addEventListener('click',e=>{if(e.target===overlay)window.closeEMN();});
}

function deleteItem(type,a,b,c,d){
  const n=nc();
  const msgs={liberation:'确认删除这条记录？',diplomacy:'确认删除这条记录？',
    capability:'确认删除此'+n.capability+'及其所有数据？',project:'确认删除此'+n.project+'？',
    entry:'确认删除这条记录？',thought:'确认删除这条思绪？',todo:'确认删除此待办？',goal:'确认删除这个目标？',habit:'确认删除这个习惯？'};
  showConfirmModal(msgs[type]||'确认删除？',()=>{
    switch(type){
      case'liberation':Store.deleteLiberationEntry(a).then(refresh);break;
      case'diplomacy':Store.deleteDiplomacyEntry(a).then(refresh);break;
      case'capability':Store.deleteCapability(a).then(refresh);break;
      case'project':Store.deleteProject(a,b).then(refresh);break;
      case'entry':Store.deleteEntry(a,b,c,d).then(refresh);break;
      case'thought':Store.deleteThought(a).then(refresh);break;
      case'todo':Store.deleteTodo(a).then(refresh);break;
      case'goal':Store.deleteGoal(a).then(refresh);break;
      case'habit':Store.deleteHabit(a).then(refresh);break;
    }
  });
}

// ==================== 编辑函数（修复权重覆盖bug） ====================

async function toggleCapStatus(id){
  const c=appData.capabilities.find(x=>x.id===id);if(!c)return;
  const newStatus=c.status==='completed'?'active':'completed';
  await Store.updateCapability(id,undefined,undefined,newStatus);await refresh();
  showToast(newStatus==='completed'?'✅ 已标记完成':'🔄 已恢复');
}
async function toggleProjStatus(capId,projId){
  const cap=appData.capabilities.find(c=>c.id===capId);if(!cap)return;
  const p=cap.projects.find(x=>x.id===projId);if(!p)return;
  const newStatus=p.status==='completed'?'active':'completed';
  await Store.updateProject(capId,projId,undefined,undefined,newStatus);await refresh();
  showToast(newStatus==='completed'?'✅ 已标记完成':'🔄 已恢复');
}
async function toggleEntryStatus(capId,projId,type,entryId){
  const proj=(appData.capabilities.find(c=>c.id===capId)?.projects.find(p=>p.id===projId));
  if(!proj)return;
  const e=(proj.entries[type]||[]).find(x=>x.id===entryId);if(!e)return;
  const isDone=e.status==='completed'||e.status==='resolved';
  const newStatus=isDone?'active':(type==='problem'?'resolved':'completed');
  await Store.updateEntry(capId,projId,type,entryId,undefined,undefined,undefined,undefined,newStatus);
  await refresh();showToast(!isDone?'✅ 已标记':'🔄 已恢复');
}

function editLiberation(id){const e=appData.liberationEntries.find(x=>x.id===id);showEditModal('编辑',e.text,async txt=>{await Store.updateLiberationEntry(id,txt);await refresh();});}
function editDiplomacy(id){const e=appData.diplomacyEntries.find(x=>x.id===id);showEditModal('编辑',e.text,async txt=>{await Store.updateDiplomacyEntry(id,txt);await refresh();});}
function editCap(id){const c=appData.capabilities.find(x=>x.id===id);
  showEditModal('修改'+nc().capability,c.name,async txt=>{await Store.updateCapability(id,txt);await refresh();},
    c.importance,async imp=>{await Store.updateCapability(id,undefined,imp);await refresh();});}
function showAddProjectModal(capId){showEditModal('新建'+nc().project,'',async txt=>{await Store.addProject(capId,txt,_addProjImp||0);await refresh();},
  0,async imp=>{_addProjImp=imp;});}
let _addProjImp=0;
function editProj(capId,projId){const cap=appData.capabilities.find(c=>c.id===capId);const p=cap?.projects.find(x=>x.id===projId);
  showEditModal('修改'+nc().project,p?.name||'',async txt=>{await Store.updateProject(capId,projId,txt);await refresh();},
    p?.importance||0,async imp=>{await Store.updateProject(capId,projId,undefined,imp);await refresh();});}
function showAddModal(module){const n=nc();const name=module==='liberation'?n.module1:n.module3;
  showEditModal('添加'+name+'记录','',async txt=>{if(module==='liberation')await Store.addLiberationEntry(txt);else await Store.addDiplomacyEntry(txt);await refresh();});}
function showAddCapabilityModal(){const n=nc();showEditModal('新建'+n.capability,'',async txt=>{await Store.addCapability(txt,_addCapImp||0);await refresh();},
  0,async imp=>{_addCapImp=imp;});}
let _addCapImp=0;

// ==================== 命名配置 ====================

function showNameConfigModal(){
  document.getElementById('dropdownMenu').classList.add('hidden');
  const n=nc();
  const fields=[
    {key:'topLevel',label:'全局名称',emoji:'📛'},
    {key:'module1',label:'能力-模块一',emoji:'🧠'},{key:'module2',label:'能力-模块二',emoji:'💪'},{key:'module3',label:'能力-模块三',emoji:'🎨'},
    {key:'capability',label:'顶层',emoji:'📦'},{key:'project',label:'专项',emoji:'📂'},{key:'process',label:'过程',emoji:'✅'},
    {key:'action',label:'行动栏',emoji:'🏃'},{key:'problem',label:'问题栏',emoji:'⚠️'},{key:'learning',label:'学习栏',emoji:'📖'},{key:'review',label:'总结栏',emoji:'📋'}];
  const overlay=document.createElement('div');overlay.className='modal-overlay';
  overlay.innerHTML=`<div class="modal-box" style="max-height:80vh;overflow-y:auto"><h3>✏️ 自定义命名</h3><p style="font-size:12px;color:#999;margin-bottom:12px">实时生效，随时可改</p>
    ${fields.map(f=>`<div style="margin-bottom:8px"><label style="font-size:12px;color:#666">${f.emoji} ${f.label}</label>
      <input class="name-input" data-key="${f.key}" value="${esc(n[f.key])}" style="width:100%"></div>`).join('')}
    <div class="modal-actions"><button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
    <button class="btn-primary" onclick="saveNC()">保存</button></div></div>`;
  document.body.appendChild(overlay);
  window.saveNC=async()=>{const config={};overlay.querySelectorAll('.name-input').forEach(inp=>{const v=inp.value.trim();if(v)config[inp.dataset.key]=v;});await Store.updateNameConfig(config);overlay.remove();delete window.saveNC;await refresh();showToast('命名已更新 ✅');};
}

// ==================== 导出/导入 ====================

async function exportJSON(){document.getElementById('dropdownMenu').classList.add('hidden');await Store.exportJSON();showToast('📤 JSON已导出');}
async function exportMarkdown(){document.getElementById('dropdownMenu').classList.add('hidden');await Store.exportMarkdown();showToast('📝 Markdown已导出');}
async function importData(event){document.getElementById('dropdownMenu').classList.add('hidden');
  try{appData=await Store.importJSON(event.target.files[0]);await refresh();showToast('📥 导入成功 ✅');}catch(err){showToast('❌ 导入失败：'+err.message);}
  event.target.value='';}

// ==================== 工具 ====================

function toggleMenu(){document.getElementById('dropdownMenu').classList.toggle('hidden');}
document.addEventListener('click',e=>{if(!e.target.closest('#menuBtn')&&!e.target.closest('.dropdown'))document.getElementById('dropdownMenu').classList.add('hidden');});
function showToast(msg){const el=document.querySelector('.toast');if(el)el.remove();const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2000);}
function esc(str){if(!str)return '';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function escNL(str){if(!str)return '';return esc(str).replace(/\n/g,'<br>');}

/** 折叠/展开 */
function toggleCollapse(id){
  const content=document.getElementById(id);
  const btn=document.getElementById(id+'_btn');
  if(!content||!btn)return;
  content.classList.toggle('collapsed');
  btn.classList.toggle('expanded');
  btn.querySelector('.toggle-label').textContent=content.classList.contains('collapsed')?'展开 ▼':'收起 ▲';
}

/** 生成折叠HTML：extraContent是完整HTML，id用唯一标识 */
function collapseWrap(id,extraHtml){
  if(!extraHtml)return '';
  const collapsedId='collapse_'+id;
  return `<div id="${collapsedId}" class="collapse-content collapsed">${extraHtml}</div>
    <button class="collapse-toggle" id="${collapsedId}_btn" onclick="toggleCollapse('${collapsedId}')"><span class="arrow">▲</span> <span class="toggle-label">展开 ▼</span></button>`;
}
