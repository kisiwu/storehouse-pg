import { Debug } from '@novice1/logger';
import Storehouse from '@storehouse/core';
import { PGManager, getManager, getConnection } from '../../src/index';
import { PoolClient } from 'pg';
import { randomBytes } from 'crypto';

Debug.enable('@storehouse/pg*');

interface MyPoolClient extends PoolClient {
	database?: string
}

describe('connect', function () {
	const { logger, params } = this.ctx.kaukau;

	it('should init and connect', async () => {
		// Storehouse.setManagerType(PGManager);

		try {
			Storehouse.add({
				pg: {
					type: PGManager<MyPoolClient>,
					config: {
						database: params('db.database'),
						host: params('db.host'),
						port: params('db.port'),
						user: params('db.user'),
						password: params('db.password'),
						ssl: {
							rejectUnauthorized: false
						},
						max: 3,
						connectionTimeoutMillis: 5000,
						idleTimeoutMillis: 10000
					}
				}
			});

			const manager = getManager<PGManager<MyPoolClient>>(Storehouse/*, 'pg'*/);
			if (params('db.schema')) {
				manager.on('connect', client => {
					client.query(`SET search_path TO ${params('db.schema')}`)
				})
			}

			const conn = await getConnection<MyPoolClient>(Storehouse, 'pg');// Storehouse.getConnection<Promise<MyPoolClient>>();
			logger.info('retrieved connection for database', conn.database);

			logger.info('SELECT NOW() =>', JSON.stringify((await manager.query('SELECT NOW()')).rows));

			const client = await getConnection<MyPoolClient>(Storehouse);

			const newMovie = {
				title: `Last Knight ${randomBytes(6).toString('hex')}`,
				rate: 3
			};

			const r = await client.query('INSERT INTO movies (title, rate) VALUES ($1, $2)', [
				newMovie.title,
				newMovie.rate
			]);

			logger.info('added new movie', r.rowCount);

			logger.log('nb current database movies', JSON.stringify((await client.query('SELECT count(*) FROM movies')).rows));

			const movies = await client.query<{ id: number, title: string, rate: number }>('SELECT * FROM movies ORDER BY id DESC LIMIT 1');
			let id: number | undefined;
			if (movies.rows.length) {
				const doc = movies.rows[0];
				logger.info('new movie title:', doc.title);
				id = doc.id
			}

			if (id) {
				logger.info(`deleting movie with id=${id}`)
				logger.info('deleted movie', JSON.stringify((await client.query('DELETE FROM movies where id = $1', [id])).rowCount));
			}

			logger.log('nb current database movies', JSON.stringify((await client.query('SELECT count(*) FROM movies')).rows));

			await Storehouse.close(/*true*/);
			logger.info('closed connections');

			logger.info('Done');
		} catch (e) {
			await Storehouse.close();
			logger.info('closed connections');
			throw e;
		}
	});
});
