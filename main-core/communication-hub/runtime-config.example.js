// Copy this file to runtime-config.js only in the deployment environment.
// The Supabase publishable key is intentionally browser-safe, but we keep
// environment-specific values out of committed application logic.
window.ONE_RUNTIME_CONFIG = {
  mode: 'supabase',
  workspaceSlug: 'neo-school-india',
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  supabasePublishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY'
};
