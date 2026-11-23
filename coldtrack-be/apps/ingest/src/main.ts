import { startTransport } from '../../../libs/platform/transport.js';

// Infrastructure bootstrap only: no subscriptions or telemetry ACK until ingest is implemented.
await startTransport('ingest');
