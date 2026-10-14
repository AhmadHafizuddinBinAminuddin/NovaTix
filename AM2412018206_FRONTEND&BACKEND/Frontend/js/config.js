/**
 * NovaTix Configuration File
 * Authoritative Backend Base URL and Constants
 */

const CONFIG = {
  // Base URL pointing directly to the PHP API endpoint handler
  API_BASE_URL: 'http://localhost/NovaTix/api.php',
  
  // Storage Keys for Local Session Management
  STORAGE_KEY_TOKEN: 'novatix_jwt_token',
  STORAGE_KEY_USER: 'novatix_user_data',

  // Fallback visual assets for Cyberpunk/Neon Futuristic styling
  DEFAULT_EVENT_IMAGES: [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=600&q=80'
  ],

  DEFAULT_VENUE_IMAGES: [
    'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80'
  ]
};