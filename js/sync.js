/* ===== GitHub 云同步模块 ===== */

const Sync = {
  SETTINGS_KEY: 'ability_lines_sync_settings',
  MAX_BACKUPS: 5,
  DATA_KEY: 'allData',
  BACKUP_INDEX_KEY: 'sync_backup_index',

  // ==================== 设置管理 ====================

  getSettings() {
    try { return JSON.parse(localStorage.getItem(this.SETTINGS_KEY)) || {}; }
    catch (e) { return {}; }
  },

  saveSettings(s) { localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(s)); },

  /** 从 GitHub Pages URL 自动检测用户名和仓库名 */
  autoDetectRepo() {
    const m = window.location.hostname.match(/^([^.]+)\.github\.io$/);
    if (!m) return null;
    const username = m[1];
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const repo = pathParts[0] || username + '.github.io';
    return { username, repo };
  },

  /** 测试连接是否正常 */
  async testConnection() {
    const s = this.getSettings();
    if (!s.token || !s.username || !s.repo) return { ok: false, msg: '请填写完整信息' };
    try {
      const resp = await fetch('https://api.github.com/repos/' + s.username + '/' + s.repo, {
        headers: { 'Authorization': 'Bearer ' + s.token, 'Accept': 'application/vnd.github.v3+json' }
      });
      if (resp.status === 401) return { ok: false, msg: 'Token 无效' };
      if (resp.status === 404) return { ok: false, msg: '仓库不存在' };
      if (!resp.ok) return { ok: false, msg: '错误 ' + resp.status };
      const d = await resp.json();
      return { ok: true, msg: '连接成功：' + d.full_name };
    } catch (e) { return { ok: false, msg: '网络错误：' + (e.message || e) }; }
  },

  // ==================== 编解码（支持中文） ====================

  utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
  },

  base64ToUtf8(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  },

  // ==================== GitHub API ====================

  /** 构建同步文件在 GitHub 上的路径 */
  getApiUrl() {
    const s = this.getSettings();
    const fp = (s.filePath || 'sync-data.json').replace(/^\/+/, '');
    return 'https://api.github.com/repos/' + s.username + '/' + s.repo + '/contents/' + fp;
  },

  /** 获取云端文件内容（返回 json 或 null） */
  async fetchCloudFile() {
    const s = this.getSettings();
    const resp = await fetch(this.getApiUrl(), {
      headers: { 'Authorization': 'Bearer ' + s.token, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (resp.status === 404) return null;
    if (resp.status === 401) throw new Error('Token 无效');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  },

  // ==================== 拉取 ====================

  async pull() {
    const s = this.getSettings();
    if (!s.token || !s.username || !s.repo) { showToast('请先配置同步设置'); return; }
    showToast('正在拉取...');
    try {
      await this.createBackup('拉取前备份');
      const file = await this.fetchCloudFile();
      if (!file) { showToast('云端暂无数据'); return; }
      const data = JSON.parse(this.base64ToUtf8(file.content));
      await Store.set(this.DATA_KEY, data);
      this.saveSettings({ ...s, lastPull: new Date().toISOString() });
      appData = await Store.init();
      updateAllTitles(); renderPage(); updateNav();
      showToast('拉取成功');
    } catch (e) { showToast('拉取失败：' + e.message); }
  },

  // ==================== 推送 ====================

  async push() {
    const s = this.getSettings();
    if (!s.token || !s.username || !s.repo) { showToast('请先配置同步设置'); return; }
    showToast('正在推送...');
    try {
      await this.createBackup('推送前备份');
      const data = await Store.getAll();
      if (!data) { showToast('没有数据可推送'); return; }
      const content = this.utf8ToBase64(JSON.stringify(data, null, 2));
      let sha = null;
      try { const f = await this.fetchCloudFile(); if (f) sha = f.sha; } catch (_) {}
      const resp = await fetch(this.getApiUrl(), {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + s.token, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '再塑法典同步 ' + new Date().toLocaleString('zh-CN'), content: content, sha: sha })
      });
      if (resp.status === 401) throw new Error('Token 无效');
      if (resp.status === 409) throw new Error('冲突，请先拉取最新数据');
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.message || ('HTTP ' + resp.status)); }
      this.saveSettings({ ...s, lastPush: new Date().toISOString() });
      showToast('推送成功');
    } catch (e) { showToast('推送失败：' + e.message); }
  },

  // ==================== 备份管理 ====================

  /** 获取备份索引（元数据列表） */
  async getBackupIndex() {
    try { return await Store.get(this.BACKUP_INDEX_KEY) || []; }
    catch (e) { return []; }
  },

  /** 创建备份（含自动清理，保留最近 N 份） */
  async createBackup(label) {
    const data = await Store.getAll();
    if (!data) return null;
    const id = Date.now().toString();
    const entry = { id: id, timestamp: new Date().toISOString(), label: label || '自动备份' };
    const db = Store.getDB();
    const index = await this.getBackupIndex();
    index.unshift(entry);
    let removedIds = [];
    while (index.length > this.MAX_BACKUPS) removedIds.push(index.pop().id);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ key: 'sync_backup_' + id, value: JSON.parse(JSON.stringify(data)) });
      removedIds.forEach(rid => store.delete('sync_backup_' + rid));
      store.put({ key: this.BACKUP_INDEX_KEY, value: index });
      tx.oncomplete = () => resolve(entry);
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  /** 恢复指定备份 */
  async restoreBackup(backupId) {
    const db = Store.getDB();
    const raw = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('sync_backup_' + backupId);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = (e) => reject(e.target.error);
    });
    if (!raw) throw new Error('备份数据不存在');
    await Store.set(this.DATA_KEY, raw);
  },

  /** 删除指定备份 */
  async deleteBackup(backupId) {
    const db = Store.getDB();
    const index = await this.getBackupIndex();
    const idx = index.findIndex(b => b.id === backupId);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete('sync_backup_' + backupId);
      if (idx >= 0) { index.splice(idx, 1); store.put({ key: this.BACKUP_INDEX_KEY, value: index }); }
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }
};

