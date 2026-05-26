const app = getApp();

Page({
  data: {
    widgets: []
  },

  onShow() {
    this.setData({ widgets: app.globalData.widgets });
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  enterWidget(e) {
    const id = e.currentTarget.dataset.id;
    const tabMap = { review: 1, memo: 2, mindmap: 3 };
    const idx = tabMap[id];
    if (idx !== undefined) {
      wx.switchTab({ url: '/pages/' + id + '/' + id });
    }
  }
});
