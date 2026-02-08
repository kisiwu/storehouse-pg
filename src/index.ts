import Logger from '@novice1/logger';
import {
    HealthCheckResult,
    IManager,
    InvalidManagerConfigError,
    ManagerArg,
    ManagerNotFoundError,
    Registry,
} from '@storehouse/core';
import { EventEmitter } from 'events';
import { randomBytes } from 'node:crypto';
import { Pool, PoolClient, PoolConfig } from 'pg';

const Log = Logger.debugger('@storehouse/pg:manager');

/**
 * Extended PostgreSQL connection pool with automatic client release management.
 * Provides event-based release coordination for all clients in the pool.
 *
 * @template T - The PoolClient type, defaults to PoolClient
 *
 * @extends Pool
 *
 * @example
 * ```typescript
 * const pool = new PgPool({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'mydb',
 *   user: 'postgres',
 *   password: 'password',
 *   max: 20
 * });
 *
 * const client = await pool.connect();
 * await client.query('SELECT * FROM users');
 * client.release();
 *
 * // Release all clients at once
 * await pool.releaseAll();
 * ```
 */
export class PgPool<T extends PoolClient = PoolClient> extends Pool {
    private eventEmmiter: EventEmitter = new EventEmitter();

    /**
     * Creates a new PgPool instance with the specified configuration.
     *
     * @param config - PostgreSQL pool configuration options
     *
     * @remarks
     * Automatically sets up client release event handling to coordinate
     * with the releaseAll method.
     */
    constructor(config?: PoolConfig) {
        super(config);
        this.on('release', (err, client) => {
            client.emit('released', err);
        });
    }

    /**
     * Internal method to acquire a client connection as a promise.
     * Registers release event handlers for coordinated cleanup.
     *
     * @private
     * @returns A promise that resolves to a PoolClient
     */
    private async connectPromise(): Promise<T> {
        const client: T = (await super.connect()) as T;

        const onReleaseAll = (err?: Error | boolean) => {
            client.release(err);
        };
        this.eventEmmiter.on('releaseAll', onReleaseAll);
        client.addListener('released', () => {
            this.eventEmmiter.off('releaseAll', onReleaseAll);
        });

        return client;
    }

    /**
     * Acquires a client from the pool for use with queries.
     *
     * @returns A promise that resolves to a PoolClient
     *
     * @example
     * ```typescript
     * const client = await pool.connect();
     * try {
     *   const result = await client.query('SELECT NOW()');
     *   console.log(result.rows[0]);
     * } finally {
     *   client.release();
     * }
     * ```
     */
    connect(): Promise<T>;
    /**
     * Acquires a client from the pool using callback style.
     *
     * @param callback - Callback function that receives error, client, and done function
     *
     * @example
     * ```typescript
     * pool.connect((err, client, done) => {
     *   if (err) {
     *     console.error('Connection error:', err);
     *     return;
     *   }
     *   client.query('SELECT NOW()', (queryErr, result) => {
     *     done();
     *     if (queryErr) {
     *       console.error('Query error:', queryErr);
     *     } else {
     *       console.log(result.rows[0]);
     *     }
     *   });
     * });
     * ```
     */
    connect(
        callback?: (err: Error | undefined, client: PoolClient | undefined, done: (release?: unknown) => void) => void
    ): void;
    connect(
        callback?: (err: Error | undefined, client: PoolClient | undefined, done: (release?: unknown) => void) => void
    ): Promise<T> | void {
        if (callback) {
            super.connect((err, client, done) => {
                if (client) {
                    const onReleaseAll = (err?: Error | boolean) => {
                        client.release(err);
                    };
                    this.eventEmmiter.on('releaseAll', onReleaseAll);
                    client.addListener('released', () => {
                        this.eventEmmiter.off('releaseAll', onReleaseAll);
                    });
                }
                callback(err, client, done);
            });
            return;
        } else {
            return this.connectPromise();
        }
    }

    /**
     * Releases all currently checked-out clients back to the pool.
     * Useful for graceful shutdown or connection reset scenarios.
     *
     * @param err - Optional error to pass to the release handlers
     * @returns A promise that resolves when all clients are released
     *
     * @example
     * ```typescript
     * // Release all clients normally
     * await pool.releaseAll();
     *
     * // Release all clients with an error
     * await pool.releaseAll(new Error('Forced release'));
     * ```
     */
    async releaseAll(err?: Error | boolean) {
        this.eventEmmiter.emit('releaseAll', err);
    }
}

