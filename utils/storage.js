// ── Storage layer (wx.setStorageSync) ────────────────────

function initStorage() {
  const defaults = {
    categories: [],
    files: [],
    fileIdSeq: 0,
    catIdSeq: 0,
    memos: [],
    memoIdSeq: 0,
    workflows: [],
    wfIdSeq: 0,
    workflowNodes: [],
    wfNodeIdSeq: 0
  };
  Object.keys(defaults).forEach(key => {
    try {
      const val = wx.getStorageSync(key);
      if (val === '' || val === undefined || val === null) wx.setStorageSync(key, defaults[key]);
    } catch (e) {
      wx.setStorageSync(key, defaults[key]);
    }
  });
}

function nextId(key) {
  let seq = Number(wx.getStorageSync(key)) || 0;
  seq++;
  wx.setStorageSync(key, seq);
  return seq;
}

// ── Categories ──────────────────────────────
function getCategories() {
  return wx.getStorageSync('categories') || [];
}

function addCategory(name, color) {
  const id = nextId('catIdSeq');
  const cats = getCategories();
  cats.push({ id, name, color, createdAt: Date.now() });
  wx.setStorageSync('categories', cats);
  return id;
}

function deleteCategory(id) {
  let cats = getCategories();
  cats = cats.filter(c => c.id !== id);
  wx.setStorageSync('categories', cats);
}

// ── Files ────────────────────────────────────
function getFiles(categoryId) {
  const files = wx.getStorageSync('files') || [];
  if (categoryId != null) return files.filter(f => f.categoryId === categoryId);
  return files;
}

function getFileById(id) {
  const files = wx.getStorageSync('files') || [];
  return files.find(f => f.id === id) || null;
}

async function addFile(name, categoryId, type, filePath, size) {
  const id = nextId('fileIdSeq');
  const files = wx.getStorageSync('files') || [];
  const fs = wx.getFileSystemManager();
  const savedPath = wx.env.USER_DATA_PATH + '/files/' + id + '_' + name;

  // Ensure directory exists
  try { fs.accessSync(wx.env.USER_DATA_PATH + '/files'); } catch (e) {
    try { fs.mkdirSync(wx.env.USER_DATA_PATH + '/files', true); } catch (e2) {}
  }

  try {
    await new Promise((resolve, reject) => {
      fs.copyFile({ srcPath: filePath, destPath: savedPath, success: resolve, fail: reject });
    });
  } catch (e) {
    console.warn('File copy failed:', e);
  }

  files.push({ id, name, categoryId, type, filePath: savedPath, size, createdAt: Date.now() });
  wx.setStorageSync('files', files);
  return id;
}

function deleteFile(id) {
  let files = wx.getStorageSync('files') || [];
  const file = files.find(f => f.id === id);
  if (file && file.filePath) {
    try { wx.getFileSystemManager().unlinkSync(file.filePath); } catch (e) {}
  }
  files = files.filter(f => f.id !== id);
  wx.setStorageSync('files', files);
}

function updateFileName(id, newName) {
  let files = wx.getStorageSync('files') || [];
  const file = files.find(f => f.id === id);
  if (!file) throw new Error('文件不存在');
  file.name = newName;
  wx.setStorageSync('files', files);
}

// ── Memos ────────────────────────────────────
function getMemos() {
  return wx.getStorageSync('memos') || [];
}

function addMemo(title, content, deadline, autoDelete) {
  const id = nextId('memoIdSeq');
  const memos = getMemos();
  memos.push({ id, title, content, deadline: deadline || null, autoDelete: !!autoDelete, createdAt: Date.now() });
  wx.setStorageSync('memos', memos);
  return id;
}

function deleteMemo(id) {
  let memos = getMemos();
  memos = memos.filter(m => m.id !== id);
  wx.setStorageSync('memos', memos);
}

function updateMemo(id, updates) {
  let memos = getMemos();
  const memo = memos.find(m => m.id === id);
  if (!memo) throw new Error('备忘录不存在');
  if (updates.title !== undefined) memo.title = updates.title;
  if (updates.content !== undefined) memo.content = updates.content;
  if (updates.deadline !== undefined) memo.deadline = updates.deadline;
  if (updates.autoDelete !== undefined) memo.autoDelete = updates.autoDelete;
  wx.setStorageSync('memos', memos);
}

// ── Workflows ────────────────────────────────
function getWorkflows() {
  return wx.getStorageSync('workflows') || [];
}

function getWorkflowsByType(type) {
  return getWorkflows().filter(w => (w.type || 'workflow') === type);
}

function addWorkflow(name, type) {
  const t = type || 'workflow';
  const wfId = nextId('wfIdSeq');
  const wfs = getWorkflows();
  wfs.push({ id: wfId, name, type: t, createdAt: Date.now() });
  wx.setStorageSync('workflows', wfs);

  const nodeId = nextId('wfNodeIdSeq');
  const nodes = getWorkflowNodes();
  nodes.push({
    id: nodeId, workflowId: wfId, parentId: null, direction: null,
    title: name, description: '', shape: 'rounded',
    size: t === 'knowledge' ? 'large' : 'medium',
    posX: null, posY: null, done: false, createdAt: Date.now()
  });
  wx.setStorageSync('workflowNodes', nodes);
  return wfId;
}

function deleteWorkflow(id) {
  let wfs = getWorkflows();
  wfs = wfs.filter(w => w.id !== id);
  wx.setStorageSync('workflows', wfs);
  let nodes = getWorkflowNodes();
  nodes = nodes.filter(n => n.workflowId !== id);
  wx.setStorageSync('workflowNodes', nodes);
}

// ── Workflow Nodes ───────────────────────────
function getWorkflowNodes(workflowId) {
  const nodes = wx.getStorageSync('workflowNodes') || [];
  if (workflowId != null) return nodes.filter(n => n.workflowId === workflowId);
  return nodes;
}

function addWorkflowNode(workflowId, parentId, direction, title, desc, shape, size) {
  const id = nextId('wfNodeIdSeq');
  const nodes = getWorkflowNodes();
  nodes.push({
    id, workflowId, parentId, direction,
    title, description: desc || '',
    shape: shape || 'rounded', size: size || 'medium',
    posX: null, posY: null, done: false, createdAt: Date.now()
  });
  wx.setStorageSync('workflowNodes', nodes);
  return id;
}

function updateWorkflowNode(id, updates) {
  let nodes = getWorkflowNodes();
  const node = nodes.find(n => n.id === id);
  if (!node) throw new Error('节点不存在');
  ['title', 'description', 'done', 'parentId', 'direction', 'shape', 'size', 'posX', 'posY'].forEach(f => {
    if (updates[f] !== undefined) node[f] = updates[f];
  });
  wx.setStorageSync('workflowNodes', nodes);
}

function deleteWorkflowNode(id) {
  let nodes = getWorkflowNodes();
  const toDelete = [];
  function collectDescendants(pid) {
    nodes.forEach(n => {
      if (n.parentId === pid) { toDelete.push(n.id); collectDescendants(n.id); }
    });
  }
  collectDescendants(id);
  toDelete.push(id);
  nodes = nodes.filter(n => toDelete.indexOf(n.id) === -1);
  wx.setStorageSync('workflowNodes', nodes);
}

module.exports = {
  initStorage,
  getCategories, addCategory, deleteCategory,
  getFiles, getFileById, addFile, deleteFile, updateFileName,
  getMemos, addMemo, deleteMemo, updateMemo,
  getWorkflows, getWorkflowsByType, addWorkflow, deleteWorkflow,
  getWorkflowNodes, addWorkflowNode, updateWorkflowNode, deleteWorkflowNode
};
