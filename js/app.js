/* ===== 应用主逻辑 v5 ===== */
let appData = null;
let currentPage = 'home';
let currentCapId = null, currentProjId = null, currentProjTab = 'action';
let _impPickerCallback = null, _confirmCallback = null;
let _abilityTab = 'independence'; // liberation | independence | diplomacy

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
  updateTitle(); renderPage(); updateNav();
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
    case 'goals': renderGoals(); break;
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
  if (t.relatedTodoId) {
    const todo = appData.todos.find(x => x.id === t.relatedTodoId);
    if (todo) return { icon: '📋', label: '待办', text: todo.text, type: 'todo' };
  }
  if (t.relatedEntryId && t.relatedEntryType) {
    const cap = appData.capabilities.find(c => c.id === t.relatedCapId);
    const proj = cap?.projects.find(p => p.id === t.relatedProjId);
    const entry = (proj?.entries[t.relatedEntryType]||[]).find(e => e.id === t.relatedEntryId);
    if (entry) {
      const typeLabels = { action:'行动', problem:'问题', learning:'学习', review:'总结' };
      const typeIcons = { action:'🏃', problem:'⚠️', learning:'📖', review:'📋' };
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
  const goalCnt = appData.goals.length;
  const thCnt = appData.thoughts.length;
  const {today:td} = Store.getTodos(appData);
  const topCap = capCnt ? sortByImpThenTime(appData.capabilities)[0] : null;
  const topGoal = goalCnt ? sortByImpThenTime(appData.goals)[0] : null;
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
        <div class="hc-icon">🎯</div>
        <div class="hc-num">${goalCnt}</div>
        <div class="hc-label">目标</div>
        <div class="hc-sub">${topGoal ? '⭐'+topGoal.name : ''}</div>
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
    con.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span></span><button class="add-btn" onclick="showAddModal(\'liberation\')">+</button></div>';
    if(!appData.liberationEntries.length) { con.innerHTML+='<div class="empty-state">暂无记录</div>'; return; }
    con.innerHTML += appData.liberationEntries.map(e=>`
      <div class="entry-card"><div class="entry-meta"><span>${fmtDate(e.createdAt)}</span>
        <span class="entry-actions"><button class="icon-btn" onclick="editLiberation('${e.id}')">✏️</button>
        <button class="icon-btn" onclick="deleteItem('liberation','${e.id}')">🗑️</button></span></div>
      <div class="entry-text">${esc(e.text)}</div></div>`).join('');
  } else if (_abilityTab === 'diplomacy') {
    con.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span></span><button class="add-btn" onclick="showAddModal(\'diplomacy\')">+</button></div>';
    if(!appData.diplomacyEntries.length) { con.innerHTML+='<div class="empty-state">暂无记录</div>'; return; }
    con.innerHTML += appData.diplomacyEntries.map(e=>`
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
  con.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span></span><button class="add-btn" onclick="showAddCapabilityModal()">+</button></div>';
  if(!appData.capabilities.length) { con.innerHTML+='<div class="empty-state">还没有'+n.capability+'</div>'; return; }
  const sorted = sortByImpThenTime(appData.capabilities);
  con.innerHTML += sorted.map(cap=>{
    const total = cap.projects.reduce((s,p)=>s+Object.values(p.entries).reduce((a,arr)=>a+arr.length,0),0);
    const sortedProjs = sortByImpThenTime(cap.projects);
    const capThoughts = findLinkedThoughts({ capId: cap.id });
    return `<div class="capability-card">
      <div class="cap-header">
        <span class="cap-name">${esc(cap.name)}${impStars(cap.importance)}</span>
        <span style="display:flex;gap:4px">
          <button class="icon-btn" onclick="editCap('${cap.id}')">✏️</button>
          <button class="icon-btn" onclick="deleteItem('capability','${cap.id}')">🗑️</button>
          <button class="icon-btn" onclick="showAddProjectModal('${cap.id}')">+${n.project}</button>
        </span>
      </div>
      <div class="cap-count">${total}条记录</div>
      ${capThoughts.length?`<div style="margin:6px 0 4px;padding:4px 8px;background:#f8f6f3;border-radius:6px;font-size:11px;color:#888">💭 关联思绪：${capThoughts.slice(0,2).map(lt=>esc(lt.text.slice(0,20))).join('、')}${capThoughts.length>2?' 等'+capThoughts.length+'条':''}</div>`:''}
      ${sortedProjs.length===0?'<div class="cap-empty">暂无'+n.project+'</div>'
        : sortedProjs.map(p=>{
          const pTotal = Object.values(p.entries).reduce((a,arr)=>a+arr.length,0);
          const projThoughts = findLinkedThoughts({ capId: cap.id, projId: p.id });
          return `<div class="project-item" onclick="openProject('${cap.id}','${p.id}')">
            <span class="pj-name">${esc(p.name)}${impStars(p.importance)}</span>
            <span style="display:flex;align-items:center;gap:6px">
              <span class="pj-stats">${pTotal}条</span>
              ${projThoughts.length?`<span title="关联${projThoughts.length}条思绪" style="font-size:11px;color:#aaa">💭${projThoughts.length}</span>`:''}
              <button class="icon-btn" onclick="event.stopPropagation();editProj('${cap.id}','${p.id}')">✏️</button>
              <button class="icon-btn" onclick="event.stopPropagation();deleteItem('project','${cap.id}','${p.id}')">🗑️</button>
            </span>
          </div>`;
        }).join('')}
    </div>`;
  }).join('');
}

// ==================== 目标 ====================

function renderGoals() {
  const list = document.getElementById('goalsList');
  if(!appData.goals.length) { list.innerHTML='<div class="empty-state">暂无目标</div>'; return; }
  const sorted = sortByImpThenTime(appData.goals);
  list.innerHTML = sorted.map(g=>`
    <div class="entry-card">
      <div class="entry-meta">
        <span>${fmtDate(g.createdAt)}${impStars(g.importance)}</span>
        <span class="entry-actions">
          <button class="icon-btn" onclick="editGoal('${g.id}')">✏️</button>
          <button class="icon-btn" onclick="deleteItem('goal','${g.id}')">🗑️</button>
          <button class="icon-btn" onclick="completeGoal('${g.id}')" title="完成">✅</button>
        </span>
      </div>
      <div class="entry-text">${esc(g.name)}</div>
      ${g.description?`<div style="font-size:12px;color:#999;margin-top:4px">${esc(g.description)}</div>`:''}
      ${g.status==='completed'?`<div style="font-size:11px;color:#5a7d6b;margin-top:4px">✅ 已完成</div>`:''}
    </div>`).join('');
}

function showAddGoalModal() {
  showEditModal('🎯 新建目标', '', async txt=>{ await Store.addGoal(txt,0,''); await refresh(); }, 0);
}
function editGoal(id) {
  const g=appData.goals.find(x=>x.id===id);
  showEditModal('编辑目标', g.name, async txt=>{ await Store.updateGoal(id,txt); await refresh(); },
    g.importance, async imp=>{ await Store.updateGoal(id,undefined,imp); await refresh(); });
}
function completeGoal(id) {
  const g=appData.goals.find(x=>x.id===id);
  if(!g)return;
  const newStatus = g.status==='completed'?'active':'completed';
  Store.updateGoal(id,undefined,undefined,undefined,newStatus).then(refresh);
  showToast(newStatus==='completed'?'🎉 目标已完成':'↩️ 已重新激活');
}

// ==================== 专项详情 ====================

function openProject(capId, projId) {
  currentCapId=capId; currentProjId=projId; currentProjTab='action'; switchPage('project');
}

function getProj() {
  return appData.capabilities.find(c=>c.id===currentCapId)?.projects.find(p=>p.id===currentProjId)||null;
}

function renderProject() {
  const cap=appData.capabilities.find(c=>c.id===currentCapId); if(!cap){switchPage('ability');return;}
  const proj=cap.projects.find(p=>p.id===currentProjId); if(!proj){switchPage('ability');return;}
  const n=nc();
  document.getElementById('projectTitle').textContent = cap.name+'·'+proj.name;
  const tabs=[
    {key:'action',label:n.action,emoji:'🏃'},{key:'problem',label:n.problem,emoji:'⚠️'},
    {key:'learning',label:n.learning,emoji:'📖'},{key:'process',label:n.process,emoji:'✅'},
    {key:'review',label:n.review,emoji:'📋'}];
  document.getElementById('projectTabs').innerHTML = tabs.map(t=>
    `<div class="tab ${t.key===currentProjTab?'active':''}" onclick="switchProjTab('${t.key}')">${t.emoji} ${t.label}</div>`).join('');
  const con=document.getElementById('projectContent');

  if(currentProjTab==='process'){
    const proc=proj.process||[];
    if(!proc.length){con.innerHTML='<div class="empty-state">✅ 暂无已完成待办</div>';return;}
    con.innerHTML=[...proc].reverse().map(p=>`
      <div class="process-item"><div class="proc-meta">${fmtDate(p.completedAt)} ${p.relatedEntryIds?.length?'· 关联'+p.relatedEntryIds.length+'条记录':''}</div>
      <div style="font-size:14px">${esc(p.text)}</div>
      <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">${(p.relatedEntryIds||[]).map(eid=>{
        for(const[t,arr]of Object.entries(proj.entries)){const e=arr.find(x=>x.id===eid);if(e)return`<span class="entry-tag">${n[t]||t}: ${esc(e.text.slice(0,20))}</span>`;}
        return '';
      }).join('')}</div></div>`).join('');
    return;
  }

  const entries = sortByImpThenTime(proj.entries[currentProjTab]||[]);
  const ct = tabs.find(t=>t.key===currentProjTab);
  const label=ct?.label||'',emoji=ct?.emoji||'';

  if(!entries.length){
    con.innerHTML=`<div class="empty-state">${emoji} 暂无${label}记录</div><div style="text-align:center;margin-top:12px"><button class="btn-primary" onclick="showAddEntryInProj('${currentProjTab}')">+ 添加${label}</button></div>`;
    return;
  }

  con.innerHTML = entries.map(e=>{
    const relatedTodo = e.relatedTodoId ? appData.todos.find(t=>t.id===e.relatedTodoId) : null;
    const fromTodo = e.createdFromTodoId ? appData.todos.find(t=>t.id===e.createdFromTodoId) : null;
    const procEntry = (proj.process||[]).find(p=>p.id===e.relatedProcessId);
    const linkedThoughts = findLinkedThoughts({ capId:currentCapId, projId:currentProjId, entryType:currentProjTab, entryId:e.id });
    return `<div class="entry-card">
      <div class="entry-meta"><span>${fmtDate(e.createdAt)}${impStars(e.importance)}</span>
        <span class="entry-actions">
          <button class="icon-btn" onclick="editProjEntry('${e.id}')">✏️</button>
          <button class="icon-btn" onclick="deleteItem('entry','${currentCapId}','${currentProjId}','${currentProjTab}','${e.id}')">🗑️</button>
          ${currentProjTab!=='review'?`<button class="icon-btn" onclick="showCreateTodoFromEntry('${e.id}')" title="创建待办">📋</button>`:''}
          ${(!fromTodo && currentProjTab!=='review')?`<button class="icon-btn" onclick="showEntryFromTodoModal('${e.id}')" title="从已完成待办创建">🔗</button>`:''}
        </span>
      </div>
      <div class="entry-text">${esc(e.text)}</div>
      ${e.note?`<div style="font-size:12px;color:#888;margin-top:2px">💬 ${esc(e.note)}</div>`:''}
      ${procEntry?`<div style="font-size:11px;color:#5a7d6b;margin-top:4px">📎 关联过程：${esc(procEntry.text.slice(0,25))}</div>`:''}
      ${fromTodo?`<div style="font-size:11px;color:#888;margin-top:4px">🔗 来源于待办：${esc(fromTodo.text.slice(0,25))} ${fromTodo.status==='completed'?'✅':''}</div>`:''}
      ${relatedTodo?`<div class="linked-todo" onclick="switchPage('todos')">
        <span>📋 关联待办：${esc(relatedTodo.text.slice(0,25))}</span>
        <span style="font-size:11px;color:#888">${relatedTodo.status==='completed'?'✅ 已完成':relatedTodo.isToday?'📌 今日待办':'📦 待办库'}</span>
      </div>`:''}
      ${linkedThoughts.length?`<div style="margin-top:4px">${linkedThoughts.slice(0,2).map(lt=>`<div style="font-size:11px;color:#888;padding:2px 0">💭 关联思绪：${esc(lt.text.slice(0,25))}</div>`).join('')}${linkedThoughts.length>2?`<div style="font-size:10px;color:#aaa">...等${linkedThoughts.length}条</div>`:''}</div>`:''}
    </div>`;
  }).join('') + `<div style="text-align:center;margin-top:12px"><button class="btn-primary" onclick="showAddEntryInProj('${currentProjTab}')">+ 添加${label}</button></div>`;
}

function switchProjTab(tab){currentProjTab=tab;renderProject();}

function showAddEntryInProj(type){
  const n=nc(); const labels={action:n.action,problem:n.problem,learning:n.learning,review:n.review};
  if(type==='action'||type==='problem'||type==='learning'){
    showEntryWithProcessModal('添加'+(labels[type]||type),'',async(txt,imp,procId,note)=>{await Store.addEntry(currentCapId,currentProjId,type,txt,imp,null,procId,null,note);await refresh();});
  } else {
    showEntryWithNoteModal('添加'+(labels[type]||type),'',async(txt,note)=>{await Store.addEntry(currentCapId,currentProjId,type,txt,0,null,null,null,note);await refresh();});
  }
}

function editProjEntry(eid){
  const proj=getProj();if(!proj)return;
  const e=proj.entries[currentProjTab]?.find(x=>x.id===eid);if(!e)return;
  const n=nc(); const labels={action:n.action,problem:n.problem,learning:n.learning,review:n.review};
  if(currentProjTab==='action'||currentProjTab==='problem'||currentProjTab==='learning'){
    showEntryWithProcessModal('修改'+(labels[currentProjTab]||currentProjTab),e.text,async(txt,imp,procId,note)=>{await Store.updateEntry(currentCapId,currentProjId,currentProjTab,eid,txt,imp,procId,note);await refresh();},e.importance,e.relatedProcessId,e.note);
  } else {
    showEntryWithNoteModal('修改'+(labels[currentProjTab]||currentProjTab),e.text,async(txt,note)=>{await Store.updateEntry(currentCapId,currentProjId,currentProjTab,eid,e.text,undefined,undefined,note);await refresh();},e.note);
  }
}

/** 从已完成待办创建条目 */
function showEntryFromTodoModal(eid){
  const proj=getProj();if(!proj)return;
  const e=proj.entries[currentProjTab]?.find(x=>x.id===eid);if(!e)return;
  const procItems = (proj.process||[]).filter(p=>!(e.relatedProcessId));
  if(!procItems.length){showToast('当前专项无可关联的已完成待办');return;}
  const overlay=document.createElement('div');overlay.className='modal-overlay';
  overlay.innerHTML=`<div class="modal-box"><h3>🔗 关联已完成待办</h3>
    ${procItems.map(p=>`<label style="display:flex;align-items:center;gap:6px;padding:8px;border-radius:8px;font-size:13px;cursor:pointer;border:1px solid #e0d8d0;margin-bottom:4px" onclick="selectProcForEntry('${p.id}')">
      <input type="radio" name="pRadio" value="${p.id}" style="accent-color:#5a7d6b">
      <span>${esc(p.text.slice(0,40))}</span></label>`).join('')}
    <div class="modal-actions"><button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
    <button class="btn-primary" onclick="confirmProcForEntry('${eid}')">关联</button></div></div>`;
  document.body.appendChild(overlay);
  window._selProcId=null;
  window.selectProcForEntry=id=>{window._selProcId=id;overlay.querySelectorAll('label').forEach(l=>l.style.background='');overlay.querySelector('label:has(input[value="'+id+'"])')?.style.setProperty('background','#f0f7f3');};
  window.confirmProcForEntry=async(entryId)=>{
    const pId=window._selProcId;overlay.remove();
    delete window.selectProcForEntry;delete window.confirmProcForEntry;delete window._selProcId;
    if(!pId)return;
    await Store.updateEntry(currentCapId,currentProjId,currentProjTab,entryId,undefined,undefined,pId);
    const proc=(getProj()?.process||[]).find(x=>x.id===pId);
    if(proc&&!proc.relatedEntryIds.includes(entryId)){proc.relatedEntryIds.push(entryId);await Store.saveAll(appData);}
    await refresh();showToast('✅ 已关联');
  };
}

function showEntryWithProcessModal(title,defaultValue,onSave,existingImp,existingProcId,existingNote){
  const proj=getProj();const procItems=proj?.process||[];
  const overlay=document.createElement('div');overlay.className='modal-overlay';
  let _imp=existingImp||0,_procId=existingProcId||null;
  overlay.innerHTML=`<div class="modal-box" style="max-height:80vh;overflow-y:auto"><h3>${title}</h3>
    <textarea id="mText" rows="3" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(defaultValue)}</textarea>
    ${renderImpPicker(_imp,l=>{_imp=l;})}
    <input id="mNote" placeholder="💬 备注（选填）" value="${esc(existingNote||'')}" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px">
    ${procItems.length>0?`<div style="font-size:12px;color:#666;margin-bottom:6px">关联过程已完成待办（可选）：</div>
      <div style="max-height:120px;overflow-y:auto;margin-bottom:10px">${procItems.map(p=>`
        <label style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;font-size:13px;cursor:pointer;${_procId===p.id?'background:#f0f7f3':''}" onclick="selPE('${p.id}')">
          <input type="radio" name="peR" value="${p.id}" ${_procId===p.id?'checked':''} style="accent-color:#5a7d6b">
          <span style="color:#888">${fmtDate(p.completedAt)}</span> ${esc(p.text.slice(0,30))}</label>`).join('')}
        <label style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;font-size:13px;cursor:pointer;${!_procId?'background:#f0f7f3':''}" onclick="selPE(null)">
          <input type="radio" name="peR" value="" ${!_procId?'checked':''} style="accent-color:#5a7d6b">
          <span style="color:#999">不关联</span></label></div>`:''}
    <div class="modal-actions"><button class="btn-cancel" onclick="closePE()">取消</button>
    <button class="btn-primary" onclick="confirmPE()">保存</button></div></div>`;
  document.body.appendChild(overlay);overlay.querySelector('#mText').focus();
  window.selPE=id=>{_procId=id;overlay.querySelectorAll('label').forEach(l=>l.style.background='');overlay.querySelector('label:has(input[value="'+(id||'')+'"])')?.style.setProperty('background','#f0f7f3');};
  window.confirmPE=()=>{const txt=overlay.querySelector('#mText').value.trim();if(!txt){showToast('内容不能为空');return;}
    const note=overlay.querySelector('#mNote').value.trim();
    overlay.remove();delete window.selPE;delete window.confirmPE;delete window.closePE;onSave(txt,_imp,_procId,note);};
  window.closePE=()=>{overlay.remove();delete window.selPE;delete window.confirmPE;delete window.closePE;};
  overlay.addEventListener('click',e=>{if(e.target===overlay)window.closePE();});
}

function showEntryWithNoteModal(title,defaultValue,onSave,existingNote){
  const overlay=document.createElement('div');overlay.className='modal-overlay';
  overlay.innerHTML=`<div class="modal-box"><h3>${title}</h3>
    <textarea id="mText" rows="3" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;resize:vertical">${esc(defaultValue)}</textarea>
    <input id="mNote" placeholder="💬 备注（选填）" value="${esc(existingNote||'')}" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px">
    <div class="modal-actions"><button class="btn-cancel" onclick="closeNoteM()">取消</button>
    <button class="btn-primary" onclick="confirmNoteM()">保存</button></div></div>`;
  document.body.appendChild(overlay);overlay.querySelector('#mText').focus();
  window.confirmNoteM=()=>{const txt=overlay.querySelector('#mText').value.trim();if(!txt){showToast('内容不能为空');return;}
    const note=overlay.querySelector('#mNote').value.trim();
    overlay.remove();delete window.confirmNoteM;delete window.closeNoteM;onSave(txt,note);};
  window.closeNoteM=()=>{overlay.remove();delete window.confirmNoteM;delete window.closeNoteM;};
  overlay.addEventListener('click',e=>{if(e.target===overlay)window.closeNoteM();});
}

function showCreateTodoFromEntry(eid){
  const proj=getProj();if(!proj)return;
  const e=proj.entries[currentProjTab]?.find(x=>x.id===eid);if(!e)return;
  showEditModalWithNote('📋 由此创建待办',e.text,e.note,async(txt,note)=>{
    await Store.addTodo(txt,0,{capId:currentCapId,projId:currentProjId,entryType:currentProjTab,entryId:eid},note);
    await refresh();
    const newTodo = appData.todos[appData.todos.length-1];
    if(newTodo){await Store.updateEntry(currentCapId,currentProjId,currentProjTab,eid,undefined,undefined);e.relatedTodoId=newTodo.id;await Store.saveAll(appData);}
    await refresh();showToast('✅ 待办已创建');
  });
}

// ==================== 思绪 ====================

function renderThoughts(){
  const list=document.getElementById('thoughtList');
  const q=document.getElementById('thoughtSearch')?.value?.toLowerCase().trim()||'';
  let thoughts=appData.thoughts;
  if(q)thoughts=thoughts.filter(t=>t.text.toLowerCase().includes(q)||(t.tags||[]).some(tag=>tag.toLowerCase().includes(q)));
  thoughts=sortByImpThenTime(thoughts);
  if(!thoughts.length){list.innerHTML='<div class="empty-state">'+(q?'没有找到匹配的思绪':'💭 暂无思绪')+'</div>';return;}
  list.innerHTML=thoughts.map(t=>{
    const linkInfo = resolveThoughtLink(t);
    return `<div class="entry-card"><div class="entry-meta"><span>${fmtDate(t.createdAt)}${impStars(t.importance)}</span>
      <span class="entry-actions"><button class="icon-btn" onclick="editThought('${t.id}')">✏️</button>
      <button class="icon-btn" onclick="showThoughtLinkModal('${t.id}')" title="关联">🔗</button>
      <button class="icon-btn" onclick="deleteItem('thought','${t.id}')">🗑️</button></span></div>
      <div class="entry-text">${esc(t.text)}</div>
      ${t.note?`<div style="font-size:12px;color:#888;margin-top:2px">💬 ${esc(t.note)}</div>`:''}
      ${(t.tags||[]).length?`<div style="margin-top:6px">${t.tags.map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')}</div>`:''}
      ${linkInfo?`<div class="linked-todo" onclick="${linkInfo.type==='todo'?"switchPage('todos')":linkInfo.type==='entry'?`openProject('${linkInfo.capId}','${linkInfo.projId}')`:`switchPage('ability')`}">
        <span>${linkInfo.icon} 关联${linkInfo.label}：${esc(linkInfo.text.slice(0,30))}</span>
        <span style="font-size:10px;color:#aaa">🔗</span>
      </div>`:''}
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
    <input id="mThoughtNote" placeholder="💬 备注（选填）" value="${esc(existingNote||'')}" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px">
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
  let options=[];
  // 能力级
  appData.capabilities.forEach(c=>{
    options.push({type:'capability',capId:c.id,label:'💪 '+c.name,value:c.id});
    // 专项级
    c.projects.forEach(p=>{
      options.push({type:'project',capId:c.id,projId:p.id,label:'📂 '+c.name+' > '+p.name,value:'proj_'+p.id});
      // 条目级
      ['action','problem','learning'].forEach(et=>{
        const typeLabels={action:n.action,problem:n.problem,learning:n.learning};
        const typeIcons={action:'🏃',problem:'⚠️',learning:'📖'};
        (p.entries[et]||[]).forEach(e=>{
          options.push({type:'entry',capId:c.id,projId:p.id,entryType:et,entryId:e.id,
            label:typeIcons[et]+' '+c.name+' > '+p.name+' > '+e.text.slice(0,20),value:et+'_'+e.id});
        });
      });
    });
  });
  // 待办
  appData.todos.filter(x=>x.status==='active').forEach(todo=>{
    options.push({type:'todo',todoId:todo.id,label:'📋 '+todo.text.slice(0,30),value:'todo_'+todo.id});
  });

  const currentType=t.relatedTodoId?'todo':t.relatedEntryId?'entry':t.relatedProjId?'project':t.relatedCapId?'capability':'';
  const currentVal=t.relatedTodoId?('todo_'+t.relatedTodoId):t.relatedEntryId?(t.relatedEntryType+'_'+t.relatedEntryId):t.relatedProjId?('proj_'+t.relatedProjId):t.relatedCapId||'';

  const overlay=document.createElement('div');overlay.className='modal-overlay';
  overlay.innerHTML=`<div class="modal-box" style="max-height:80vh;overflow-y:auto"><h3>🔗 关联到</h3>
    <p style="font-size:12px;color:#999;margin-bottom:10px">选择要关联的能力/专项/条目/待办</p>
    <div style="max-height:300px;overflow-y:auto">
      <label style="display:flex;align-items:center;gap:6px;padding:8px;border-radius:8px;font-size:13px;cursor:pointer;border:1px solid #e0d8d0;margin-bottom:4px;${!currentVal?'background:#f0f7f3':''}" onclick="selLinkOpt(null)">
        <input type="radio" name="linkR" value="" ${!currentVal?'checked':''} style="accent-color:#5a7d6b">
        <span style="color:#999">无关联</span></label>
      ${options.map(o=>`<label style="display:flex;align-items:center;gap:6px;padding:8px;border-radius:8px;font-size:13px;cursor:pointer;border:1px solid #e0d8d0;margin-bottom:4px;${currentVal===o.value?'background:#f0f7f3':''}" onclick="selLinkOpt('${o.value}','${o.type}','${o.capId||''}','${o.projId||''}','${o.entryType||''}','${o.entryId||''}','${o.todoId||''}')">
        <input type="radio" name="linkR" value="${o.value}" ${currentVal===o.value?'checked':''} style="accent-color:#5a7d6b">
        <span>${esc(o.label)}</span></label>`).join('')}
    </div>
    <div class="modal-actions"><button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
    <button class="btn-primary" onclick="confirmThoughtLink('${thoughtId}')">保存</button></div></div>`;
  document.body.appendChild(overlay);
  window._linkSel={type:currentType,capId:t.relatedCapId,projId:t.relatedProjId,entryType:t.relatedEntryType,entryId:t.relatedEntryId,todoId:t.relatedTodoId};
  window.selLinkOpt=(val,type,capId,projId,entryType,entryId,todoId)=>{
    if(!val){window._linkSel={type:null};}else{window._linkSel={type,capId:capId||null,projId:projId||null,entryType:entryType||null,entryId:entryId||null,todoId:todoId||null};}
    overlay.querySelectorAll('label').forEach(l=>l.style.background='');
    if(val)overlay.querySelector(`label:has(input[value="${val}"])`)?.style.setProperty('background','#f0f7f3');
    else overlay.querySelector('label:first-child')?.style.setProperty('background','#f0f7f3');
  };
  window.confirmThoughtLink=async(id)=>{
    const s=window._linkSel;overlay.remove();
    delete window.selLinkOpt;delete window.confirmThoughtLink;delete window._linkSel;
    await Store.linkThought(id,s.capId,s.projId,s.entryType,s.entryId,s.todoId);
    await refresh();showToast('✅ 关联已更新');
  };
}

