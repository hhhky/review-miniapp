const storage = require('../../utils/storage');
const { validateNickname } = require('../../utils/name-filter');

const PRESET_AVATARS = ['👤', '😊', '😎', '🐱', '🐶', '🦊', '🐼', '🦁', '🐸', '🐵', '🐯', '🐻'];

Page({
  data: {
    profile: { nickname: '', avatar: '👤' },
    isImageAvatar: false,
    fileCount: 0,
    memoCount: 0,

    // 昵称弹窗
    showNicknameModal: false,
    nicknameInput: '',
    nicknameError: '',

    // 头像弹窗
    showAvatarModal: false,
    presetAvatars: PRESET_AVATARS
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.loadProfile();
    this.loadStats();
  },

  // ── Profile ────────────────────────────
  loadProfile() {
    const profile = storage.getUserProfile();
    const isImageAvatar = profile.avatar && (
      profile.avatar.startsWith('/') ||
      profile.avatar.startsWith('wxfile') ||
      profile.avatar.startsWith('http')
    );
    this.setData({ profile, isImageAvatar });
  },

  // ── Stats ──────────────────────────────
  loadStats() {
    try {
      const files = storage.getFiles();
      const memos = storage.getMemos();
      this.setData({ fileCount: files.length, memoCount: memos.length });
    } catch (e) { /* 静默降级 */ }
  },

  // ── 昵称编辑 ──────────────────────────
  onNicknameTap() {
    this.setData({
      showNicknameModal: true,
      nicknameInput: this.data.profile.nickname || '',
      nicknameError: ''
    });
  },

  onCloseNicknameModal() {
    this.setData({ showNicknameModal: false, nicknameError: '' });
  },

  onNicknameInput(e) {
    this.setData({ nicknameInput: e.detail.value, nicknameError: '' });
  },

  async onConfirmNickname() {
    const name = this.data.nicknameInput;

    // 校验
    const result = await validateNickname(name);
    if (!result.valid) {
      this.setData({ nicknameError: result.message });
      return;
    }

    // 保存
    const profile = storage.updateUserProfile({ nickname: result.sanitized });
    this.setData({
      profile,
      showNicknameModal: false,
      nicknameError: ''
    });

    wx.showToast({ title: '昵称已保存', icon: 'success', duration: 1500 });
  },

  // ── 头像编辑 ──────────────────────────
  onAvatarTap() {
    this.setData({ showAvatarModal: true });
  },

  onCloseAvatarModal() {
    this.setData({ showAvatarModal: false });
  },

  onSelectPreset(e) {
    const avatar = e.currentTarget.dataset.avatar;
    const profile = storage.updateUserProfile({ avatar });
    this.setData({ profile, isImageAvatar: false, showAvatarModal: false });
    wx.showToast({ title: '头像已更新', icon: 'success', duration: 1500 });
  },

  onChooseFromAlbum() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        const tempPath = res.tempFilePaths[0];
        // 拷贝到永久存储
        const fs = wx.getFileSystemManager();
        const savedPath = wx.env.USER_DATA_PATH + '/avatar_' + Date.now() + '.jpg';

        try {
          fs.copyFileSync(tempPath, savedPath);
          const profile = storage.updateUserProfile({ avatar: savedPath });
          this.setData({ profile, isImageAvatar: true, showAvatarModal: false });
          wx.showToast({ title: '头像已更新', icon: 'success', duration: 1500 });
        } catch (e) {
          // 如果拷贝失败，直接用临时路径
          const profile = storage.updateUserProfile({ avatar: tempPath });
          this.setData({ profile, isImageAvatar: true, showAvatarModal: false });
          wx.showToast({ title: '头像已更新', icon: 'success', duration: 1500 });
        }
      }
    });
  },

  // ── 阻止弹窗穿透 ──────────────────────
  onStopPropagation() {}
});
