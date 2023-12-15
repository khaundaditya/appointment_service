import { Module, CacheModule, Inject, CACHE_MANAGER } from '@nestjs/common';
import { Cache } from 'cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { RedisCacheService } from './redis.service';

@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      host: process.env.REDIS_HOST,
      //password: process.env.REDIS_PASSWORD,
      port: +process.env.REDIS_PORT,
    }),
  ],
  providers: [RedisCacheService],
  exports: [RedisCacheService, RedisCacheModule],
})
export class RedisCacheModule {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}
}
