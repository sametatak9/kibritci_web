/** Catch-all Express'e düşmeden Vercel fonksiyonunun ayakta olduğunu doğrular. */
module.exports = function vercelPing(_req, res) {
  res.status(200).json({
    ok: true,
    via: 'vercel-ping',
    timestamp: new Date().toISOString(),
  });
};
