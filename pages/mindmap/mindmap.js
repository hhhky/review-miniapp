const storage = require('../../utils/storage');

// ── Constants ──────────────────────────────
const H_GAP = 80, V_GAP = 40, PAD = 120;
const PLUS_RADIUS = 14;
const DOUBLE_TAP_MS = 300;

function nodeW(n) {
  const s = n.size || 'medium';
  if (s === 'small') return 120;
  if (s === 'large') return 210;
  return 160;
}

function nodeH(n) {
  const s = n.size || 'medium';
  if (s === 'small') return 55;
  if (s === 'large') return 90;
  return 70;
}

// ── Layout Algorithm ────────────────────────
function calcLayout(nodes) {
  const root = nodes.find(n => n.parentId == null);
  if (!root) return { positions: {}, rootId: null, w: 0, h: 0 };

  const positions = {};
  positions[root.id] = {
    x: (root.posX != null) ? root.posX : 0,
    y: (root.posY != null) ? root.posY : 0
  };

  function getBounds(nodeId) {
    const p = positions[nodeId];
    const n = nodes.find(x => x.id === nodeId);
    const w = n ? nodeW(n) : 160;
    const h = n ? nodeH(n) : 70;
    if (!p) return { minX: 0, maxX: w, minY: 0, maxY: h };
    let minX = p.x, maxX = p.x + w, minY = p.y, maxY = p.y + h;
    nodes.filter(c => c.parentId === nodeId).forEach(c => {
      const b = getBounds(c.id);
      minX = Math.min(minX, b.minX); maxX = Math.max(maxX, b.maxX);
      minY = Math.min(minY, b.minY); maxY = Math.max(maxY, b.maxY);
    });
    return { minX, maxX, minY, maxY };
  }

  function layoutChildren(nodeId) {
    const p = positions[nodeId];
    if (!p) return;
    const parentNode = nodes.find(x => x.id === nodeId);
    const pw = parentNode ? nodeW(parentNode) : 160;
    const ph = parentNode ? nodeH(parentNode) : 70;
    const children = nodes.filter(n => n.parentId === nodeId);

    const groups = { up: [], down: [], left: [], right: [] };
    children.forEach(c => {
      const d = c.direction || 'right';
      if (groups[d]) groups[d].push(c);
    });

    let ry = p.y;
    groups.right.forEach(c => {
      if (c.posX != null && c.posY != null) {
        positions[c.id] = { x: c.posX, y: c.posY };
      } else {
        positions[c.id] = { x: p.x + pw + H_GAP, y: ry };
        layoutChildren(c.id);
        ry = getBounds(c.id).maxY + V_GAP;
      }
      layoutChildren(c.id);
    });

    let ly = p.y;
    groups.left.forEach(c => {
      const cw = nodeW(c);
      if (c.posX != null && c.posY != null) {
        positions[c.id] = { x: c.posX, y: c.posY };
      } else {
        positions[c.id] = { x: p.x - cw - H_GAP, y: ly };
        layoutChildren(c.id);
        ly = getBounds(c.id).maxY + V_GAP;
      }
      layoutChildren(c.id);
    });

    let dx = p.x;
    groups.down.forEach(c => {
      if (c.posX != null && c.posY != null) {
        positions[c.id] = { x: c.posX, y: c.posY };
      } else {
        positions[c.id] = { x: dx, y: p.y + ph + V_GAP };
        layoutChildren(c.id);
        dx = getBounds(c.id).maxX + V_GAP;
      }
      layoutChildren(c.id);
    });

    let ux = p.x;
    groups.up.forEach(c => {
      if (c.posX != null && c.posY != null) {
        positions[c.id] = { x: c.posX, y: c.posY };
      } else {
        positions[c.id] = { x: ux, y: p.y - nodeH(c) - V_GAP };
        layoutChildren(c.id);
        ux = getBounds(c.id).maxX + V_GAP;
      }
      layoutChildren(c.id);
    });
  }

  layoutChildren(root.id);

  const bounds = getBounds(root.id);
  const offsetX = -bounds.minX + PAD;
  const offsetY = -bounds.minY + PAD;

  Object.keys(positions).forEach(id => {
    const node = nodes.find(n => n.id === parseInt(id) || n.id === id);
    if (node && node.posX != null && node.posY != null) return;
    positions[id].x += offsetX;
    positions[id].y += offsetY;
  });

  return {
    positions,
    rootId: root.id,
    w: bounds.maxX - bounds.minX + PAD * 2,
    h: bounds.maxY - bounds.minY + PAD * 2
  };
}

