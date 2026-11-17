(() => {
  const cfg = window.EONIX_CONFIG || {};
  const valid = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("YOUR_") && !cfg.SUPABASE_ANON_KEY.includes("YOUR_");
  window.eonixSupabaseReady = Boolean(valid && window.supabase);
  window.db = window.eonixSupabaseReady
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;
})();