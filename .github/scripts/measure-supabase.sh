#!/usr/bin/env bash
set -euo pipefail

runtime=${1:?Supply legacy, docker or native}
phase=${2:?Supply cold or warm}
status_file="$RUNNER_TEMP/supabase.env"

case "$runtime" in
  legacy)
    start=(supabase start --exclude studio,postgres-meta,logflare,vector,edge-runtime)
    status=(supabase status -o env)
    ;;
  docker|native)
    export SUPABASE_EXPERIMENTAL_STACK=1
    start=(supabase start --runtime "$runtime" --exclude studio,analytics,functions)
    status=(supabase status --env --output-format text)
    ;;
  *) exit 2 ;;
esac

if [[ "$phase" == warm ]]; then
  if [[ "$runtime" == legacy ]]; then
    supabase stop --no-backup >/dev/null
  else
    supabase stack destroy --yes >/dev/null
  fi
fi

begin=$(date +%s%3N)
"${start[@]}" > /dev/null
started=$(date +%s%3N)
echo "supabase_start mode=$runtime cache=$phase duration_ms=$((started - begin))"
umask 077
"${status[@]}" > "$status_file"
# shellcheck disable=SC1090
source "$status_file"
case "$API_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) exit 2 ;;
esac

request() {
  curl --fail --silent --show-error --max-time 90 \
    --header "apikey: $SERVICE_ROLE_KEY" \
    --header "Authorization: Bearer $SERVICE_ROLE_KEY" "$@"
}

auth_probe() {
  local email password
  email="benchmark-$(openssl rand -hex 12)@example.test"
  password=$(openssl rand -hex 18)
  request --json "$(jq -cn --arg email "$email" --arg password "$password" \
    '{email:$email,password:$password,email_confirm:true}')" \
    "$API_URL/auth/v1/admin/users" | jq -e '.id | type == "string"' >/dev/null
  request --json "$(jq -cn --arg email "$email" --arg password "$password" \
    '{email:$email,password:$password}')" \
    "$API_URL/auth/v1/token?grant_type=password" | jq -e '.access_token | type == "string"' >/dev/null
  echo "supabase_ready mode=$runtime cache=$phase service=auth duration_ms=$(($(date +%s%3N) - begin))"
}

storage_probe() {
  local object="$API_URL/storage/v1/object/avatars/benchmark-$(openssl rand -hex 12).png"
  local png=iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=
  printf '%s' "$png" | base64 -d | request -H 'content-type: image/png' --data-binary @- "$object" > /dev/null
  test "$(request "$object" | base64 -w0)" = "$png"
  echo "supabase_ready mode=$runtime cache=$phase service=storage duration_ms=$(($(date +%s%3N) - begin))"
}

auth_probe &
auth_pid=$!
storage_probe &
storage_pid=$!
result=0
wait "$auth_pid" || result=1
wait "$storage_pid" || result=1
exit "$result"
