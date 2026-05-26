Component({
  data: {
    selected: 0,
    list: [
      { pagePath: 'pages/home/home', text: '首页', icon: '🏠' },
      { pagePath: 'pages/review/review', text: '资料', icon: '📁' },
      { pagePath: 'pages/memo/memo', text: '备忘', icon: '📝' },
      { pagePath: 'pages/mindmap/mindmap', text: '导图', icon: '🧠' }
    ]
  },

  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.list[index];
      wx.switchTab({ url: '/' + item.pagePath });
    }
  }
});
