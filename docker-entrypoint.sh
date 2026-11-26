#!/bin/sh
set -e

URL_VAL="${VITE_SUPABASE_URL:-$SUPABASE_URL}"
KEY_VAL="${VITE_SUPABASE_ANON_KEY:-$SUPABASE_ANON_KEY}"

cat <<EOF > /usr/share/nginx/html/env-config.js
window.__ENV__ = {
  VITE_SUPABASE_URL: "${URL_VAL}",
  VITE_SUPABASE_ANON_KEY: "${KEY_VAL}"
};
EOF