/**
 * Configuration argument for creating a PgManager instance.
 *
 * @extends ManagerArg
 *
 * @example
 * ```typescript
 * const managerArg: PgManagerArg = {
 *   name: 'my-postgres-manager',
 *   config: {
 *     host: 'localhost',
 *     port: 5432,
 *     database: 'mydb',
 *     user: 'postgres',
 *     password: 'password',
 *     max: 20,
 *     idleTimeoutMillis: 30000
 *   }
 * };
 * ```
 */
export interface PgManagerArg extends ManagerArg {
    /**
     * PostgreSQL connection pool configuration.
     * See pg.PoolConfig documentation for available options.
     */
    config?: PoolConfig;
}

/**
 * Retrieves a PgManager instance from the registry.
 *
 * @template M - The specific PgManager type to return, defaults to PgManager
 *
 * @param registry - The Storehouse registry containing registered managers
 * @param managerName - Optional name of the manager to retrieve. If omitted, retrieves the default manager
 *
 * @returns The requested PgManager instance
 *
 * @throws {ManagerNotFoundError} If the manager is not found in the registry
 * @throws {InvalidManagerConfigError} If the manager exists but is not an instance of PgManager
 *
 * @example
 * ```typescript
 * const pgManager = getManager(registry, 'postgres');
 * const client = await pgManager.getConnection();
 * ```
 */
export function getManager<M extends PgManager = PgManager>(registry: Registry, managerName?: string): M {
    const manager = registry.getManager<M>(managerName);
    if (!manager) {
        throw new ManagerNotFoundError(managerName || registry.defaultManager);
    }
    if (!(manager instanceof PgManager)) {
        throw new InvalidManagerConfigError(
            `Manager "${managerName || registry.defaultManager}" is not instance of PGManager`
        );
    }
    return manager;
}

/**
 * Retrieves a PostgreSQL client connection from a manager in the registry.
 *
 * @template T - The PoolClient type to return, defaults to PoolClient
 *
 * @param registry - The Storehouse registry containing registered managers
 * @param managerName - Optional name of the manager. If omitted, uses the default manager
 *
 * @returns A promise that resolves to a PoolClient instance
 *
 * @throws {ManagerNotFoundError} If the manager is not found in the registry
 *
 * @example
 * ```typescript
 * const client = await getConnection(registry, 'postgres');
 * try {
 *   const result = await client.query('SELECT * FROM users WHERE id = $1', [1]);
 *   console.log(result.rows[0]);
 * } finally {
 *   client.release();
 * }
 * ```
 */
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

/**
 * Extended health check result specific to PostgreSQL managers.
 * Includes connection pool metrics and query response time.
 *
 * @extends HealthCheckResult
 */
export interface PgHealthCheckResult extends HealthCheckResult {
    /**
     * Detailed information about the PostgreSQL connection pool health.
     */
    details: {
        /** The name of the manager */
        name: string;
        /** Total number of clients in the pool */
        totalCount?: number;
        /** Number of clients currently idle in the pool */
        idleCount?: number;
        /** Number of clients currently waiting for a connection */
        waitingCount?: number;
        /** Time taken to perform the health check query in milliseconds */
        latency?: string;
        /** Error message or stack trace if the health check failed */
        error?: string;
        /** Indicates whether the connection pool has ended */
        ended?: boolean;
        /** Additional custom properties */
        [key: string]: unknown;
    };
}

/**
 * Manager class for PostgreSQL integration with Storehouse.
 * Provides connection pool management, client acquisition, and health checking for PostgreSQL databases.
 *
 * This manager extends the PgPool class, offering a unified interface
 * for working with PostgreSQL databases through the Storehouse registry system.
 *
 * @template T - The PoolClient type, defaults to PoolClient
 *
 * @extends PgPool
 * @implements {IManager}
 *
 * @example
 * ```typescript
 * const manager = new PgManager({
 *   name: 'postgres-main',
 *   config: {
 *     host: 'localhost',
 *     port: 5432,
 *     database: 'myapp',
 *     user: 'postgres',
 *     password: 'password',
 *     max: 20,
 *     idleTimeoutMillis: 30000,
 *     connectionTimeoutMillis: 2000
 *   }
 * });
 *
 * const client = await manager.getConnection();
 * try {
 *   const result = await client.query('SELECT * FROM users');
 *   console.log(result.rows);
 * } finally {
 *   client.release();
 * }
 * ```
 */
