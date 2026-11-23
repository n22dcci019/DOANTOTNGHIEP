#!/bin/sh
set -eu
password=$(cat /mosquitto/secrets/test-password)
topic="coldtrack/test/tls-$$"
output=$(mktemp)
trap 'rm -f "$output"' EXIT
mosquitto_sub -h mosquitto -p 8883 --cafile /mosquitto/certs/ca.crt \
  -u coldtrack-test -P "$password" -t "$topic" -C 1 -W 10 > "$output" &
subscriber=$!
sleep 1
mosquitto_pub -h mosquitto -p 8883 --cafile /mosquitto/certs/ca.crt \
  -u coldtrack-test -P "$password" -t "$topic" -m coldtrack-tls-ok
wait "$subscriber"
test "$(cat "$output")" = coldtrack-tls-ok
echo 'PASS: authenticated TLS publish/subscribe'
if mosquitto_pub -h mosquitto -p 8883 --cafile /mosquitto/certs/ca.crt \
  -t "$topic" -m anonymous 2>/dev/null; then
  echo 'FAIL: anonymous connection accepted'; exit 1
fi
echo 'PASS: anonymous TLS connection rejected'
if mosquitto_pub -h mosquitto -p 1883 -u coldtrack-test -P "$password" \
  -t "$topic" -m plaintext 2>/dev/null; then
  echo 'FAIL: plaintext connection accepted'; exit 1
fi
echo 'PASS: plaintext port 1883 refused'
