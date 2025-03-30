import Logger from '@novice1/logger';
import { IManager, ManagerArg } from '@storehouse/core/lib/manager';
import { Registry } from '@storehouse/core/lib/registry';
import { randomBytes } from 'crypto';
import { Pool, PoolClient, PoolConfig } from 'pg'
import { EventEmitter } from 'events';


const Log = Logger.debugger('@storehouse/pg:manager');


export class PGPool<T extends PoolClient = PoolClient> extends Pool {

    #eventEmmiter: EventEmitter = new EventEmitter()

    constructor(config?: PoolConfig) {
        super(config)
        this.on('release', (err, client) => {
            client.emit('released', err)
        })
    }


    private async _connectPromise(): Promise<T> {
        const client: T = await super.connect() as T

        const onReleaseAll = (err?: Error | boolean) => {
            client.release(err)
        }
        this.#eventEmmiter.on('releaseAll', onReleaseAll)
        client.addListener('released', () => {
            this.#eventEmmiter.off('releaseAll', onReleaseAll)
        })

        return client
    }

    connect(): Promise<T>;
    connect(
        callback?: (err: Error | undefined, client: PoolClient | undefined, done: (release?: unknown) => void) => void,
    ): void;
    connect(
        callback?: (err: Error | undefined, client: PoolClient | undefined, done: (release?: unknown) => void) => void
    ): Promise<T> | void {
        if (callback) {
            super.connect(
                (err, client, done) => {
                    if (client) {
                        const onReleaseAll = (err?: Error | boolean) => {
                            client.release(err)
                        }
                        this.#eventEmmiter.on('releaseAll', onReleaseAll)
                        client.addListener('released', () => {
                            this.#eventEmmiter.off('releaseAll', onReleaseAll)
                        })
                    }
                    callback(err, client, done)
                }
            )
            return
        } else {
            return this._connectPromise()
        }
    }

    async releaseAll(err?: Error | boolean) {
        this.#eventEmmiter.emit('releaseAll', err)
    }
}


export interface PGManagerArg extends ManagerArg {
    config?: PoolConfig,
}

export function getManager<M extends PGManager = PGManager>(registry: Registry, managerName?: string): M {
    const manager = registry.getManager<M>(managerName);
    if (!manager) {
        throw new ReferenceError(`Could not find manager "${managerName || registry.defaultManager}"`);
    }
    if (!(manager instanceof PGManager)) {
        throw new TypeError(`Manager "${managerName || registry.defaultManager}" is not instance of PGManager`);
    }
    return manager;
}
  
export async function getConnection<T extends PoolClient = PoolClient>(registry: Registry, managerName?: string): Promise<T> {
    const conn = await registry.getConnection<Promise<T>>(managerName);
    if (!conn) {
        throw new ReferenceError(`Could not find connection "${managerName || registry.defaultManager}"`);
    }
    return conn;
}

export class PGManager<T extends PoolClient = PoolClient> extends PGPool<T> implements IManager {
    static readonly type = '@storehouse/pg';

    protected name: string;

    constructor(settings: PGManagerArg) {

        super(settings.config);

        this.name = settings.name || `PG ${Date.now()}_${randomBytes(6).toString('hex')}`;

        this._registerConnectionEvents();
    }

    private _registerConnectionEvents() {
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

    getConnection(): Promise<PoolClient> {
        return this.connect()
    }

    async closeConnection(err?: Error | boolean): Promise<void> {
        await this.releaseAll(err)
        if(!this.ended) {
            await this.end()
        }
    }
}