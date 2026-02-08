## Health check

```ts
import { HealthCheckResult } from '@storehouse/core/lib/manager';

export class PGManager<T extends PoolClient = PoolClient> extends PGPool<T> implements IManager {
  // ... existing code ...

  isConnected(): boolean {
    return !this.ended && this.totalCount > 0;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    const timestamp = start;

    if (this.ended) {
      return {
        healthy: false,
        message: 'Connection pool has ended',
        details: {
          name: this.name,
          ended: true
        },
        timestamp
      };
    }

    try {
      // Try to acquire a client and run a simple query
      const client = await this.connect();
      
      try {
        await client.query('SELECT 1 as health_check');
        client.release();
        
        const latency = Date.now() - start;
        
        return {
          healthy: true,
          message: 'PostgreSQL connection is healthy',
          details: {
            name: this.name,
            totalCount: this.totalCount,
            idleCount: this.idleCount,
            waitingCount: this.waitingCount,
            latency: `${latency}ms`
          },
          latency,
          timestamp
        };
      } catch (queryError) {
        client.release(true); // release with error
        throw queryError;
      }
    } catch (error) {
      return {
        healthy: false,
        message: `PostgreSQL health check failed: ${error instanceof Error ? error.message : String(error)}`,
        details: {
          name: this.name,
          totalCount: this.totalCount,
          idleCount: this.idleCount,
          waitingCount: this.waitingCount,
          error: error instanceof Error ? error.stack : String(error)
        },
        latency: Date.now() - start,
        timestamp
      };
    }
  }
}
```

## Import Custom Error Classes

```ts
import Logger from '@novice1/logger';
import { 
  IManager, 
  ManagerArg,
  HealthCheckResult 
} from '@storehouse/core/lib/manager';
import { Registry } from '@storehouse/core/lib/registry';
import { 
  ManagerNotFoundError,
  InvalidManagerConfigError
} from '@storehouse/core/lib/errors';
import { randomBytes } from 'crypto';
import { Pool, PoolClient, PoolConfig } from 'pg';
import { EventEmitter } from 'events';

export function getManager<M extends PGManager = PGManager>(
  registry: Registry, 
  managerName?: string
): M {
  const manager = registry.getManager<M>(managerName);
  if (!manager) {
    throw new ManagerNotFoundError(managerName || registry.defaultManager);
  }
  if (!(manager instanceof PGManager)) {
    throw new InvalidManagerConfigError(
      `Manager "${managerName || registry.defaultManager}" is not instance of PGManager`
    );
  }
  return manager;
}

export async function getConnection<T extends PoolClient = PoolClient>(
  registry: Registry, 
  managerName?: string
): Promise<T> {
  const conn = await registry.getConnection<Promise<T>>(managerName);
  if (!conn) {
    throw new ManagerNotFoundError(managerName || registry.defaultManager);
  }
  return conn;
}
```

Changed:
- Classes and interfaces that have string PG to Pg (changed case)

Added:
- health check methods
- specific errors