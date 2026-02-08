# @storehouse/pg

PostgreSQL manager for @storehouse/core.

[Documentation](https://kisiwu.github.io/storehouse/pg/latest/).

## Installation

Make sure you have [@storehouse/core](https://www.npmjs.com/package/@storehouse/core) and [pg](https://www.npmjs.com/package/pg) installed.

```bash
npm install @storehouse/pg
```

## Usage

### Basic


```ts
import { Storehouse } from '@storehouse/core'
import { PgManager } from '@storehouse/pg'

// register
Storehouse.add({
  local: {
    // type: '@storehouse/pg' if you called Storehouse.setManagerType(PgManager)
    type: PgManager,

    // pool configuration
    config: {
      database: 'database',
      host: 'localhost',
      port: 5432,
      user: 'admin',
      password: '',
      ssl: {
        rejectUnauthorized: false
      },
      max: 20,
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 10000
    }
  }
})
```

After the manager has been added, you can use it as a pool to query the database.

```ts
import { Storehouse } from '@storehouse/core'
import { PgManager } from '@storehouse/pg'
import { PoolClient } from 'pg'

/**
 * only defined to read the property 'database'
 */
interface MyPoolClient extends PoolClient {
  database?: string
}

// acquire a client from the pool
const conn = await Storehouse.getConnection<Promise<MyPoolClient>>('local')
if (conn) {
  console.log('retrieved connection for database', conn.database)
}

// manager
const localManager = Storehouse.getManager<PgManager<MyPoolClient>>('local')
if (localManager) {
  console.log(
    'nb movies',
    (
      await localManager.query<{ count: string }>(
        'SELECT count(*) FROM myschema.movies'
      )
    ).rows
  )
}

// release a client
conn?.release(true)

// release all clients for the pool
await localManager?.releaseAll(true)

// release all clients and end the pool
await localManager?.closeConnection(true)
```

### Logs

You can enable logs with the package [debug](https://www.npmjs.com/package/debug).

```ts
import debug from 'debug'
debug.enable('@storehouse/pg*')
```

### Helpers

There are methods to help you retrieve the connection and the manager so you don't have to check if they are undefined.
Those methods throw an error when they fail.

```ts
import { Storehouse } from '@storehouse/core'
import { getConnection, getManager } from '@storehouse/pg'
import { PoolClient } from 'pg'

/**
 * only defined to read the property 'database'
 */
interface MyPoolClient extends PoolClient {
  database?: string
}

// acquire a client from the pool
const conn = await getConnection<MyPoolClient>(Storehouse, 'local')
console.log('retrieved connection for database', conn.database)

// manager
const manager = getManager(Storehouse, 'local')
console.log(
  'nb movies',
  (
    await manager.query<{ count: string }>(
      'SELECT count(*) FROM myschema.movies'
    )
  ).rows
)
```

### Target a schema by default

If you need each query to target the same schema and don't want to explicitly write it for every query, you can set the `search_path` each time a client connects.

```ts
import { Storehouse } from '@storehouse/core'
import { getManager } from '@storehouse/pg'

// manager
const manager = getManager(Storehouse, 'local')
manager.on('connect', client => {
  // set the search_path for each new client to 'myschema'
  client.query('SET search_path TO myschema')
})

// query table 'movies'
const result = await manager.query('SELECT * FROM movies LIMIT 100')
console.log(result.rows)
```

## References

- [Documentation](https://kisiwu.github.io/storehouse/pg/latest/)
- [@storehouse/core](https://www.npmjs.com/package/@storehouse/core)
- [pg](https://www.npmjs.com/package/pg)
