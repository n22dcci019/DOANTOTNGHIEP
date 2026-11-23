import { startTransport } from '../../../libs/platform/transport.js';

// Infrastructure bootstrap only: no command publication until outbox is implemented.
await startTransport('publisher');
