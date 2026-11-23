import { bootstrap } from '../../../libs/platform/bootstrap.js';

// Infrastructure bootstrap only: no subscriptions or telemetry ACK until ingest is implemented.
await bootstrap('ingest');
