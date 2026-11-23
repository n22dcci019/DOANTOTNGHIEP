import { bootstrap } from '../../../libs/platform/bootstrap.js';

// Infrastructure bootstrap only: no command publication until outbox is implemented.
await bootstrap('worker');