// ==================== 待办 ====================

function renderTodos(){
  const con=document.getElementById('todoContent');const n=nc();
  const{today:td,library:lib,completed:comp}=Store.getTodos(appData);
  const tdS=sortByImpThenTime(td),libS=sortByImpThenTime(lib),compS=[...comp].sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt));
  con.innerHTML=`
    <div class="todo-section"><div class="todo-header">📌 今日待办 <span class="todo-count">${tdS.length}</span></div>
      ${tdS.length===0?'<div class="empty-state" style="padding:16px">- 无 -</div>':tdS.map(t=>renderTodoCard(t,true)).join('')}</div>
    <div class="todo-section"><div class="todo-header">📦 待办库 <span class="todo-count">${libS.length}</span></div>
      ${libS.length===0?'<div class="empty-state" style="padding:16px">- 无 -</div>':libS.map(t=>renderTodoCard(t,false)).join('')}</div>
    <div class="todo-section"><div class="todo-header">✅ 已完成 <span class="todo-count">${compS.length}</span></div>
      ${compS.length===0?'<div class="empty-state" style="padding:16px">- 无 -</div>':compS.map(t=>`
        <div class="todo-card" style="opacity:0.6">
          <div style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:#5a7d6b">✅</div>
          <div class="todo-body"><div class="todo-text"><s>${esc(t.text)}</s></div>${t.note?`<div style="font-size:11px;color:#aaa;margin-top:2px">💬 ${esc(t.note)}</div>`:''}<div class="todo-source">完成于 ${fmtDate(t.completedAt)}</div></div>
          <div class="todo-actions"><button class="icon-btn" onclick="deleteItem('todo','${t.id}')">🗑️</button></div>
        </div>`).join('')}
    </div>`;
}