// ── Page ────────────────────────────────────
Page({
  data: {
    mindmapType: 'workflow',
    workflows: [],
    currentWorkflowId: null,
    workflowName: '',
    zoom: 1,
    zoomPercent: '100',
    panX: 0,
    panY: 0,

    showWfModal: false,
    wfName: '',

    showNodeModal: false,
    editingNodeId: null,
    nodeForm: { title: '', desc: '', shape: 'rounded', size: 'medium' },

    showQuickAdd: false,
    quickAddParentId: null,
    quickAddDirection: null,
    quickAddDirLabel: '',
    quickAddTitle: '',
    quickAddShape: 'rounded',
    quickAddSize: 'medium'
  },

  _nodes: [],
  _positions: {},
  _layout: null,
  _nodeScreenRects: {},
  _plusRects: {},
  _canvasReady: false,
  _lastTapTime: 0,
  _lastTapNodeId: null,
  _dragState: null,

  noop() {},

  onShow() {
    this.refreshWorkflows();
  },

  async refreshWorkflows() {
    const wfs = storage.getWorkflowsByType(this.data.mindmapType);
    const enriched = wfs.map(w => {
      const nodes = storage.getWorkflowNodes(w.id);
      const doneCount = nodes.filter(n => n.done).length;
      return {
        ...w,
        nodeCount: nodes.length,
        doneCount,
        progress: nodes.length > 0 ? Math.round(doneCount / nodes.length * 100) : 0
      };
    });
    this.setData({ workflows: enriched });
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ mindmapType: type, currentWorkflowId: null });
    this.refreshWorkflows();
  },

  showAddWorkflow() {
    this.setData({ showWfModal: true, wfName: '' });
  },
  hideWfModal() { this.setData({ showWfModal: false }); },
  onWfNameInput(e) { this.setData({ wfName: e.detail.value }); },

  confirmAddWorkflow() {
    const name = this.data.wfName.trim();
    if (!name) { wx.showToast({ title: '请输入名称', icon: 'none' }); return; }
    const id = storage.addWorkflow(name, this.data.mindmapType);
    this.setData({ showWfModal: false });
    wx.showToast({ title: '已创建', icon: 'success' });
    this.enterWorkflow({ currentTarget: { dataset: { id } } });
    this.refreshWorkflows();
  },

  enterWorkflow(e) {
    const id = e.currentTarget.dataset.id;
    const wfs = storage.getWorkflows();
    const w = wfs.find(x => x.id === id);
    if (!w) return;
    this.setData({
      currentWorkflowId: id, workflowName: w.name,
      mindmapType: w.type || 'workflow',
      zoom: 1, zoomPercent: '100', panX: 0, panY: 0
    });
    setTimeout(() => this.initCanvas(), 200);
  },

  backToList() {
    this.setData({ currentWorkflowId: null });
    this.refreshWorkflows();
  },

  async deleteWorkflowItem(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '确定删除该思维导图及其所有节点？', success: r }));
    if (!res.confirm) return;
    storage.deleteWorkflow(id);
    wx.showToast({ title: '已删除', icon: 'success' });
    if (this.data.currentWorkflowId === id) this.setData({ currentWorkflowId: null });
    this.refreshWorkflows();
  },

  // ── Canvas ────────────────────────────────
  async initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#mindmap-canvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) return setTimeout(() => this.initCanvas(), 100);
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      canvas.width = res[0].width * dpr;
      canvas.height = res[0].height * dpr;
      ctx.scale(dpr, dpr);
      this._canvas = canvas;
      this._ctx = ctx;
      this._canvasW = res[0].width;
      this._canvasH = res[0].height;
      this._canvasReady = true;
      this.renderMindMap();
    });
  },

  renderMindMap() {
    if (!this._canvasReady) return;
    const ctx = this._ctx;
    const w = this._canvasW;
    const h = this._canvasH;
    const nodes = storage.getWorkflowNodes(this.data.currentWorkflowId);
    this._nodes = nodes;

    const root = nodes.find(n => n.parentId == null);
    if (!root) {
      const wfs = storage.getWorkflows();
      const wf = wfs.find(w => w.id === this.data.currentWorkflowId);
      if (wf) { storage.addWorkflowNode(this.data.currentWorkflowId, null, null, wf.name, ''); }
      setTimeout(() => this.renderMindMap(), 100);
      return;
    }

    const layout = calcLayout(nodes);
    this._layout = layout;
    this._positions = layout.positions;
    const isKnowledge = this.data.mindmapType === 'knowledge';

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, w, h);

    const zoom = this.data.zoom;
    const panX = this.data.panX;
    const panY = this.data.panY;

    ctx.save();
    ctx.translate(panX + w / 2, panY + h / 2);
    ctx.scale(zoom, zoom);

    let cx = 0, cy = 0;
    if (layout.rootId && layout.positions[layout.rootId]) {
      const rp = layout.positions[layout.rootId];
      const rn = nodes.find(n => n.id === layout.rootId);
      const rw = rn ? nodeW(rn) : 160;
      const rh = rn ? nodeH(rn) : 70;
      cx = -rp.x - rw / 2;
      cy = -rp.y - rh / 2;
    }
    ctx.translate(cx, cy);

    this.drawConnections(ctx, nodes, layout.positions, isKnowledge);
    nodes.forEach(n => {
      const pos = layout.positions[n.id];
      if (!pos) return;
      this.drawNode(ctx, n, pos, isKnowledge);
    });

    ctx.restore();
    this._computeRects(nodes, layout.positions, isKnowledge, cx, cy, w, h, zoom, panX, panY);
  },

  drawConnections(ctx, nodes, positions, isKnowledge) {
    nodes.forEach(n => {
      if (n.parentId == null) return;
      const parentPos = positions[n.parentId];
      const childPos = positions[n.id];
      if (!parentPos || !childPos) return;

      const dir = n.direction || 'right';
      const parentNode = nodes.find(x => x.id === n.parentId);
      const pw = parentNode ? nodeW(parentNode) : 160;
      const ph = parentNode ? nodeH(parentNode) : 70;
      const cw = nodeW(n);
      const ch = nodeH(n);

      let x1, y1, x2, y2;
      if (dir === 'right')      { x1 = parentPos.x + pw; y1 = parentPos.y + ph / 2; x2 = childPos.x; y2 = childPos.y + ch / 2; }
      else if (dir === 'left')  { x1 = parentPos.x; y1 = parentPos.y + ph / 2; x2 = childPos.x + cw; y2 = childPos.y + ch / 2; }
      else if (dir === 'down')  { x1 = parentPos.x + pw / 2; y1 = parentPos.y + ph; x2 = childPos.x + cw / 2; y2 = childPos.y; }
      else                      { x1 = parentPos.x + pw / 2; y1 = parentPos.y; x2 = childPos.x + cw / 2; y2 = childPos.y + ch; }

      const strokeColor = isKnowledge ? '#c4b5fd' : (n.done ? '#a7f3d0' : '#fecdd3');
      const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);

      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      if (dy < 25 || dx < 40) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
      else { ctx.moveTo(x1, y1); ctx.bezierCurveTo(x1 + (x2-x1)*0.4, y1, x2 - (x2-x1)*0.4, y2, x2, y2); }
      ctx.stroke();
    });
  },

  drawNode(ctx, n, pos, isKnowledge) {
    const w = nodeW(n), h = nodeH(n);
    const x = pos.x, y = pos.y;
    const isRoot = n.parentId == null;
    const shape = n.shape || 'rounded';
    const radius = shape === 'pill' ? h / 2 : 12;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (shape === 'pill') {
      ctx.moveTo(x + radius, y); ctx.lineTo(x + w - radius, y);
      ctx.arc(x + w - radius, y + radius, radius, -Math.PI/2, Math.PI/2);
      ctx.lineTo(x + radius, y + h); ctx.arc(x + radius, y + radius, radius, Math.PI/2, -Math.PI/2);
    } else {
      ctx.moveTo(x + radius, y); ctx.lineTo(x + w - radius, y);
      ctx.arcTo(x + w, y, x + w, y + radius, radius);
      ctx.lineTo(x + w, y + h - radius); ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
      ctx.lineTo(x + radius, y + h); ctx.arcTo(x, y + h, x, y + h - radius, radius);
      ctx.lineTo(x, y + radius); ctx.arcTo(x, y, x + radius, y, radius);
    }
    ctx.closePath();
    ctx.fill();

    if (isRoot) {
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, isKnowledge ? 'rgba(37,99,235,0.06)' : 'rgba(37,99,235,0.06)');
      grad.addColorStop(1, isKnowledge ? 'rgba(59,130,246,0.04)' : 'rgba(16,185,129,0.04)');
      ctx.fillStyle = grad; ctx.fill();
    }
    if (n.done && !isKnowledge) { ctx.fillStyle = 'rgba(16,185,129,0.06)'; ctx.fill(); }

    // Border
    const borderColor = isKnowledge ? '#3b82f6' : (n.done ? '#10b981' : '#f43f5e');
    ctx.strokeStyle = borderColor; ctx.lineWidth = isRoot ? 3 : 2; ctx.stroke();

    // Title
    const fontSize = n.size === 'small' ? 11 : (n.size === 'large' ? 15 : 13);
    ctx.fillStyle = (n.done && !isKnowledge) ? '#9ca3af' : '#1f2937';
    ctx.font = (isRoot ? 'bold ' : '600 ') + fontSize + 'px sans-serif';
    ctx.textBaseline = 'top';
    const pad = n.size === 'small' ? 8 : (n.size === 'large' ? 16 : 12);
    const lines = this._wrapText(ctx, n.title || '', w - pad * 2);
    for (let i = 0; i < Math.min(lines.length, 2); i++) {
      ctx.fillText(lines[i], x + pad, y + pad + i * (fontSize + 2));
    }

    // Description
    const descLimit = isKnowledge ? 80 : 30;
    const desc = (n.description || '').substring(0, descLimit);
    if (desc) {
      ctx.font = (n.size === 'small' ? 9 : (n.size === 'large' ? 11 : 10)) + 'px sans-serif';
      ctx.fillStyle = '#9ca3af';
      const descLines = this._wrapText(ctx, desc, w - pad * 2);
      const descY = y + pad + Math.min(lines.length, 2) * (fontSize + 2) + 4;
      for (let j = 0; j < Math.min(descLines.length, 2); j++) ctx.fillText(descLines[j], x + pad, descY + j * (10 + 2));
    }

    // Done checkmark
    if (n.done && !isKnowledge) {
      ctx.fillStyle = '#10b981'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText('✓', x + w - pad, y + pad); ctx.textAlign = 'start';
    }

    // "+" button (green circle on right edge)
    const plusX = x + w + 6;
    const plusY = y + h / 2;
    ctx.beginPath();
    ctx.arc(plusX, plusY, PLUS_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', plusX, plusY);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  },

  _wrapText(ctx, text, maxWidth) {
    const chars = text.split('');
    const lines = [];
    let cur = '';
    for (let i = 0; i < chars.length; i++) {
      if (ctx.measureText(cur + chars[i]).width > maxWidth && cur.length > 0) { lines.push(cur); cur = chars[i]; }
      else cur += chars[i];
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [text];
  },

  _computeRects(nodes, positions, isKnowledge, cx, cy, canvasW, canvasH, zoom, panX, panY) {
    this._nodeScreenRects = {};
    this._plusRects = {};
    const screenCX = canvasW / 2 + panX;
    const screenCY = canvasH / 2 + panY;

    nodes.forEach(n => {
      const pos = positions[n.id];
      if (!pos) return;
      const nw = nodeW(n), nh = nodeH(n);
      const sx = (pos.x + cx) * zoom + screenCX;
      const sy = (pos.y + cy) * zoom + screenCY;
      this._nodeScreenRects[n.id] = { x: sx, y: sy, w: nw * zoom, h: nh * zoom };

      // Plus button rect
      const pr = PLUS_RADIUS * zoom;
      const px = sx + nw * zoom + 6 * zoom - pr;
      const py = sy + nh * zoom / 2 - pr;
      this._plusRects[n.id] = { x: px, y: py, w: pr * 2, h: pr * 2 };
    });
  },

  // ── Touch ─────────────────────────────────
  onCanvasTouchStart(e) {
    if (e.touches.length === 2) {
      const t0 = e.touches[0], t1 = e.touches[1];
      this._touchState = {
        type: 'pinch', startDist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
        startZoom: this.data.zoom, dragged: false
      };
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const hit = this._hitTest(t.clientX, t.clientY);
      this._touchState = {
        type: 'tap', startX: t.clientX, startY: t.clientY,
        startTime: Date.now(), moved: false,
        hitNodeId: hit ? hit.nodeId : null,
        hitPlus: hit ? hit.isPlus : false,
        panX: this.data.panX, panY: this.data.panY
      };

      // If touching a node, prepare for potential drag (long-press triggers drag)
      if (hit && hit.nodeId && !hit.isPlus) {
        this._dragNodeTimer = setTimeout(() => {
          if (this._touchState && !this._touchState.moved) {
            this._touchState.type = 'drag-node';
            this._touchState.dragNodeId = hit.nodeId;
            wx.vibrateShort({ type: 'light' });
          }
        }, 400);
      }
    }
  },

  onCanvasTouchMove(e) {
    if (!this._touchState) return;
    const ts = this._touchState;

    if (ts.type === 'pinch' && e.touches.length === 2) {
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const ratio = dist / ts.startDist;
      const newZoom = Math.max(0.3, Math.min(3, ts.startZoom * ratio));
      const cx = (t0.clientX + t1.clientX) / 2, cy = (t0.clientY + t1.clientY) / 2;
      const zr = newZoom / this.data.zoom;
      this.setData({
        zoom: Math.round(newZoom * 100) / 100, zoomPercent: String(Math.round(newZoom * 100)),
        panX: Math.round(cx - zr * (cx - this.data.panX)),
        panY: Math.round(cy - zr * (cy - this.data.panY))
      });
      ts.dragged = true;
      setTimeout(() => this.renderMindMap(), 30);
    } else if (ts.type === 'drag-node' && e.touches.length === 1) {
      // Move the dragged node
      const t = e.touches[0];
      const dx = (t.clientX - ts.startX) / this.data.zoom;
      const dy = (t.clientY - ts.startY) / this.data.zoom;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) ts.moved = true;

      // Update layout position
      const node = this._nodes.find(n => n.id === ts.dragNodeId);
      if (node) {
        node.posX = (node.posX || 0) + dx;
        node.posY = (node.posY || 0) + dy;
        ts.startX = t.clientX;
        ts.startY = t.clientY;
        ts.dragged = true;
        this.renderMindMap();
      }
    } else if ((ts.type === 'tap' || ts.type === 'drag-node') && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - ts.startX;
      const dy = t.clientY - ts.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) ts.moved = true;

      if (ts.type === 'tap' && !ts.hitNodeId) {
        // Pan view
        this.setData({ panX: ts.panX + dx, panY: ts.panY + dy });
        setTimeout(() => this.renderMindMap(), 30);
      }
    }
  },

  onCanvasTouchEnd(e) {
    clearTimeout(this._dragNodeTimer);
    const ts = this._touchState;
    if (!ts) return;

    if (ts.type === 'drag-node' && ts.dragged && ts.dragNodeId) {
      const node = this._nodes.find(n => n.id === ts.dragNodeId);
      if (node) {
        storage.updateWorkflowNode(ts.dragNodeId, { posX: node.posX, posY: node.posY });
        this.renderMindMap();
      }
    }

    if (ts.type === 'tap' && !ts.moved && !ts.dragged) {
      // Single tap
      if (ts.hitPlus && ts.hitNodeId) {
        this._onPlusTap(ts.hitNodeId);
      } else if (ts.hitNodeId) {
        const now = Date.now();
        if (this._lastTapNodeId === ts.hitNodeId && now - this._lastTapTime < DOUBLE_TAP_MS) {
          // Double tap → edit
          this._lastTapNodeId = null;
          this._lastTapTime = 0;
          this.showEditNode(ts.hitNodeId);
        } else {
          this._lastTapNodeId = ts.hitNodeId;
          this._lastTapTime = now;
          this._onNodeTap(ts.hitNodeId);
        }
      }
    }

    this._touchState = null;
    this.renderMindMap();
  },

  _hitTest(x, y) {
    // Check plus buttons first (they're smaller targets, check first to prioritize)
    for (const id in this._plusRects) {
      const r = this._plusRects[id];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return { nodeId: Number(id), isPlus: true };
      }
    }
    // Then check node rects
    for (const id in this._nodeScreenRects) {
      const r = this._nodeScreenRects[id];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return { nodeId: Number(id), isPlus: false };
      }
    }
    return null;
  },

  _onPlusTap(nodeId) {
    this.showQuickAddMenu(nodeId);
  },

  _onNodeTap(nodeId) {
    const nodes = this._nodes;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const itemList = ['编辑', '添加子节点'];
    if (this.data.mindmapType !== 'knowledge') itemList.push(node.done ? '取消完成' : '标记完成');
    itemList.push('删除');

    wx.showActionSheet({
      itemList,
      success: (res) => {
        switch (res.tapIndex) {
          case 0: this.showEditNode(nodeId); break;
          case 1: this.showQuickAddMenu(nodeId); break;
          case 2:
            if (this.data.mindmapType !== 'knowledge') this.toggleNodeDone(nodeId);
            else this.deleteNode(nodeId);
            break;
          case 3: this.deleteNode(nodeId); break;
        }
      }
    });
  },

  showQuickAddMenu(parentId) {
    wx.showActionSheet({
      itemList: ['添加子节点（右）', '添加子节点（左）', '添加子节点（下）', '添加子节点（上）', '添加同级节点'],
      success: (res) => {
        const dirs = ['right', 'left', 'down', 'up', 'sibling'];
        const dirLabels = ['右侧', '左侧', '下方', '上方', '同级'];
        const dir = dirs[res.tapIndex];
        const defaultSize = this.data.mindmapType === 'knowledge' ? 'large' : 'medium';

        if (dir === 'sibling') {
          // Find parent and add sibling
          const parent = this._findParentNode(parentId);
          if (!parent) { wx.showToast({ title: '根节点无法添加同级', icon: 'none' }); return; }
          const siblingDir = this._nodes.find(n => n.id === parentId)?.direction || 'right';
          this.setData({
            showQuickAdd: true, quickAddParentId: parent.id, quickAddDirection: siblingDir,
            quickAddDirLabel: '同级（' + dirLabels[[ 'right', 'left', 'down', 'up' ].indexOf(siblingDir)] + '）',
            quickAddTitle: '', quickAddShape: 'rounded', quickAddSize: defaultSize
          });
        } else {
          this.setData({
            showQuickAdd: true, quickAddParentId: parentId, quickAddDirection: dir,
            quickAddDirLabel: dirLabels[dirs.indexOf(dir)],
            quickAddTitle: '', quickAddShape: 'rounded', quickAddSize: defaultSize
          });
        }
      }
    });
  },

  _findParentNode(childId) {
    const nodes = this._nodes;
    for (const n of nodes) {
      if (n.id === childId) {
        return nodes.find(p => p.id === n.parentId) || null;
      }
    }
    return null;
  },

  // ── Node Edit ────────────────────────────
  showEditNode(nodeId) {
    const nodes = storage.getWorkflowNodes(this.data.currentWorkflowId);
    const n = nodes.find(x => x.id === nodeId);
    if (!n) return;
    this.setData({
      showNodeModal: true, editingNodeId: nodeId,
      nodeForm: { title: n.title, desc: n.description || '', shape: n.shape || 'rounded', size: n.size || 'medium' }
    });
  },
  hideNodeModal() { this.setData({ showNodeModal: false, editingNodeId: null }); },
  onNodeTitleInput(e) { this.setData({ 'nodeForm.title': e.detail.value }); },
  onNodeDescInput(e) { this.setData({ 'nodeForm.desc': e.detail.value }); },
  pickShape(e) { this.setData({ 'nodeForm.shape': e.currentTarget.dataset.shape }); },
  pickSize(e) { this.setData({ 'nodeForm.size': e.currentTarget.dataset.size }); },

  confirmNodeEdit() {
    const f = this.data.nodeForm;
    if (!f.title.trim()) { wx.showToast({ title: '请输入节点标题', icon: 'none' }); return; }
    storage.updateWorkflowNode(this.data.editingNodeId, { title: f.title, description: f.desc, shape: f.shape, size: f.size });
    wx.showToast({ title: '节点已更新', icon: 'success' });
    this.hideNodeModal(); this.renderMindMap();
  },

  async toggleNodeDone(nodeId) {
    const nodes = storage.getWorkflowNodes(this.data.currentWorkflowId);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    storage.updateWorkflowNode(nodeId, { done: !node.done });
    this.renderMindMap();
  },

  async deleteNode(nodeId) {
    const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '确定删除该节点及其所有子节点？', success: r }));
    if (!res.confirm) return;
    storage.deleteWorkflowNode(nodeId);
    wx.showToast({ title: '节点已删除', icon: 'success' });
    this.refreshWorkflows(); this.renderMindMap();
  },

  // ── Quick Add ────────────────────────────
  onQuickAddInput(e) { this.setData({ quickAddTitle: e.detail.value }); },
  pickQuickShape(e) { this.setData({ quickAddShape: e.currentTarget.dataset.shape }); },
  pickQuickSize(e) { this.setData({ quickAddSize: e.currentTarget.dataset.size }); },

  confirmQuickAdd() {
    const title = this.data.quickAddTitle.trim();
    if (!title) { wx.showToast({ title: '请输入节点标题', icon: 'none' }); return; }
    storage.addWorkflowNode(this.data.currentWorkflowId, this.data.quickAddParentId, this.data.quickAddDirection, title, '', this.data.quickAddShape, this.data.quickAddSize);
    wx.showToast({ title: '节点已添加', icon: 'success' });
    this.cancelQuickAdd(); this.refreshWorkflows(); this.renderMindMap();
  },
  cancelQuickAdd() { this.setData({ showQuickAdd: false, quickAddParentId: null, quickAddDirection: null }); },

  // ── Zoom ─────────────────────────────────
  zoomIn() {
    const z = Math.min(3, this.data.zoom + 0.15);
    this.setData({ zoom: Math.round(z * 100) / 100, zoomPercent: String(Math.round(z * 100)) });
    this.renderMindMap();
  },
  zoomOut() {
    const z = Math.max(0.3, this.data.zoom - 0.15);
    this.setData({ zoom: Math.round(z * 100) / 100, zoomPercent: String(Math.round(z * 100)) });
    this.renderMindMap();
  },
  zoomReset() {
    this.setData({ zoom: 1, zoomPercent: '100', panX: 0, panY: 0 });
    this.renderMindMap();
  }
});
