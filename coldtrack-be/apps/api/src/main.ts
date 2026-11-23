import { createApi } from './app.js';
import { ConfigService } from '@nestjs/config';

const app = await createApi();
app.enableShutdownHooks();
await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'));