function renderTodoCard(t,isToday){
  const srcEntry = t.sourceEntryId && t.sourceCapId && t.sourceProjId ? (()=>{
    const cap=appData.capabilities.find(c=>c.id===t.sourceCapId);
    const proj=cap?.projects.find(p=>p.id===t.sourceProjId);
    if(!proj)return null;
    return (proj.entries[t.sourceEntryType]||[]).find(e=>e.id===t.sourceEntryId);
  })() : null;
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
  const linkedThoughts = findLinkedThoughts({ todoId:t.id });

  let srcHtml = '';
  if(srcEntry){
    srcHtml = `<div class="linked-todo" style="font-size:11px;margin-top:4px">
      <span>📎 来源：${esc(srcEntry.text.slice(0,30))}</span>
    </div>`;
  }
  let genHtml = '';
  if(genEntries.length){
    genHtml = `<div style="margin-top:6px;border-top:1px solid #f0ece7;padding-top:6px">
      <div style="font-size:11px;color:#888;margin-bottom:4px">📝 关联条目 (${genEntries.length})</div>
      ${genEntries.map(ge=>`<div style="font-size:12px;color:#333;padding:3px 6px;background:#f8f6f3;border-radius:6px;margin-bottom:2px">${esc(ge.entry.text.slice(0,35))}</div>`).join('')}
    </div>`;
  }
  let thHtml='';
  if(linkedThoughts.length){
    thHtml=`<div style="margin-top:4px">${linkedThoughts.slice(0,2).map(lt=>`<div style="font-size:11px;color:#888;padding:2px 0">💭 关联思绪：${esc(lt.text.slice(0,25))}</div>`).join('')}${linkedThoughts.length>2?`<div style="font-size:10px;color:#aaa">...等${linkedThoughts.length}条</div>`:''}</div>`;
  }

  return `<div class="todo-card">
    <input type="checkbox" onchange="completeTodo('${t.id}')">
    <div class="todo-body">
      <div class="todo-text">${esc(t.text)}${impStars(t.importance)}</div>
      ${t.note?`<div style="font-size:12px;color:#888;margin-top:2px">💬 ${esc(t.note)}</div>`:''}
      ${srcHtml}${genHtml}${thHtml}
    </div>
    <div class="todo-actions">
      ${isToday?`<button class="todo-move-btn" onclick="moveTodoToLib('${t.id}')">移回库</button>`
        :`<button class="todo-move-btn" onclick="moveTodoToToday('${t.id}')">今日</button>`}
      <button class="icon-btn" onclick="editTodo('${t.id}')">✏️</button>
      <button class="icon-btn" onclick="deleteItem('todo','${t.id}')">🗑️</button>
    </div>
  </div>`;
}

