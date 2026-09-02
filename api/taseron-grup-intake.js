/** Lightweight GET — catch-all Express'e düşmeden otomasyon sözleşmesi. */
module.exports = function taseronGrupIntake(_req, res) {
  const verify = Boolean(String(process.env.WHATSAPP_VERIFY_TOKEN || '').trim());
  const access = Boolean(String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim());
  const phoneId = Boolean(String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim());
  const intake = Boolean(String(process.env.TASERON_GRUP_INTAKE_SECRET || '').trim());
  const admin = Boolean(
    String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim()
  );
  res.status(200).json({
    success: true,
    sozlesme: {
      grupAdi: 'Arnavutköy İşe Giriş',
      kaynak: 'TASERON_GRUP',
      hat: '0501 683 3400',
      endpoint: 'POST /api/taseron-grup-intake',
      whatsappWebhook: '/api/webhooks/whatsapp-taseron-grup',
      kadro: 'yazılmaz — Onay kuyruğu',
      grupDinleme: false,
      intakeSecretConfigured: intake,
      whatsappConfigured: verify && access,
      whatsappSendConfigured: access && phoneId,
      adminConfigured: admin,
      not:
        'PDF 0501 683 3400 hattına iletilir. İşveren Kibritçi ise SGK_GRUP (görev boş/arafta, yoklama ezilmez); değilse TASERON_GRUP. Kadro yalnızca Onay’da. Bildirim: Onay sonrası wa: gönderene Cloud API metin.',
    },
  });
};
module.exports.config = { maxDuration: 10 };
