# @storehouse/pg

PostgreSQL connection pool manager adapter for [@storehouse/core](https://www.npmjs.com/package/@storehouse/core). Provides seamless integration with [PostgreSQL](https://www.postgresql.org/) using the official [node-postgres](https://www.npmjs.com/package/pg) driver.

## Features

- **Type-safe PostgreSQL operations** with TypeScript support
- **Connection pool management** with automatic event logging
- **Health check utilities** for monitoring connection pool status
- **Multi-manager support** via Storehouse registry
- **Coordinated client release** with releaseAll functionality
- **Full pg Pool API** compatibility

## Prerequisites

- **PostgreSQL server**
- **Node.js** 18 or higher

## Installation

```bash
npm install @storehouse/core pg @storehouse/pg
```

## Quick Start

### 1. Register the Manager

**index.ts**
```ts
import { Storehouse } from '@storehouse/core';
import { PgManager } from '@storehouse/pg';

// Register the manager
Storehouse.add({
  postgres: {
    type: PgManager,
    config: {
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      user: 'postgres',
      password: 'password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    }
  }
});
```

### 2. Query the Database

```ts
import { Storehouse } from '@storehouse/core';
import { PgManager } from '@storehouse/pg';

// Get the manager
const manager = Storehouse.getManager<PgManager>('postgres');

if (manager) {
  // Query directly using the pool
  const result = await manager.query('SELECT * FROM users WHERE id = $1', [1]);
  console.log('User:', result.rows[0]);
  
  // Or acquire a client for multiple queries
  const client = await manager.getConnection();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO users (name, email) VALUES ($1, $2)', ['John', 'john@example.com']);
    await client.query('INSERT INTO audit_log (action) VALUES ($1)', ['user_created']);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

## API Reference

### Helper Functions

The package provides helper functions that throw errors instead of returning undefined, making your code cleaner and safer.

#### `getManager()`

Retrieves a PgManager instance from the registry.

```ts
import { Storehouse } from '@storehouse/core';
import { getManager } from '@storehouse/pg';

const manager = getManager(Storehouse, 'postgres');
const result = await manager.query('SELECT NOW()');
```

**Throws:**
- `ManagerNotFoundError` - If the manager doesn't exist
- `InvalidManagerConfigError` - If the manager is not a PgManager instance

#### `getConnection()`

Retrieves a PostgreSQL client from the connection pool.

```ts
import { Storehouse } from '@storehouse/core';
import { getConnection } from '@storehouse/pg';

const client = await getConnection(Storehouse, 'postgres');
try {
  const result = await client.query('SELECT * FROM users');
  console.log(result.rows);
} finally {
  client.release();
}
```

**Throws:**
- `ManagerNotFoundError` - If the manager doesn't exist

### PgManager Class

The PgManager extends the pg Pool class with additional Storehouse integration features.

#### Methods

##### `query(queryText, values?): Promise<QueryResult>`

Executes a query using the pool. The pool will handle client acquisition and release automatically.

```ts
const result = await manager.query('SELECT * FROM users WHERE age > $1', [18]);
console.log(result.rows);
```

##### `connect(): Promise<PoolClient>`

Acquires a client from the connection pool for multiple operations.

```ts
const client = await manager.connect();
try {
  const result = await client.query('SELECT NOW()');
  console.log(result.rows[0]);
} finally {
  client.release();
}
```

##### `getConnection(): Promise<PoolClient>`

Alias for `connect()`. Acquires a client from the connection pool.

```ts
const client = await manager.getConnection();
try {
  await client.query('SELECT 1');
} finally {
  client.release();
}
```

##### `releaseAll(err?: Error | boolean): Promise<void>`

Releases all currently checked-out clients back to the pool. Useful for graceful shutdown scenarios.

```ts
// Release all clients normally
await manager.releaseAll();

// Release all clients with an error
await manager.releaseAll(new Error('Forced release'));
```

##### `closeConnection(err?: Error | boolean): Promise<void>`

Releases all clients and closes the connection pool gracefully.

```ts
// Graceful close
await manager.closeConnection();

// Close with error
await manager.closeConnection(new Error('Forced shutdown'));
```

##### `isConnected(): Promise<boolean>`

Checks if the connection pool is active and has clients available.

```ts
const connected = await manager.isConnected();
if (connected) {
  console.log('PostgreSQL pool is active');
}
```

##### `healthCheck(): Promise<PgHealthCheckResult>`

Performs a comprehensive health check including query test and pool metrics.

```ts
const health = await manager.healthCheck();

if (health.healthy) {
  console.log(`✓ PostgreSQL is healthy`);
  console.log(`  Latency: ${health.details.latency}`);
  console.log(`  Pool: ${health.details.idleCount}/${health.details.totalCount} idle`);
} else {
  console.error(`✗ PostgreSQL is unhealthy: ${health.message}`);
}
```

##### `end(): Promise<void>`

Shuts down the pool and destroys all clients.

```ts
await manager.end();
```

### Health Check Result

The health check returns a detailed result object:

- `healthy: boolean` - Overall health status
- `message: string` - Descriptive message about the health status
- `timestamp: number` - Timestamp when the health check was performed
- `latency?: number` - Response time in milliseconds
- `details: object` - Detailed pool information
  - `name: string` - Manager name
  - `totalCount?: number` - Total number of clients in the pool
  - `idleCount?: number` - Number of idle clients
  - `waitingCount?: number` - Number of clients waiting for a connection
  - `latency?: string` - Response time in ms
  - `ended?: boolean` - Whether the pool has ended
  - `error?: string` - Error details (if unhealthy)

## Advanced Usage

### Multiple Managers

You can register multiple PostgreSQL connections:

```ts
import { Storehouse } from '@storehouse/core';
import { PgManager, getManager } from '@storehouse/pg';

Storehouse.add({
  primary: {
    type: PgManager,
    config: {
      host: 'localhost',
      database: 'maindb',
      user: 'postgres',
      password: 'password'
    }
  },
  analytics: {
    type: PgManager,
    config: {
      host: 'analytics.example.com',
      database: 'analyticsdb',
      user: 'readonly',
      password: 'password'
    }
  }
});

// Access specific managers
const primaryManager = getManager(Storehouse, 'primary');
const analyticsManager = getManager(Storehouse, 'analytics');
```

### Using the Manager Type

Set the manager type to simplify configuration and use string identifiers instead of class references:

```ts
import { Storehouse } from '@storehouse/core';
import { PgManager } from '@storehouse/pg';

// Set default manager type
Storehouse.setManagerType(PgManager);

// Now you can use type string instead of class
Storehouse.add({
  postgres: {
    type: '@storehouse/pg',
    config: {
      host: 'localhost',
      database: 'mydb',
      user: 'postgres',
      password: 'password'
    }
  }
});
```

### Setting Default Schema

If you need queries to target a specific schema by default, set the `search_path` when clients connect:

```ts
import { Storehouse } from '@storehouse/core';
import { getManager } from '@storehouse/pg';

const manager = getManager(Storehouse, 'postgres');

manager.on('connect', client => {
  // Set the search_path for each new client to 'myschema'
  client.query('SET search_path TO myschema');
});

// Now queries will use 'myschema' by default
const result = await manager.query('SELECT * FROM movies LIMIT 100');
console.log(result.rows);
```

### Transaction Management

Use client checkout for transaction control:

```ts
import { Storehouse } from '@storehouse/core';
import { getConnection } from '@storehouse/pg';

const client = await getConnection(Storehouse, 'postgres');

try {
  await client.query('BEGIN');
  
  await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [100, 1]);
  await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [100, 2]);
  
  await client.query('COMMIT');
  console.log('Transaction completed successfully');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Transaction failed:', error);
  throw error;
} finally {
  client.release();
}
```

### Connection Event Handling

The manager automatically logs connection pool lifecycle events. These are logged using the `@novice1/logger` package and can be enabled with Debug mode:

```ts
import { Debug } from '@novice1/logger';

