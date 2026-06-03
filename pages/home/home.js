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
    if (id === 'mindmap') {
      wx.showToast({ title: '正在开发中', icon: 'none', duration: 2000 });
      return;
    }
    wx.navigateTo({ url: '/pages/' + id + '/' + id });
  }
});