function showAddTodoModal(){showEditModalWithNote('📋 新建待办','',null,async(txt,note)=>{await Store.addTodo(txt,0,{},note);await refresh();},0);}
function editTodo(id){const t=appData.todos.find(x=>x.id===id);
  showEditModalWithNote('编辑待办',t.text,t.note,async(txt,note)=>{await Store.updateTodo(id,{text:txt,note:note});await refresh();},t.importance,async imp=>{await Store.updateTodo(id,{importance:imp});await refresh();});}

async function completeTodo(id){
  const todo=appData.todos.find(t=>t.id===id);
  const caps=appData.capabilities;
  let targetCapId=todo.sourceCapId, targetProjId=todo.sourceProjId;
  if(!targetCapId&&caps.length) targetCapId=caps[0].id;
  const cap=caps.find(c=>c.id===targetCapId);
  if(!targetProjId&&cap?.projects.length) targetProjId=cap.projects[0].id;
  if(targetCapId&&targetProjId){
    await Store.completeTodo(id,targetCapId,targetProjId);
    await refresh();
    showToast('✅ 已完成！可在过程中添加后续条目');
  } else {
    await Store.completeTodo(id,null,null);
    await refresh();showToast('✅ 已完成');
  }
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
    <input id="modalNote" placeholder="💬 备注（选填）" value="${esc(existingNote||'')}" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px">
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
    entry:'确认删除这条记录？',thought:'确认删除这条思绪？',todo:'确认删除此待办？',goal:'确认删除这个目标？'};
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
    }
  });
}

