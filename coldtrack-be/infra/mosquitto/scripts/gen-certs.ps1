$ErrorActionPreference = 'Stop'
$mqttDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
docker run --rm --user 0 --entrypoint sh --mount "type=bind,source=$mqttDirectory,target=/work" eclipse-mosquitto:2 /work/scripts/gen-certs.sh
if ($LASTEXITCODE -ne 0) { throw 'Certificate/password setup failed' }
