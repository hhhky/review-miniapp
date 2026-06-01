Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/home/home', text: '实用部件', icon: '🧩' },
      { pagePath: '/pages/mine/mine', text: '我的', icon: '👤' }
    ]
  },

  lifetimes: {
    attached() {
      const pages = getCurrentPages();
      if (pages.length > 0) {
        const route = '/' + pages[pages.length - 1].route;
        const idx = this.data.list.findIndex(item => item.pagePath === route);
        if (idx !== -1) this.setData({ selected: idx });
      }
    }
  },

  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.list[index];
      wx.switchTab({ url: item.pagePath });
    }
  }
});
