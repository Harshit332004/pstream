import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/client';
import fs from 'fs';
import path from 'path';

const globalForPrisma = globalThis as unknown as {
  prisma: any;
  pool: Pool | undefined;
};

// Simple filesystem database fallback
const dbDir = path.resolve(process.cwd(), '.data/db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

function getFilePath(model: string) {
  return path.join(dbDir, `${model}.json`);
}

function readData(model: string): any[] {
  const filePath = getFilePath(model);
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function writeData(model: string, data: any[]) {
  fs.writeFileSync(getFilePath(model), JSON.stringify(data, null, 2), 'utf-8');
}

// Simulates basic Prisma methods
const mockMethods = (model: string) => {
  return {
    findMany: async (args: any = {}) => {
      let items = readData(model);
      if (args.where) {
        items = items.filter(item => {
          return Object.entries(args.where).every(([key, value]) => {
            if (value && typeof value === 'object' && 'in' in value) {
              return (value.in as any[]).includes(item[key]);
            }
            return item[key] === value;
          });
        });
      }
      if (args.orderBy) {
        // Sort
        const sortKey = Object.keys(args.orderBy)[0];
        const sortOrder = args.orderBy[sortKey];
        items.sort((a, b) => {
          const valA = a[sortKey];
          const valB = b[sortKey];
          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      }
      if (args.take) {
        items = items.slice(0, args.take);
      }
      return items;
    },
    findUnique: async (args: any) => {
      const items = readData(model);
      return items.find(item => {
        if (args.where.id) return item.id === args.where.id;
        // handle compound unique like tmdb_id_user_id_season_id_episode_id
        return Object.entries(args.where).every(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            return Object.entries(value).every(([subKey, subVal]) => item[subKey] === subVal);
          }
          return item[key] === value;
        });
      }) || null;
    },
    findFirst: async (args: any = {}) => {
      const items = await mockMethods(model).findMany(args);
      return items[0] || null;
    },
    create: async (args: any) => {
      const items = readData(model);
      const newItem = {
        id: args.data.id || Math.random().toString(36).substring(2, 11),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...args.data
      };
      items.push(newItem);
      writeData(model, items);
      return newItem;
    },
    update: async (args: any) => {
      const items = readData(model);
      const index = items.findIndex(item => {
        if (args.where.id) return item.id === args.where.id;
        return Object.entries(args.where).every(([key, value]) => item[key] === value);
      });
      if (index === -1) throw new Error(`Record not found in ${model}`);
      items[index] = {
        ...items[index],
        ...args.data,
        updated_at: new Date().toISOString()
      };
      writeData(model, items);
      return items[index];
    },
    upsert: async (args: any) => {
      const items = readData(model);
      const index = items.findIndex(item => {
        // Compound unique key check (e.g. tmdb_id_user_id_season_id_episode_id)
        if (args.where.tmdb_id_user_id_season_id_episode_id) {
          const keyObj = args.where.tmdb_id_user_id_season_id_episode_id;
          return item.tmdb_id === keyObj.tmdb_id &&
                 item.user_id === keyObj.user_id &&
                 item.season_id === keyObj.season_id &&
                 item.episode_id === keyObj.episode_id;
        }
        return Object.entries(args.where).every(([key, value]) => {
          if (value && typeof value === 'object') {
            return Object.entries(value).every(([subKey, subVal]) => item[subKey] === subVal);
          }
          return item[key] === value;
        });
      });
      if (index >= 0) {
        items[index] = {
          ...items[index],
          ...args.update,
          updated_at: new Date()
        };
        writeData(model, items);
        return items[index];
      } else {
        const newItem = {
          id: Math.random().toString(36).substring(2, 11),
          created_at: new Date(),
          updated_at: new Date(),
          ...args.create
        };
        items.push(newItem);
        writeData(model, items);
        return newItem;
      }
    },
    delete: async (args: any) => {
      const items = readData(model);
      const index = items.findIndex(item => item.id === args.where.id);
      if (index === -1) throw new Error(`Record not found in ${model}`);
      const deleted = items.splice(index, 1)[0];
      writeData(model, items);
      return deleted;
    },
    deleteMany: async (args: any = {}) => {
      let items = readData(model);
      const initialCount = items.length;
      if (args.where) {
        items = items.filter(item => {
          return !Object.entries(args.where).every(([key, value]) => item[key] === value);
        });
      } else {
        items = [];
      }
      writeData(model, items);
      return { count: initialCount - items.length };
    }
  };
};

const mockPrisma = new Proxy({}, {
  get(target, prop) {
    if (prop === '$transaction') {
      return async (promises: any[]) => {
        return Promise.all(promises);
      };
    }
    if (typeof prop === 'string') {
      return mockMethods(prop);
    }
    return undefined;
  }
});

const databaseUrl = process.env.DATABASE_URL;
let realPrisma: PrismaClient | null = null;

if (databaseUrl && databaseUrl.trim() !== '') {
  try {
    const isSupabase = process.env.DB_PROVIDER === 'supabase';
    const pool = new Pool({
      connectionString: isSupabase
        ? (process.env.DATABASE_URL_SUPABASE ?? databaseUrl)
        : databaseUrl,
      max: Math.max(1, parseInt(process.env.DB_POOL_MAX, 10) || (isSupabase ? 10 : 30)),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 300000,
    });
    const adapter = new PrismaPg(pool, isSupabase ? { pgBouncer: true } : undefined);
    realPrisma = new PrismaClient({ adapter });
  } catch (e) {
    console.warn('Failed to initialize PrismaClient database connection:', e);
  }
}

// Wrap in a proxy that dynamically routes to real Prisma or falls back to local fs on failure
export const prisma = new Proxy({}, {
  get(target, prop) {
    if (prop === '$transaction') {
      return async function (promises: any[]) {
        if (realPrisma) {
          try {
            return await realPrisma.$transaction(promises);
          } catch (err: any) {
            const errMsg = (err.message || '').toLowerCase();
            const errCode = (err.code || '').toUpperCase();
            if (
              errMsg.includes('p1001') ||
              errMsg.includes('can\'t reach database') ||
              errMsg.includes('connection') ||
              errMsg.includes('econnrefused') ||
              errMsg.includes('invocation') ||
              errCode === 'ECONNREFUSED' ||
              errCode === 'P1001'
            ) {
              console.warn(`Prisma transaction connection error (code: ${errCode}), throwing connection error for caller fallback:`, err.message?.substring(0, 100));
            }
            throw err;
          }
        }
        return await (mockPrisma as any).$transaction(promises);
      };
    }

    if (realPrisma) {
      const realProp = (realPrisma as any)[prop];
      if (typeof realProp === 'object' && realProp !== null) {
        return new Proxy(realProp, {
          get(subTarget, subProp) {
            const originalMethod = realProp[subProp];
            if (typeof originalMethod === 'function') {
              return async function (...args: any[]) {
                try {
                  return await originalMethod.apply(realProp, args);
                } catch (err: any) {
                  const errMsg = (err.message || '').toLowerCase();
                  const errCode = (err.code || '').toUpperCase();
                  if (
                    errMsg.includes('p1001') ||
                    errMsg.includes('can\'t reach database') ||
                    errMsg.includes('connection') ||
                    errMsg.includes('econnrefused') ||
                    errMsg.includes('invocation') ||
                    errCode === 'ECONNREFUSED' ||
                    errCode === 'P1001'
                  ) {
                    console.warn(`Prisma connection error (code: ${errCode}), falling back to local file storage for model "${String(prop)}":`, err.message?.substring(0, 100));
                    return await (mockPrisma as any)[prop][subProp](...args);
                  }
                  throw err;
                }
              };
            }
            return originalMethod;
          }
        });
      }
      return realProp;
    }
    
    // No real database URL, use filesystem mock
    return (mockPrisma as any)[prop];
  }
});
