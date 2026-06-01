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
    wx.navigateTo({ url: '/pages/' + id + '/' + id });
  }
});
