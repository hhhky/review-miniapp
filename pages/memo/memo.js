const storage = require('../../utils/storage');

function getDaysInfo(memo) {
  if (!memo.deadline) return { label: '无截止日期', color: '#9ca3af', urgent: false };
  const now = Date.now();
  const deadline = memo.deadline;
  const deletionTime = deadline + 7 * 24 * 60 * 60 * 1000;
  const msRemaining = deletionTime - now;
  if (msRemaining <= 0) return { label: '即将删除...', color: '#ef4444', urgent: true };
  const days = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
  if (now > deadline) return { label: '已过期 · ' + days + '天后自动删除', color: '#f97316', urgent: true };
  const daysToDeadline = Math.ceil((deadline - now) / (24 * 60 * 60 * 1000));
  if (daysToDeadline <= 1) return { label: '即将到期 · ' + days + '天后删除', color: '#e11d48', urgent: true };
  if (daysToDeadline <= 3) return { label: daysToDeadline + '天后到期 · ' + days + '天后删除', color: '#f97316', urgent: false };
  return { label: daysToDeadline + '天后到期', color: '#6b7280', urgent: false };
}

function toDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

Page({
  data: {
    activeTab: 'memos',
    memos: [],
    showMemoModal: false,
    editingMemoId: null,
    fabLeft: null,
    fabTop: null,
    memoForm: { title: '', content: '', deadlineDate: '', autoDelete: false },

    // Calendar
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth(),
    selectedDateStr: null,
    calendarCells: [],
    selectedDateMemos: []
  },

  onShow() {
    this.cleanupExpired();
    this.refreshAll();
  },

  onLoad() {
    const now = new Date();
    this.setData({
      calendarYear: now.getFullYear(),
      calendarMonth: now.getMonth()
    });
  },

  async cleanupExpired() {
    const memos = storage.getMemos();
    const now = Date.now();
    const GRACE = 7 * 24 * 60 * 60 * 1000;
    memos.forEach(m => {
      if (m.autoDelete && m.deadline && (m.deadline + GRACE) < now) {
        storage.deleteMemo(m.id);
      }
    });
  },

  refreshAll() {
    const memos = storage.getMemos();
    const enriched = memos.sort((a,b) => b.createdAt - a.createdAt).map(m => ({
      ...m,
      daysInfo: getDaysInfo(m),
      preview: (m.content || '').substring(0, 80) + ((m.content || '').length > 80 ? '...' : ''),
      dateStr: new Date(m.createdAt).toLocaleDateString('zh-CN')
    }));
    this.setData({ memos: enriched });
    if (this.data.activeTab === 'calendar') this.buildCalendar();
  },

  switchSubTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'calendar') this.buildCalendar();
    if (tab === 'memos') this.refreshAll();
  },

  // ── Memo CRUD ───────────────────────────
  showAddMemo() {
    this.setData({
      showMemoModal: true, editingMemoId: null,
      memoForm: { title: '', content: '', deadlineDate: '', autoDelete: false }
    });
  },

  showEditMemo(e) {
    const id = e.currentTarget.dataset.id;
    const memos = storage.getMemos();
    const m = memos.find(x => x.id === id);
    if (!m) return;
    let deadlineDate = '';
    if (m.deadline) {
      const d = new Date(m.deadline);
      deadlineDate = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }
    this.setData({
      showMemoModal: true, editingMemoId: id,
      memoForm: { title: m.title, content: m.content || '', deadlineDate, autoDelete: !!m.autoDelete }
    });
  },

  hideMemoModal() {
    this.setData({ showMemoModal: false, editingMemoId: null });
  },

  // ── FAB Drag ────────────────────────────
  onFabTap() {
    if (!this._fabMoved) {
      this.showAddMemo();
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
  },

  noop() {},

  onMaskTap() {
    // 使用计时器防止与 picker 组件的关闭事件冲突
    if (!this._maskTapTimer) {
      this.hideMemoModal();
    }
  },

  onMemoTitleInput(e) {
    this.setData({ 'memoForm.title': e.detail.value });
  },

  onMemoContentInput(e) {
    this.setData({ 'memoForm.content': e.detail.value });
  },

  onDeadlineDateChange(e) {
    this.setData({ 'memoForm.deadlineDate': e.detail.value });
  },

  onAutoDeleteChange(e) {
    this.setData({ 'memoForm.autoDelete': e.detail.value });
  },

  async confirmMemo() {
    const f = this.data.memoForm;
    if (!f.title.trim()) {
      wx.showToast({ title: '请输入备忘录标题', icon: 'none' });
      return;
    }
    const deadline = f.deadlineDate ? new Date(f.deadlineDate).getTime() : null;

    if (this.data.editingMemoId) {
      storage.updateMemo(this.data.editingMemoId, { title: f.title, content: f.content, deadline, autoDelete: f.autoDelete });
      wx.showToast({ title: '备忘录已更新', icon: 'success' });
    } else {
      storage.addMemo(f.title, f.content, deadline, f.autoDelete);
      wx.showToast({ title: '备忘录已创建', icon: 'success' });
    }
    this.hideMemoModal();
    this.refreshAll();
  },

  async deleteMemoItem(e) {
    const id = e.currentTarget.dataset.id;
    const res = await new Promise(r => wx.showModal({ title: '确认删除', content: '确定删除这条备忘录？', success: r }));
    if (!res.confirm) return;
    storage.deleteMemo(id);
    wx.showToast({ title: '备忘录已删除', icon: 'success' });
    this.refreshAll();
  },

  // ── Calendar ────────────────────────────
  buildCalendar() {
    const memos = storage.getMemos();
    const memosByDate = {};
    memos.forEach(m => {
      if (!m.deadline) return;
      const d = new Date(m.deadline);
      const key = toDateStr(d);
      if (!memosByDate[key]) memosByDate[key] = [];
      memosByDate[key].push(m);
    });

    const year = this.data.calendarYear;
    const month = this.data.calendarMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const today = new Date();
    const todayStr = toDateStr(today);
    const cells = [];

    // Prev month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ day: prevMonthDays - i, isOtherMonth: true, isToday: false, isSelected: false, dateStr: '', hasMemos: false, urgency: '' });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      const dayMemos = memosByDate[dateStr] || [];
      let urgency = '#34d399';
      if (dayMemos.length > 0) {
        let maxU = 0;
        dayMemos.forEach(m => {
          const info = getDaysInfo(m);
          if (info.urgent && info.color === '#ef4444') maxU = Math.max(maxU, 2);
          else if (info.urgent || info.color === '#f97316') maxU = Math.max(maxU, 1);
        });
        urgency = ['#34d399', '#fb923c', '#ef4444'][maxU];
      }
      cells.push({
        day: d,
        isOtherMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === this.data.selectedDateStr,
        dateStr,
        hasMemos: dayMemos.length > 0,
        urgency
      });
    }

    // Fill remaining cells to 6 rows
    const totalCells = firstDay + daysInMonth;
    let remaining = totalCells % 7 === 0 ? 0 : 7 - totalCells % 7;
    if (firstDay + daysInMonth + remaining < 42) remaining += 7;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, isOtherMonth: true, isToday: false, isSelected: false, dateStr: '', hasMemos: false, urgency: '' });
    }

    // Selected date memos
    let selectedDateMemos = [];
    if (this.data.selectedDateStr && memosByDate[this.data.selectedDateStr]) {
      selectedDateMemos = memosByDate[this.data.selectedDateStr].sort((a,b) => b.createdAt - a.createdAt).map(m => ({
        ...m,
        daysInfo: getDaysInfo(m),
        preview: (m.content || '').substring(0, 80) + ((m.content || '').length > 80 ? '...' : '')
      }));
    }

    this.setData({ calendarCells: cells, selectedDateMemos });
  },

  prevMonth() {
    let { calendarYear, calendarMonth } = this.data;
    calendarMonth--;
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    this.setData({ calendarYear, calendarMonth });
    this.buildCalendar();
  },

  nextMonth() {
    let { calendarYear, calendarMonth } = this.data;
    calendarMonth++;
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
    this.setData({ calendarYear, calendarMonth });
    this.buildCalendar();
  },

  goToToday() {
    const now = new Date();
    const dateStr = toDateStr(now);
    this.setData({
      calendarYear: now.getFullYear(),
      calendarMonth: now.getMonth(),
      selectedDateStr: dateStr
    });
    this.buildCalendar();
  },

  selectDate(e) {
    const dateStr = e.currentTarget.dataset.date;
    if (!dateStr) return;
    this.setData({
      selectedDateStr: this.data.selectedDateStr === dateStr ? null : dateStr
    });
    this.buildCalendar();
  }
});
