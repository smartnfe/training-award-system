/**
 * gas-client.js — ชั้นเชื่อมต่อ API สำหรับหน้าเว็บที่รันนอก Google Apps Script
 * (GitHub Pages / Netlify / เปิดจากไฟล์ในเครื่อง)
 *
 * หน้าที่: จำลอง `google.script.run` ให้โค้ดเดิมของแอปใช้ได้โดยไม่ต้องแก้
 *   google.script.run.withSuccessHandler(cb).withFailureHandler(eb).login(u, p)
 *   → ยิงไปที่ Apps Script Web App (JSON API) แทน HtmlService
 *
 * ลำดับการส่งข้อมูล (อัตโนมัติ):
 *   1) POST แบบ "simple request" (Content-Type: text/plain) — ไม่ติด CORS preflight
 *   2) ถ้าล้มเหลว → ถอยไปใช้ JSONP (GET + <script>) ซึ่งไม่ติด CORS เลย
 *      (ใช้ได้เฉพาะคำขอที่ข้อมูลไม่ใหญ่ — การอัปโหลดไฟล์ต้องใช้ POST เท่านั้น)
 */
(function () {
  'use strict';

  var LS_KEY = 'ta_api_config';
  var JSONP_MAX_CHARS = 6000;   // เกินนี้อย่าใช้ JSONP (URL ยาวเกิน)
  var TIMEOUT_MS = 60000;

  // ---------- การตั้งค่า ----------
  function baseCfg() { return window.APP_CONFIG || {}; }

  function savedCfg() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { return {}; }
  }

  function cfg() {
    var b = baseCfg(), s = savedCfg();
    return {
      apiUrl: String(s.apiUrl || b.apiUrl || '').trim(),
      apiToken: String(s.apiToken || b.apiToken || '').trim(),
      spreadsheetId: String(s.spreadsheetId || b.spreadsheetId || '').trim(),
      driveFolderId: String(s.driveFolderId || b.driveFolderId || '').trim()
    };
  }

  // ---------- base64 (UTF-8 safe, URL-safe) ----------
  function b64enc(str) {
    var u = new TextEncoder().encode(str), s = '', i;
    for (i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64dec(b64) {
    b64 = String(b64).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var s = atob(b64), u = new Uint8Array(s.length), i;
    for (i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return new TextDecoder().decode(u);
  }

  // ---------- เซสชัน: อ่าน sid จากผู้ใช้ที่ล็อกอินอยู่ ----------
  function sid() {
    try {
      var u = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
      return (u && u.sid) ? u.sid : '';
    } catch (e) { return ''; }
  }

  // ---------- transport 1: POST (text/plain = simple request) ----------
  function postTransport(action, args, c) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
    var payload = JSON.stringify({ action: action, args: args, token: c.apiToken, sid: sid() });

    return fetch(c.apiUrl, {
      method: 'POST',
      body: payload,                      // ห้ามตั้ง Content-Type: application/json (จะติด preflight)
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('เซิร์ฟเวอร์ตอบ HTTP ' + r.status);
      return r.text();
    }).then(function (t) {
      try { return JSON.parse(t); }
      catch (e) { throw new Error('การตอบกลับไม่ใช่ JSON: ' + t.slice(0, 300)); }
    });
  }

  // ---------- transport 2: JSONP ----------
  var jsonpSeq = 0;
  function jsonpTransport(action, args, c) {
    return new Promise(function (resolve, reject) {
      var cb = '__ta_jsonp_' + (++jsonpSeq) + '_' + Date.now();
      var url = c.apiUrl + (c.apiUrl.indexOf('?') >= 0 ? '&' : '?') +
        'action=' + encodeURIComponent(action) +
        '&payload=' + encodeURIComponent(b64enc(JSON.stringify(args || []))) +
        '&token=' + encodeURIComponent(c.apiToken) +
        '&sid=' + encodeURIComponent(sid()) +
        '&callback=' + cb;

      var s = document.createElement('script');
      var done = false;
      var timer = setTimeout(function () { finish(new Error('หมดเวลาเชื่อมต่อ (JSONP)')); }, TIMEOUT_MS);

      function finish(err, data) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (s.parentNode) s.parentNode.removeChild(s);
        err ? reject(err) : resolve(data);
      }

      window[cb] = function (res) { finish(null, res); };
      s.onerror = function () { finish(new Error('โหลด API ไม่ได้ (JSONP)')); };
      s.src = url;
      document.head.appendChild(s);
    });
  }

  // ---------- ตัวเรียกหลัก (POST ก่อน → JSONP สำรอง) ----------
  var state = { lastTransport: null, lastError: null };

  function call(action, args) {
    var c = cfg();
    if (!c.apiUrl || c.apiUrl.indexOf('http') !== 0) {
      return Promise.reject(new Error('ยังไม่ได้ตั้งค่า API URL — ไปที่เมนู "ตั้งค่าระบบ" (ผู้ดูแล) แล้ววาง URL ของ Apps Script Web App'));
    }

    return postTransport(action, args, c)
      .then(function (j) { state.lastTransport = 'POST'; return j; })
      .catch(function (err) {
        state.lastError = err;
        var size = 0;
        try { size = b64enc(JSON.stringify(args || [])).length; } catch (e) { size = 1e9; }
        if (size > JSONP_MAX_CHARS) throw err;          // ใหญ่เกินไป (เช่น อัปโหลดไฟล์) → ต้องใช้ POST
        return jsonpTransport(action, args, c).then(function (j) {
          state.lastTransport = 'JSONP';
          return j;
        });
      })
      .then(function (j) {
        if (!j || typeof j !== 'object') throw new Error('เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ');
        if (j.ok !== true) {
          if (j.sessionExpired) {
            try { sessionStorage.removeItem('currentUser'); } catch (e) {}
            var e0 = new Error(j.error || 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
            e0.sessionExpired = true;
            throw e0;
          }
          throw new Error(j.error || 'เซิร์ฟเวอร์แจ้งข้อผิดพลาด');
        }
        return j.data;
      });
  }

  // ---------- จำลอง google.script.run ----------
  function makeRunner(successFn, failureFn) {
    var api = {
      withSuccessHandler: function (fn) { return makeRunner(fn, failureFn); },
      withFailureHandler: function (fn) { return makeRunner(successFn, fn); }
    };
    return new Proxy(api, {
      get: function (target, prop) {
        if (typeof prop === 'string' && !(prop in target)) {
          return function () {
            var args = Array.prototype.slice.call(arguments);
            call(prop, args).then(function (data) {
              if (typeof successFn === 'function') successFn(data);
            }).catch(function (err) {
              if (typeof failureFn === 'function') failureFn(err);
              else console.error('[TA-API] ' + prop + ' ไม่สำเร็จ:', err);
            });
          };
        }
        return target[prop];
      }
    });
  }

  // ---------- API ให้หน้าแอดมินเรียกใช้ ----------
  window.TA_API = {
    getConfig: cfg,
    state: state,
    save: function (obj) {
      var cur = savedCfg();
      ['apiUrl', 'apiToken', 'spreadsheetId', 'driveFolderId'].forEach(function (k) {
        if (obj[k] !== undefined) {
          if (String(obj[k]).trim() === '') delete cur[k];
          else cur[k] = String(obj[k]).trim();
        }
      });
      localStorage.setItem(LS_KEY, JSON.stringify(cur));
      return cfg();
    },
    reset: function () { localStorage.removeItem(LS_KEY); return cfg(); },
    call: call,                                  // call('getAllData', [])
    currentSid: sid,                             // รหัสเซสชันของผู้ใช้ที่ล็อกอินอยู่
    hasSession: function () { return !!sid(); },
    isReady: function () { var c = cfg(); return !!c.apiUrl && c.apiUrl.indexOf('http') === 0; },
    lastTransport: function () { return state.lastTransport; }
  };

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = makeRunner(null, null);
})();
