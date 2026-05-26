const storage = require('../../utils/storage');

const COLORS = [
  '#a855f7','#c084fc','#e879f9','#f472b6','#ec4899','#f43f5e',
  '#fb923c','#f97316','#ef4444','#dc2626','#f59e0b','#eab308',
  '#22c55e','#10b981','#34d399','#14b8a6','#06b6d4','#22d3ee',
  '#3b82f6','#60a5fa','#6366f1','#8b5cf6','#7c3aed','#6d28d9'
];

function getFileIcon(type, name) {
  const ext = (name || '').toLowerCase().split('.').pop();
  if (type === 'application/pdf' || ext === 'pdf') return '📕';
  if ((type || '').startsWith('image/') || ['jpg','jpeg','png','gif','webp','bmp'].indexOf(ext) !== -1) return '🖼️';
  if (ext === 'docx' || ext === 'doc') return '📝';
  if (ext === 'xlsx' || ext === 'xls') return '📊';
  return '📎';
}

function formatSize(size) {
  if (!size) return '0KB';
  return size > 1024*1024 ? (size/(1024*1024)).toFixed(1)+'MB' : (size/1024).toFixed(0)+'KB';
}

Page({
  data: {
    activeTab: 'categories',
    categories: [],
    colors: COLORS,
    selectedColor: COLORS[0],
    newCatName: '',
    showCatModal: false,

    // Files
    totalFiles: 0,
    filteredFiles: [],
    filterCategories: [],
    currentFilterCat: null,
    renamingId: null,
    renameValue: '',

    // Upload
    selectedUploadCat: null,
    selectedFile: null,
    canUpload: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.loadData();
  },

  onHide() {
    // Reset state when leaving page
    this.setData({
      showCatModal: false,
      renamingId: null,
      selectedFile: null,
      selectedUploadCat: null
    });
  },

  async loadData() {
    const cats = storage.getCategories();
    const files = storage.getFiles();
    const catMap = {};
    cats.forEach(c => { catMap[c.id] = (catMap[c.id] || 0); });
    files.forEach(f => { catMap[f.categoryId] = (catMap[f.categoryId] || 0) + 1; });

    const catsWithCount = cats.map(c => ({ ...c, fileCount: catMap[c.id] || 0 }));

    const filterCats = cats.map(c => ({ id: c.id, name: c.name, count: catMap[c.id] || 0 }));

    const currentCat = this.data.currentFilterCat;
    const filtered = currentCat === null ? files : files.filter(f => f.categoryId === currentCat);
    const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt).map(f => ({
      ...f,
      icon: getFileIcon(f.type, f.name),
      sizeStr: formatSize(f.size),
      dateStr: new Date(f.createdAt).toLocaleDateString('zh-CN')
    }));

    this.setData({
      categories: catsWithCount,
      totalFiles: files.length,
      filteredFiles: sorted,
      filterCategories: filterCats
    });
  },

  switchSubTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab, renamingId: null });
    if (tab === 'files') this.loadData();
    if (tab === 'upload') this.loadData();
  },

  // ── Categories ──────────────────────────
  showAddCategory() {
    this.setData({ showCatModal: true, newCatName: '', selectedColor: COLORS[0] });
  },

  hideCatModal() {
    this.setData({ showCatModal: false });
  },

  onCatNameInput(e) {
    this.setData({ newCatName: e.detail.value });
  },

  pickColor(e) {
    this.setData({ selectedColor: e.currentTarget.dataset.color });
  },

  async confirmAddCategory() {
    const name = this.data.newCatName.trim();
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }
    storage.addCategory(name, this.data.selectedColor);
    this.setData({ showCatModal: false });
    wx.showToast({ title: '分类已创建', icon: 'success' });
    this.loadData();
  },

  goToCategory(e) {
    const catId = e.currentTarget.dataset.id;
    this.setData({ currentFilterCat: catId, activeTab: 'files' });
    this.loadData();
  },

  async deleteCategoryItem(e) {
    const id = e.currentTarget.dataset.id;
    const files = storage.getFiles(id);
    if (files.length > 0) {
      const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '该分类下有' + files.length + '份资料，删除分类会同时删除这些资料。确定删除？', success: r }));
      if (!res.confirm) return;
      files.forEach(f => storage.deleteFile(f.id));
    }
    storage.deleteCategory(id);
    wx.showToast({ title: '分类已删除', icon: 'success' });
    this.loadData();
  },

  // ── Files ───────────────────────────────
  filterFiles(e) {
    const catId = e.currentTarget.dataset.cat;
    this.setData({ currentFilterCat: catId === undefined ? null : catId });
    this.loadData();
  },

  previewFile(e) {
    const id = e.currentTarget.dataset.id;
    const file = storage.getFileById(id);
    if (!file) return;

    wx.openDocument({
      filePath: file.filePath,
      showMenu: true,
      fail() {
        wx.showToast({ title: '无法预览此文件', icon: 'none' });
      }
    });
  },

  startRename(e) {
    const id = e.currentTarget.dataset.id;
    const file = storage.getFileById(id);
    this.setData({ renamingId: id, renameValue: file ? file.name : '' });
  },

  onRenameInput(e) {
    this.setData({ renameValue: e.detail.value });
  },

  async confirmRename() {
    const newName = this.data.renameValue.trim();
    if (!newName) {
      wx.showToast({ title: '文件名不能为空', icon: 'none' });
      return;
    }
    try {
      storage.updateFileName(this.data.renamingId, newName);
      wx.showToast({ title: '已重命名', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '重命名失败', icon: 'none' });
    }
    this.setData({ renamingId: null });
    this.loadData();
  },

  cancelRename() {
    this.setData({ renamingId: null });
  },

  async deleteFileItem(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '确定删除这份资料？', success: r }));
    if (!res.confirm) return;
    storage.deleteFile(id);
    wx.showToast({ title: '资料已删除', icon: 'success' });
    this.loadData();
  },

  // ── Upload ──────────────────────────────
  selectUploadCat(e) {
    this.setData({ selectedUploadCat: e.currentTarget.dataset.id });
    this.updateUploadBtn();
  },

  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'all',
      success: (res) => {
        const file = res.tempFiles[0];
        this.setData({
          selectedFile: {
            path: file.path,
            name: file.name,
            size: file.size,
            type: file.type || '',
            sizeStr: formatSize(file.size)
          }
        });
        this.updateUploadBtn();
      }
    });
  },

  clearSelectedFile() {
    this.setData({ selectedFile: null });
    this.updateUploadBtn();
  },

  updateUploadBtn() {
    this.setData({
      canUpload: !!(this.data.selectedFile && this.data.selectedUploadCat !== null)
    });
  },

  async uploadFile() {
    if (!this.data.canUpload) return;
    const file = this.data.selectedFile;
    const catId = this.data.selectedUploadCat;

    if (file.size > 100 * 1024 * 1024) {
      wx.showToast({ title: '文件不能超过100MB', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '上传中...' });
    try {
      await storage.addFile(file.name, catId, file.type || 'application/octet-stream', file.path, file.size);
      wx.hideLoading();
      wx.showToast({ title: '上传成功', icon: 'success' });
      this.setData({ selectedFile: null, selectedUploadCat: null, canUpload: false });
      this.loadData();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '上传失败: ' + (e.message || String(e)), icon: 'none' });
    }
  }
});