// ==================== 同步设置弹窗 ====================

function showSyncSettingsModal() {
  document.getElementById('dropdownMenu').classList.add('hidden');
  const s = Sync.getSettings();
  const auto = Sync.autoDetectRepo();
  const un = s.username || (auto ? auto.username : '');
  const rp = s.repo || (auto ? auto.repo : '');
  const tk = s.token || '';
  const fp = s.filePath || 'sync-data.json';
  const lp = s.lastPull ? fmtDate(new Date(s.lastPull)) : '从未';
  const lpu = s.lastPush ? fmtDate(new Date(s.lastPush)) : '从未';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal-box" style="max-height:85vh;overflow-y:auto"><h3>同步设置</h3>'
    + '<p style="font-size:12px;color:#999;margin-bottom:12px">通过 GitHub 仓库实现手机与电脑数据同步</p>'
    + '<div style="margin-bottom:10px"><label style="font-size:12px;color:#666">GitHub 用户名</label>'
    + '<input id="syncUser" value="' + esc(un) + '" placeholder="例如 Velenda00" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:14px;outline:none;margin-top:4px"></div>'
    + '<div style="margin-bottom:10px"><label style="font-size:12px;color:#666">仓库名</label>'
    + '<input id="syncRepo" value="' + esc(rp) + '" placeholder="例如 ability-lines" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:14px;outline:none;margin-top:4px"></div>'
    + '<div style="margin-bottom:10px"><label style="font-size:12px;color:#666">Personal Access Token</label>'
    + '<input id="syncToken" type="password" value="' + esc(tk) + '" placeholder="在 GitHub Settings > Tokens 创建" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:14px;outline:none;margin-top:4px"></div>'
    + '<div style="margin-bottom:12px"><label style="font-size:12px;color:#666">同步文件路径</label>'
    + '<input id="syncPath" value="' + esc(fp) + '" placeholder="sync-data.json" style="width:100%;border:1px solid #e0d8d0;border-radius:10px;padding:8px 12px;font-size:14px;outline:none;margin-top:4px"></div>'
    + (auto ? '<div style="font-size:11px;color:#5a7d6b;margin-bottom:12px">已自动检测到仓库：' + esc(auto.username) + '/' + esc(auto.repo) + '</div>' : '')
    + '<div style="font-size:11px;color:#888;margin-bottom:12px;padding:8px;background:#f8f6f3;border-radius:8px">'
    + 'Token 创建步骤：GitHub 右上角头像 → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → 勾选 <b>public_repo</b> → 生成并复制</div>'
    + '<div style="font-size:11px;color:#888;margin-bottom:12px">上次推送：' + lp + ' | 上次拉取：' + lpu + '</div>'
    + '<div class="modal-actions">'
    + '<button class="btn-cancel" onclick="this.closest(\'.modal-overlay\').remove()">取消</button>'
    + '<button id="syncTestBtn" class="btn-cancel" style="background:#5a7d6b;color:white;border:none">测试连接</button>'
    + '<button class="btn-primary" onclick="saveSyncSettings()">保存</button></div></div>';
  document.body.appendChild(overlay);

  window.syncTest = async function() {
    const btn = document.getElementById('syncTestBtn');
    btn.textContent = '测试中...'; btn.disabled = true;
    const r = await Sync.testConnection();
    btn.textContent = r.msg; btn.disabled = false;
    btn.style.background = r.ok ? '#5a7d6b' : '#c0392b';
    setTimeout(() => { btn.textContent = '测试连接'; btn.style.background = '#5a7d6b'; }, 3000);
  };
  btn = document.getElementById('syncTestBtn'); // intentionally without const/var to use outer reference
  overlay.querySelector('#syncTestBtn').addEventListener('click', function() {
    Sync.testConnection().then(r => {
      this.textContent = r.msg;
      this.style.background = r.ok ? '#5a7d6b' : '#c0392b';
      setTimeout(() => { this.textContent = '测试连接'; this.style.background = '#5a7d6b'; }, 3000);
    });
  });

  window.saveSyncSettings = async function() {
    const token = overlay.querySelector('#syncToken').value.trim();
    const username = overlay.querySelector('#syncUser').value.trim();
    const repo = overlay.querySelector('#syncRepo').value.trim();
    const filePath = overlay.querySelector('#syncPath').value.trim() || 'sync-data.json';
    if (!token || !username || !repo) { showToast('请填写完整信息'); return; }
    Sync.saveSettings({ token: token, username: username, repo: repo, filePath: filePath,
      lastPull: Sync.getSettings().lastPull, lastPush: Sync.getSettings().lastPush });
    overlay.remove(); delete window.saveSyncSettings;
    showToast('同步设置已保存');
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ==================== 备份列表弹窗 ====================

async function showBackupListModal() {
  document.getElementById('dropdownMenu').classList.add('hidden');
  const backups = await Sync.getBackupIndex();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal-box" style="max-height:80vh;overflow-y:auto"><h3>恢复备份</h3>'
    + '<p style="font-size:12px;color:#999;margin-bottom:12px">每次同步操作前自动备份，最多保留 ' + Sync.MAX_BACKUPS + ' 份</p>'
    + '<div id="backupList">'
    + (backups.length === 0
      ? '<div style="text-align:center;padding:20px;color:#aaa">暂无备份</div>'
      : backups.map(b => '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0ece7">'
        + '<div><div style="font-size:13px;color:#333">' + esc(b.label) + '</div>'
        + '<div style="font-size:11px;color:#aaa">' + fmtDate(new Date(b.timestamp)) + '</div></div>'
        + '<div style="display:flex;gap:6px">'
        + '<button class="icon-btn" onclick="restoreBackupItem(\'' + b.id + '\')" title="恢复" style="font-size:12px">恢复</button>'
        + '<button class="icon-btn" onclick="deleteBackupItem(\'' + b.id + '\')" title="删除">删除</button>'
        + '</div></div>').join(''))
    + '</div>'
    + '<div class="modal-actions" style="margin-top:12px"><button class="btn-cancel" onclick="this.closest(\'.modal-overlay\').remove()">关闭</button></div></div>';
  document.body.appendChild(overlay);

  window.restoreBackupItem = async function(id) {
    if (!window.confirmEM_N) {
      // 复用确认弹窗
      showConfirmModal('确定要恢复此备份吗？当前数据将被替换。', async function() {
        try {
          await Sync.restoreBackup(id);
          overlay.remove();
          appData = await Store.init();
          updateAllTitles(); renderPage(); updateNav();
          showToast('备份已恢复');
        } catch (e) { showToast('恢复失败：' + e.message); }
      });
    }
  };

  window.deleteBackupItem = async function(id) {
    showConfirmModal('确定要删除此备份吗？', async function() {
      await Sync.deleteBackup(id);
      overlay.remove();
      showToast('备份已删除');
      showBackupListModal();
    });
  };

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}
