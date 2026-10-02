/**
 * config.js — ค่าตั้งต้นของหน้าเว็บ
 *
 * ค่าที่ตั้งในไฟล์นี้ = "ค่าเริ่มต้น"
 * ถ้าผู้ดูแลแก้ผ่านเมนู "ตั้งค่าระบบ" ในหน้าเว็บ ค่าที่แก้จะถูกเก็บใน localStorage
 * ของเบราว์เซอร์เครื่องนั้น และ "ทับ" ค่าในไฟล์นี้
 *
 * ⚠️ หลัง deploy Apps Script แล้ว ต้องเอา URL ที่ลงท้าย /exec มาใส่ apiUrl
 *    และเอา API_TOKEN ที่ตั้งในไฟล์ Code.gs มาใส่ apiToken
 */
window.APP_CONFIG = {
  // URL ของ Apps Script Web App (ลงท้ายด้วย /exec)
  // ใส่ไว้ให้แล้ว: ครูเปิดหน้าเว็บจากเครื่องไหนก็ใช้ได้เลย ไม่ต้องกรอกซ้ำ
  apiUrl: 'https://script.google.com/macros/s/AKfycbyx3U2gUxEUGK7NQcDZViDSMRxz97jiYpdmINf2Bbakbna1qc-Fn-gWBM2KKyy2gA/exec',

  // รหัสลับที่ต้องตรงกับ API_TOKEN ใน apps_script/Code.gs
  // (ตั้งไว้ให้แล้ว — ต้องตรงกันเป๊ะ ถ้าเปลี่ยนให้แก้ทั้ง 2 ที่พร้อมกัน)
  apiToken: '4c0672b6ba3e0238bf7919a1570faad04359ce0b20b732caac0731823502e63b',

  // ใช้แสดงผลในหน้า "ตั้งค่าระบบ" เท่านั้น (ค่าจริงที่เซิร์ฟเวอร์ใช้ อยู่ใน Code.gs)
  spreadsheetId: '12LzEe1Ip8Fjwc73zVe5i23_HMDNU2WLu_sVFCzvwy2g',
  driveFolderId: '1KYVWAQpvZy4hc4kKw7qBH49PjJnvQpAI',

  years: [2567, 2568, 2569, 2570, 2571],
  officeName: 'สกร.ระดับอำเภอเมืองนครศรีธรรมราช'
};
