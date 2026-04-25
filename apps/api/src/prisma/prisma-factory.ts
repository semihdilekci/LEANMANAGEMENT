import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@leanmgmt/prisma-client';

/**
 * Prisma 7: bağlantı `datasource` URL’i yalnızca `prisma.config` / migrate tarafında;
 * runtime’da `pg` sürücü adaptörü zorunlu.
 */
export function createPrismaClient(datasourceUrl: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: datasourceUrl }),
  });
}
