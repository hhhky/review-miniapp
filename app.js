const storage = require('./utils/storage');

App({
  onLaunch() {
    storage.initStorage();
  },

  globalData: {
    widgets: [
      { id: 'review', name: '资料管理', icon: '📁', desc: '分类管理、上传和预览各类资料', color: '#3b82f6' },
      { id: 'memo', name: '备忘录', icon: '📝', desc: '记录待办事项，查看日历', color: '#10b981' },
      // { id: 'mindmap', name: '思维导图', icon: '🧠', desc: '工作流 + 知识梳理', color: '#f43f5e' }
    ]
  }
});
