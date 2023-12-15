import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisCacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  public async get(key: string) {
    return await this.cacheManager.get(key);
  }

  public async set(key: string, value: any, ttl = 0) {
    return await this.cacheManager.set(key, value, { ttl });
  }

  public async del(key: string) {
    return await this.cacheManager.del(key);
  }

  public async keys(key: string) {
    return await this.cacheManager.keys(key);
  }

  public async mget(key: [string]) {
    return await this.cacheManager.mget(key);
  }

  public async getTtl(key: string) {
    return await this.cacheManager.ttl(key);
  }
}
