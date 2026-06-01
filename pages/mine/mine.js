const storage = require('../../utils/storage');

Page({
  data: {
    fileCount: 0,
    memoCount: 0
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.loadStats();
  },

  loadStats() {
    try {
      const files = storage.getFiles();
      const memos = storage.getMemos();
      this.setData({
        fileCount: files.length,
        memoCount: memos.length
      });
    } catch (e) {
      // 静默降级
    }
  }
});
