import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { connect } from 'mqtt';
import { randomUUID } from 'node:crypto';

// Runs real dependency probes against the local stack, not business/telemetry tests.
const env = parse(readFileSync('.env'));
assert.equal(env.NODE_ENV, 'development');
assert.equal(env.MQTT_URL, 'mqtt://127.0.0.1:1883');

for (const [index, role] of ['api', 'ingest', 'worker'].entries()) {
  const port = 3300 + index;
  const child = spawn(process.execPath, [`dist/apps/${role}/src/main.js`], {
    env: {
      ...process.env,
      ...env,
      HOST: '127.0.0.1',
      [`${role.toUpperCase()}_PORT`]: String(port),
    },
    windowsHide: true,
    stdio: 'ignore',
  });
  let spawnError;
  child.on('error', (error) => {
    spawnError = error;
  });
  try {
    let started = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (spawnError) throw new Error(`Could not launch ${role}`);
      if (child.exitCode !== null)
        throw new Error(`${role} exited during bootstrap`);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health/live`, {
          signal: AbortSignal.timeout(1000),
        });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).service, role);
        assert.ok(response.headers.get('x-request-id'));
        started = true;
        break;
      } catch {
        await setTimeout(250);
      }
    }
    assert.ok(started, `${role} startup timeout`);
    let ready = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const response = await fetch(`http://127.0.0.1:${port}/health/ready`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.status === 200) {
        assert.equal((await response.json()).ready, true);
        ready = true;
        break;
      }
      await setTimeout(500);
    }
    assert.ok(ready, `${role} dependencies not ready`);
    if (role === 'api') {
      const docs = await fetch(`http://127.0.0.1:${port}/api/docs-json`);
      assert.equal(docs.status, 200);
      assert.ok((await docs.json()).openapi);
    }
    console.log(
      `PASS ${role}: bootstrap, liveness, dependency readiness${role === 'api' ? ', OpenAPI' : ''}`,
    );
  } finally {
    child.kill();
  }
}

const device = parse(readFileSync('infra/mosquitto/device.env'));
const mqtt = connect(env.MQTT_URL, {
  username: device.MQTT_USERNAME,
  password: device.MQTT_PASSWORD,
  protocolVersion: 5,
  reconnectPeriod: 0,
  connectTimeout: 5000,
});
try {
  await new Promise((resolve, reject) => {
    mqtt.once('connect', resolve);
    mqtt.once('error', reject);
  });
  const allowed = await mqtt.subscribeAsync(
    `devices/${device.MQTT_USERNAME}/commands`,
    { qos: 1 },
  );
  assert.equal(allowed[0].qos, 1);
  // Legacy Mosquitto acl_file can accept SUBSCRIBE but filters unauthorized deliveries.
  // Verify actual isolation instead of equating SUBACK with permission to read data.
  const forbiddenTopic = 'devices/NOT-ASSIGNED/commands';
  try {
    await mqtt.subscribeAsync(forbiddenTopic, { qos: 1 });
  } catch {
    /* Explicit subscription rejection also enforces isolation. */
  }
  const nonce = randomUUID();
  const ownTopic = `devices/${device.MQTT_USERNAME}/commands`;
  const received = [];
  mqtt.on('message', (topic, body) => {
    if (body.toString() === nonce) received.push(topic);
  });
  const publisher = connect(env.MQTT_URL, {
    username: env.MQTT_WORKER_USERNAME,
    password: env.MQTT_WORKER_PASSWORD,
    protocolVersion: 5,
    reconnectPeriod: 0,
    connectTimeout: 5000,
  });
  try {
    await new Promise((resolve, reject) => {
      publisher.once('connect', resolve);
      publisher.once('error', reject);
    });
    // Harmless random probe, not a device command; local loopback broker only.
    await publisher.publishAsync(forbiddenTopic, nonce, {
      qos: 1,
      retain: false,
    });
    await publisher.publishAsync(ownTopic, nonce, { qos: 1, retain: false });
    for (
      let attempt = 0;
      attempt < 20 && !received.includes(ownTopic);
      attempt++
    )
      await setTimeout(250);
    assert.ok(received.includes(ownTopic), 'Own-topic probe must arrive');
    await setTimeout(1000);
    assert.ok(
      !received.includes(forbiddenTopic),
      'Cross-device data must not arrive',
    );
  } finally {
    await publisher.endAsync(true);
  }
  console.log(
    'PASS MQTT: device authentication, own-topic delivery, cross-device data isolation',
  );
} finally {
  await mqtt.endAsync(true);
}
