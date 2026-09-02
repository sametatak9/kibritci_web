export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Meta doğrulaması için
    if (req.query['hub.verify_token'] === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(req.query['hub.challenge']);
    }
    return res.status(403).send('error');
  }

  if (req.method === 'POST') {
    try {
      const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!msg) return res.status(200).send('ok');

      const from = msg.from;
      const text = msg.text?.body || "";

      // BURASI SENİN SİSTEMİNE BAĞLANACAK YER
      // Mevcut üyelik API'ni buradan çağırıyorsun, sistemi bozmuyorsun
      // Örnek: fetch('https://senin-siten.com/api/uye-ol?tel='+from)

      // WhatsApp'a cevap at (opsiyonel)
      await fetch(`https://graph.facebook.com/v20.0/${process.env.WA_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.WA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: from, type: 'text', text: { body: `Talebin alındı: ${text}` } })
      });

      return res.status(200).send('ok');
    } catch(e){ return res.status(200).send('ok'); }
  }
          }
