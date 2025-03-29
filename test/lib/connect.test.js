/* eslint-disable mocha/no-setup-in-describe */
/* eslint-disable mocha/no-mocha-arrows */
const { Debug } = require('@novice1/logger');
const Storehouse = require('@storehouse/core');
const { PGManager, getManager, getConnection } = require('../../lib/index');

Debug.enable('@storehouse/pg*');

describe('connect', function () {

	const { logger, params } = this.ctx.kaukau;

	it('should init and connect', async () => {
		try {
			const config = {
				database: params('db.database'),
				host: params('db.host'),
				port: params('db.port'),
				user: params('db.user'),
				password: params('db.password'),
				ssl: params('db.ssl'),
				max: 2,
				connectionTimeoutMillis: 2000,
				idleTimeoutMillis: 10000
			}

			Storehouse.add({
				pg: {
					type: PGManager,
					config
				}
			});

			const conn = await getConnection(Storehouse, 'pg');// Storehouse.getConnection<Promise<MyPoolClient>>();
			logger.info('retrieved connection for database', conn.database);

			const manager = getManager(Storehouse);
			logger.log('SELECT NOW() =>', await manager.query('SELECT NOW()'));

			const client = await getConnection(Storehouse);

			await Storehouse.close(/*true*/);
			logger.info('closed connections');

			logger.info('Done');
		} catch (e) {
			await Storehouse.close();
			logger.info('closed connections');
			throw e;
		}
	})
});