Debug.enable('@storehouse/pg*');
```

**Events logged:**
- `acquire` - Client acquired from pool
- `connect` - New client connected to database
- `error` - Connection or pool errors
- `release` - Client released back to pool
- `remove` - Client removed from pool

## TypeScript Support

The package is written in TypeScript and provides full type definitions for type-safe operations:

```ts
import { Storehouse } from '@storehouse/core';
import { PoolClient, QueryResult } from 'pg';
import { PgManager, getManager, getConnection } from '@storehouse/pg';

// Typed manager
const manager = getManager<PgManager>(Storehouse, 'postgres');

// Typed connection
const client: PoolClient = await getConnection(Storehouse, 'postgres');

// Type-safe query results
interface User {
  id: number;
  name: string;
  email: string;
}

const result = await manager.query<User>('SELECT * FROM users');
// result.rows is typed as User[]

const users: User[] = result.rows;
users.forEach(user => {
  console.log(user.name); // Fully typed
});
```

### Custom PoolClient Types

You can extend PoolClient with custom properties:

```ts
import { PoolClient } from 'pg';
import { PgManager } from '@storehouse/pg';

interface MyPoolClient extends PoolClient {
  database?: string;
}

const manager = Storehouse.getManager<PgManager<MyPoolClient>>('postgres');
const client = await manager.getConnection();
console.log('Database:', client.database);
```

## Error Handling

All helper functions throw specific errors for better error handling:

```ts
import { Storehouse } from '@storehouse/core';
import { getManager, getConnection } from '@storehouse/pg';
import {
  ManagerNotFoundError,
  InvalidManagerConfigError
} from '@storehouse/core';

try {
  const manager = getManager(Storehouse, 'nonexistent');
} catch (error) {
  if (error instanceof ManagerNotFoundError) {
    console.error('Manager not found:', error.message);
  } else if (error instanceof InvalidManagerConfigError) {
    console.error('Invalid manager type:', error.message);
  }
}

try {
  const client = await getConnection(Storehouse, 'nonexistent');
} catch (error) {
  if (error instanceof ManagerNotFoundError) {
    console.error('Manager not found:', error.message);
  }
}
```

## Best Practices

1. **Use the pool for simple queries** - Let the pool handle client acquisition and release automatically
2. **Check out clients for transactions** - Use `getConnection()` to acquire clients for transaction blocks
3. **Always release clients** - Use try/finally blocks to ensure clients are released
4. **Use health checks** - Monitor connection pool health in production environments
5. **Configure pool limits** - Set appropriate `max` and `min` pool sizes based on your workload
6. **Handle connection errors** - Implement reconnection and retry logic for critical operations
7. **Close pools on shutdown** - Call `closeConnection()` when shutting down your application
8. **Use prepared statements** - Use parameterized queries ($1, $2, etc.) to prevent SQL injection
9. **Monitor pool metrics** - Check `totalCount`, `idleCount`, and `waitingCount` regularly

## Resources

- [Documentation](https://kisiwu.github.io/storehouse/pg/latest/)
- [@storehouse/core](https://www.npmjs.com/package/@storehouse/core)
- [node-postgres (pg)](https://www.npmjs.com/package/pg)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## License

MIT
