/**
 * Thai Copy Dictionary
 *
 * All user-facing strings in Thai.
 * Organized by feature/context.
 */
export const th = {
  // ---- App ----
  app: {
    name: 'LINE OA Admin',
    tagline: 'จัดการข้อความ LINE OA ของคุณ',
  },

  // ---- Navigation ----
  nav: {
    inbox: 'กล่องข้อความ',
    search: 'ค้นหา',
    contacts: 'ผู้ติดต่อ',
    overview: 'สรุปภาพรวม',
    settings: 'การตั้งค่า',
  },

  // ---- Auth ----
  auth: {
    login: 'เข้าสู่ระบบ',
    loginWithLine: 'เข้าสู่ระบบด้วย LINE',
    logout: 'ออกจากระบบ',
    logoutConfirm: 'คุณต้องการออกจากระบบหรือไม่?',
    sessionExpired: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง',
    unauthorized: 'ไม่มีสิทธิ์เข้าถึง',
    loginFailed: 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    loginHint: 'เฉพาะผู้ดูแล LINE OA ที่ได้รับอนุญาตเท่านั้น',
    loading: 'กำลังตรวจสอบ...',
  },

  // ---- Inbox ----
  inbox: {
    title: 'กล่องข้อความ',
    pinned: 'แชทที่ปักหมุด',
    all: 'ทั้งหมด',
    unread: 'ยังไม่ได้อ่าน',
    archived: 'ที่เก็บถาวร',
    empty: 'ยังไม่มีข้อความ',
    emptyTitle: 'ยังไม่มีแชท',
    emptyDescription: 'ข้อความจะปรากฏที่นี่เมื่อมีคนส่งข้อความมาทาง LINE OA',
    emptyDesc: 'ข้อความจะปรากฏที่นี่เมื่อมีคนส่งข้อความมาทาง LINE OA',
    searchPlaceholder: 'ค้นหาแชท',
    markRead: 'อ่านแล้ว',
    pin: 'ปักหมุด',
    unpin: 'เลิกปักหมุด',
    archive: 'เก็บถาวร',
    unarchive: 'เลิกเก็บถาวร',
  },

  // ---- Chat ----
  chat: {
    composerPlaceholder: 'พิมพ์ข้อความ...',
    send: 'ส่ง',
    reply: 'ตอบกลับ',
    note: 'บันทึก',
    notePlaceholder: 'เขียนบันทึกส่วนตัว...',
    noteEmpty: 'ยังไม่มีบันทึก',
    noteSaved: 'บันทึกแล้ว',
    loadMore: 'โหลดเพิ่มเติม',
    scrollToBottom: 'เลื่อนลงสุด',
    noMessages: 'ยังไม่มีข้อความ',
    searchInChat: 'ค้นหาในแชทนี้',
  },

  // ---- Message Types ----
  messageType: {
    text: 'ข้อความ',
    image: 'รูปภาพ',
    video: 'วิดีโอ',
    audio: 'เสียง',
    file: 'ไฟล์',
    sticker: 'สติกเกอร์',
    location: 'ตำแหน่ง',
    flex: 'Flex Message',
    template: 'เทมเพลต',
    unknown: 'ไม่ทราบชนิด',
  },

  // ---- Delivery Status ----
  status: {
    sending: 'กำลังส่ง',
    sent: 'ส่งแล้ว',
    delivered: 'ส่งถึงแล้ว',
    read: 'อ่านแล้ว',
    failed: 'ส่งไม่สำเร็จ',
    retry: 'ลองส่งอีกครั้ง',
    pending: 'รอดำเนินการ',
  },

  // ---- Media / Attachments ----
  media: {
    processing: 'กำลังประมวลผล...',
    processingDesc: 'ไฟล์กำลังถูกประมวลผล กรุณารอสักครู่',
    downloadOriginal: 'ดาวน์โหลดต้นฉบับ',
    preview: 'ดูตัวอย่าง',
    open: 'เปิด',
    download: 'ดาวน์โหลด',
    failedToLoad: 'ไม่สามารถโหลดได้',
    tapToView: 'แตะเพื่อดู',
    play: 'เล่น',
    pause: 'หยุด',
  },

  // ---- Search ----
  search: {
    title: 'ค้นหา',
    placeholder: 'ค้นหาข้อความ, ชื่อ, ไฟล์...',
    noResults: 'ไม่พบผลลัพธ์',
    noResultsDesc: 'ลองค้นหาด้วยคำที่แตกต่างออกไป',
    filterAll: 'ทั้งหมด',
    filterText: 'ข้อความ',
    filterImage: 'รูปภาพ',
    filterFile: 'ไฟล์',
    filterDate: 'ช่วงวันที่',
    results: 'ผลลัพธ์',
    searching: 'กำลังค้นหา...',
  },

  // ---- Contacts ----
  contacts: {
    title: 'ผู้ติดต่อ',
    searchPlaceholder: 'ค้นหาผู้ติดต่อ',
    empty: 'ยังไม่มีผู้ติดต่อ',
    emptyDesc: 'ผู้ติดต่อจะปรากฏเมื่อมีคนส่งข้อความมา',
    firstSeen: 'เห็นครั้งแรก',
    lastSeen: 'เห็นล่าสุด',
    viewChat: 'ดูแชท',
    totalMessages: 'ข้อความทั้งหมด',
  },

  // ---- Tags & Labels ----
  tags: {
    title: 'จัดการแท็กและป้ายกำกับ',
    tags: 'แท็ก',
    labels: 'ป้ายกำกับ',
    create: 'สร้างใหม่',
    edit: 'แก้ไข',
    delete: 'ลบ',
    name: 'ชื่อ',
    color: 'สี',
  },

  // ---- Settings ----
  settings: {
    title: 'การตั้งค่า',
    line: 'ตั้งค่า LINE',
    lineMessaging: 'LINE Messaging API',
    lineLogin: 'LINE Login',
    storage: 'พื้นที่จัดเก็บ',
    search: 'การค้นหา',
    security: 'ความปลอดภัย',
    webhook: 'เว็บฮุก',
    webhookStatus: 'สถานะเว็บฮุก',
    webhookActive: 'เชื่อมต่อแล้ว',
    webhookInactive: 'ยังไม่เชื่อมต่อ',
    adminAccounts: 'บัญชีผู้ดูแลระบบ',
    retention: 'การเก็บรักษาข้อมูล',
    healthCheck: 'ตรวจสอบระบบ',
    save: 'บันทึก',
    saved: 'บันทึกแล้ว',
    saveFailed: 'บันทึกไม่สำเร็จ',
  },

  // ---- Overview ----
  overview: {
    title: 'สรุปภาพรวม',
    totalConversations: 'แชททั้งหมด',
    totalMessages: 'ข้อความทั้งหมด',
    totalContacts: 'ผู้ติดต่อทั้งหมด',
    unreadMessages: 'ยังไม่ได้อ่าน',
    todayMessages: 'ข้อความวันนี้',
    storageUsed: 'พื้นที่ใช้งาน',
  },

  // ---- Common ----
  common: {
    loading: 'กำลังโหลด...',
    loadMore: 'โหลดเพิ่ม',
    viewMore: 'ดูเพิ่มเติม',
    noData: 'ไม่มีข้อมูล',
    error: 'เกิดข้อผิดพลาด',
    errorDesc: 'กรุณาลองใหม่อีกครั้ง',
    retry: 'ลองใหม่',
    cancel: 'ยกเลิก',
    confirm: 'ยืนยัน',
    delete: 'ลบ',
    edit: 'แก้ไข',
    save: 'บันทึก',
    close: 'ปิด',
    back: 'กลับ',
    next: 'ถัดไป',
    yes: 'ใช่',
    no: 'ไม่',
    ok: 'ตกลง',
    done: 'เสร็จ',
    copySuccess: 'คัดลอกแล้ว',
    yesterday: 'เมื่อวาน',
    today: 'วันนี้',
  },

  // ---- Toast / Notifications ----
  toast: {
    messageSent: 'ส่งข้อความแล้ว',
    messageFailed: 'ส่งข้อความไม่สำเร็จ',
    copied: 'คัดลอกแล้ว',
    saved: 'บันทึกแล้ว',
    deleted: 'ลบแล้ว',
    error: 'เกิดข้อผิดพลาด',
    networkError: 'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบอินเทอร์เน็ต',
    connectionLost: 'การเชื่อมต่อถูกตัด',
    reconnecting: 'กำลังเชื่อมต่อใหม่...',
    reconnected: 'เชื่อมต่อใหม่แล้ว',
  },

  // ---- Validation ----
  validation: {
    required: 'จำเป็นต้องกรอก',
    tooShort: 'สั้นเกินไป',
    tooLong: 'ยาวเกินไป',
    invalidFormat: 'รูปแบบไม่ถูกต้อง',
  },

  // ---- Setup Wizard ----
  setup: {
    title: 'ตั้งค่าระบบ',
    subtitle: 'กรอกข้อมูลเพื่อเริ่มใช้งาน LINE OA Admin',
    lineChannelHint: 'ข้อมูลจาก LINE Developers Console → Messaging API',
    lineLoginHint: 'ข้อมูลจาก LINE Developers Console → LINE Login',
    storageHint: 'Cloudflare R2 สำหรับเก็บไฟล์รูปภาพ วิดีโอ และเอกสาร',
    next: 'ถัดไป',
    back: 'กลับ',
    skipForNow: 'ข้ามไปก่อน (ตั้งค่าทีหลังได้)',
    saveAndFinish: 'บันทึกและเสร็จสิ้น',
    saving: 'กำลังบันทึก...',
    complete: 'เสร็จแล้ว',
    completeTitle: 'ตั้งค่าสำเร็จ!',
    completeDescription: 'ระบบพร้อมใช้งานแล้ว คุณสามารถแก้ไขการตั้งค่าได้ในภายหลัง',
    goToInbox: 'ไปที่กล่องข้อความ',
  },
} as const;

export type ThaiCopy = typeof th;
