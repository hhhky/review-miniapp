// ── 昵称安全校验 ──────────────────────────────
// 第一层：本地基础规则
// 第二层：微信官方云端内容安全检测

/**
 * 基础本地校验（长度、空值、纯符号）
 * @returns {{ valid: boolean, message: string, sanitized: string }}
 */
function basicValidate(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, message: '昵称不能为空', sanitized: '' };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, message: '昵称不能为空', sanitized: '' };
  }
  if (trimmed.length > 20) {
    return { valid: false, message: '昵称不能超过20个字符', sanitized: trimmed.slice(0, 20) };
  }
  if (/^[\s!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`0-9]+$/.test(trimmed)) {
    return { valid: false, message: '昵称不能全是特殊符号或数字', sanitized: '' };
  }
  return { valid: true, message: '', sanitized: trimmed };
}

/**
 * 调用微信官方内容安全 API 进行云端检测
 * @param {string} content 待检测文本
 * @returns {Promise<{ valid: boolean, message: string }>}
 */
function cloudCheck(content) {
  return new Promise((resolve) => {
    // 微信内容安全检测（需小程序通过认证后才能生效）
    if (!wx.security || typeof wx.security.msgSecCheck !== 'function') {
      // API 不可用（开发环境/未认证），跳过云端检测
      resolve({ valid: true, message: '' });
      return;
    }

    wx.security.msgSecCheck({
      content: content,
      success: (res) => {
        if (res.errCode === 0 || res.errCode === undefined) {
          // 检测通过，内容合规
          resolve({ valid: true, message: '' });
        } else {
          resolve({ valid: false, message: '昵称包含违规内容，请修改' });
        }
      },
      fail: () => {
        // API 调用失败（开发工具/未开通），降级放行
        resolve({ valid: true, message: '' });
      }
    });
  });
}

/**
 * 完整校验：基础规则 + 云端安全检测
 * @param {string} name 昵称
 * @returns {Promise<{ valid: boolean, message: string, sanitized: string }>}
 */
async function validateNickname(name) {
  // 第一层：本地基础规则
  const basic = basicValidate(name);
  if (!basic.valid) {
    return basic;
  }

  // 第二层：微信云端安全检测
  const cloud = await cloudCheck(basic.sanitized);
  if (!cloud.valid) {
    return { valid: false, message: cloud.message, sanitized: basic.sanitized };
  }

  return basic;
}

module.exports = { validateNickname, basicValidate };
