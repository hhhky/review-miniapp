// ── FAB 拖拽行为 ────────────────────────────
// review / memo 页面共用的悬浮按钮拖拽逻辑
// 使用方式：
//   1. 在 Page data 中展开 fabData
//   2. 在 Page 方法中展开 fabMethods
//   3. 在 Page 中定义 _handleFabTap() 作为点击回调

const fabData = {
  fabLeft: null,
  fabTop: null
};

const fabMethods = {
  onFabTap() {
    if (!this._fabMoved && typeof this._handleFabTap === 'function') {
      this._handleFabTap();
    }
    this._fabMoved = false;
  },

  onFabTouchStart(e) {
    this._fabMoved = false;
    const touch = e.touches[0];
    const query = wx.createSelectorQuery();
    query.select('.fab').boundingClientRect(rect => {
      if (!rect) return;
      this._fabStartLeft = rect.left;
      this._fabStartTop = rect.top;
      this._fabTouchX = touch.clientX;
      this._fabTouchY = touch.clientY;
      this._fabDragging = true;
      if (this.data.fabLeft === null) {
        this.setData({ fabLeft: rect.left, fabTop: rect.top });
      }
    }).exec();
  },

  onFabTouchMove(e) {
    if (!this._fabDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - this._fabTouchX;
    const dy = touch.clientY - this._fabTouchY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      this._fabMoved = true;
    }
    this.setData({
      fabLeft: this._fabStartLeft + dx,
      fabTop: this._fabStartTop + dy
    });
  },

  onFabTouchEnd() {
    this._fabDragging = false;
  }
};

module.exports = { fabData, fabMethods };