export class PgManager<T extends PoolClient = PoolClient> extends PgPool<T> implements IManager {
    /**
     * Identifier for the manager type.
     * @readonly
     */
    static readonly type = '@storehouse/pg';

    /**
     * The name of this manager instance.
     * @protected
     */
    protected name: string;

    /**
     * Creates a new PgManager instance.
     *
     * @param settings - Configuration settings for the manager
     *
     * @remarks
     * The connection pool is created immediately.
     * Connection events (acquire, connect, error, release, remove) are automatically registered and logged.
     */
    constructor(settings: PgManagerArg) {
        super(settings.config);

        this.name = settings.name || `Pg ${Date.now()}_${randomBytes(6).toString('hex')}`;

        this.registerConnectionEvents();
    }

    /**
     * Registers event listeners for PostgreSQL connection pool lifecycle events.
     * Logs connection state changes for debugging and monitoring.
     *
     * @private
     */
    private registerConnectionEvents() {
        this.on('acquire', () => {
            Log.log('[%s] acquire', this.name);
        });
        this.on('connect', () => {
            Log.log('[%s] connect', this.name);
        });
        this.on('error', (err) => {
            Log.error('[%s] %O', this.name, err);
        });
        this.on('release', () => {
            Log.log('[%s] release', this.name);
        });
        this.on('remove', () => {
            Log.log('[%s] remove', this.name);
        });
    }

    /**
     * Acquires a client from the connection pool.
     *
     * @returns A promise that resolves to a PoolClient instance
     *
     * @example
     * ```typescript
     * const client = await manager.getConnection();
     * try {
     *   const result = await client.query('SELECT NOW()');
     *   console.log(result.rows[0]);
     * } finally {
     *   client.release();
     * }
     * ```
     */
    getConnection(): Promise<PoolClient> {
        return this.connect();
    }

    /**
     * Closes the PostgreSQL connection pool.
     * Releases all clients and shuts down the pool gracefully.
     *
     * @param err - Optional error to pass to the release handlers
     * @returns A promise that resolves when the pool is closed
     *
     * @example
     * ```typescript
     * // Graceful close
     * await manager.closeConnection();
     *
     * // Close with error
     * await manager.closeConnection(new Error('Forced shutdown'));
     * ```
     */
    async closeConnection(err?: Error | boolean): Promise<void> {
        await this.releaseAll(err);
        if (!this.ended) {
            await this.end();
        }
    }

    /**
     * Checks if the PostgreSQL connection pool is active and has clients available.
     *
     * @returns A promise that resolves to true if the pool is active with clients, false otherwise
     *
     * @example
     * ```typescript
     * if (await manager.isConnected()) {
     *   console.log('PostgreSQL pool is active');
     * }
     * ```
     */
    async isConnected(): Promise<boolean> {
        return !this.ended && this.totalCount > 0;
    }

    /**
     * Performs a comprehensive health check on the PostgreSQL connection pool.
     * Tests connectivity by executing a simple SELECT query and gathering pool metrics.
     *
     * @returns A promise that resolves to a detailed health check result including:
     * - Pool status (ended/active)
     * - Client counts (total, idle, waiting)
     * - Query response latency
     * - Error details (if unhealthy)
     *
     * @example
     * ```typescript
     * const health = await manager.healthCheck();
     * if (health.healthy) {
     *   console.log(`PostgreSQL is healthy. Latency: ${health.details.latency}`);
     *   console.log(`Pool stats: ${health.details.totalCount} total, ${health.details.idleCount} idle`);
     * } else {
     *   console.error(`PostgreSQL is unhealthy: ${health.message}`);
     * }
     * ```
     */
    async healthCheck(): Promise<PgHealthCheckResult> {
        const start = Date.now();
        const timestamp = start;

        if (this.ended) {
            return {
                healthy: false,
                message: 'Connection pool has ended',
                details: {
                    name: this.name,
                    ended: true,
                },
                timestamp,
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
                        latency: `${latency}ms`,
                    },
                    latency,
                    timestamp,
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
                    error: error instanceof Error ? error.stack : String(error),
                },
                latency: Date.now() - start,
                timestamp,
            };
        }
    }
}