// ==================== 编辑函数（修复权重覆盖bug） ====================

function editLiberation(id){const e=appData.liberationEntries.find(x=>x.id===id);showEditModal('编辑',e.text,async txt=>{await Store.updateLiberationEntry(id,txt);await refresh();});}
function editDiplomacy(id){const e=appData.diplomacyEntries.find(x=>x.id===id);showEditModal('编辑',e.text,async txt=>{await Store.updateDiplomacyEntry(id,txt);await refresh();});}
function editCap(id){const c=appData.capabilities.find(x=>x.id===id);
  showEditModal('修改'+nc().capability,c.name,async txt=>{await Store.updateCapability(id,txt);await refresh();},
    c.importance,async imp=>{await Store.updateCapability(id,undefined,imp);await refresh();});}
function showAddProjectModal(capId){showEditModal('新建'+nc().project,'',async txt=>{await Store.addProject(capId,txt,0);await refresh();});}
function editProj(capId,projId){const cap=appData.capabilities.find(c=>c.id===capId);const p=cap?.projects.find(x=>x.id===projId);
  showEditModal('修改'+nc().project,p?.name||'',async txt=>{await Store.updateProject(capId,projId,txt);await refresh();},
    p?.importance||0,async imp=>{await Store.updateProject(capId,projId,undefined,imp);await refresh();});}
function showAddModal(module){const n=nc();const name=module==='liberation'?n.module1:n.module3;
  showEditModal('添加'+name+'记录','',async txt=>{if(module==='liberation')await Store.addLiberationEntry(txt);else await Store.addDiplomacyEntry(txt);await refresh();});}
function showAddCapabilityModal(){const n=nc();showEditModal('新建'+n.capability,'',async txt=>{await Store.addCapability(txt,0);await refresh();});}

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
