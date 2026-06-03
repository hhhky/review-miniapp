const storage = require('./utils/storage');

App({
  onLaunch() {
    storage.initStorage();
  },

  globalData: {
    widgets: [
      { id: 'review', name: '资料管理', icon: '📁', desc: '分类、上传、预览', color: '#E67E22', size: 'tall' },
      { id: 'memo', name: '备忘录', icon: '📝', desc: '待办与日历', color: '#F59E0B', size: 'square' },
      { id: 'mindmap', name: '思维导图', icon: '🧠', desc: '工作流 + 知识梳理', color: '#D97706', size: 'square' }
    ]
  }
});
