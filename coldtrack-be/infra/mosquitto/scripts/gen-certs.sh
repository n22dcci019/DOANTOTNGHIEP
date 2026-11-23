#!/bin/sh
set -eu
cd /work
if [ -e certs/server.key ] || [ -e secrets/test-password ] || [ -e secrets/passwords ]; then
  echo 'TLS/credentials already exist; refusing to overwrite. Reuse existing files.' >&2
  exit 1
fi
# The existing Mosquitto image is Alpine-based; install OpenSSL in this
# disposable setup container only, never in the broker or on the host.
apk add --no-cache openssl
umask 077
mkdir -p certs secrets
openssl req -x509 -newkey rsa:3072 -nodes -days 365 -sha256 \
  -keyout certs/ca.key -out certs/ca.crt -subj '/CN=ColdTrack Local CA' \
  -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign'
openssl req -newkey rsa:3072 -nodes -keyout certs/server.key \
  -out certs/server.csr -subj '/CN=mosquitto'
printf '%s\n' 'subjectAltName=DNS:mosquitto,DNS:localhost,IP:127.0.0.1' \
  'basicConstraints=critical,CA:FALSE' 'keyUsage=critical,digitalSignature,keyEncipherment' \
  'extendedKeyUsage=serverAuth' > certs/server.ext
openssl x509 -req -in certs/server.csr -CA certs/ca.crt -CAkey certs/ca.key \
  -CAcreateserial -out certs/server.crt -days 365 -sha256 -extfile certs/server.ext
openssl rand -hex 32 > secrets/test-password
password=$(cat secrets/test-password)
mosquitto_passwd -b -c secrets/passwords coldtrack-test "$password"
unset password
chown 1883:1883 certs/server.key secrets/passwords
chmod 755 certs secrets
chmod 640 certs/server.key secrets/passwords
chmod 644 certs/ca.crt certs/server.crt secrets/test-password
echo 'Created local TLS certificates and coldtrack-test credential; no secret printed.'
