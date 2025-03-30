import logger from '@novice1/logger';
import Storehouse from '@storehouse/core';
import { randomBytes } from 'crypto';
import { PGManager, getManager, getConnection } from '../../lib/index.js';

const { Debug } = logger;
Debug.enable('@storehouse/pg*');

describe('connect (esm)', function () {

	const { logger, params } = this.ctx.kaukau;

	it('should init and connect', async function () {
		try {
			Storehouse.add({
				pg2: {
					type: PGManager,
					config: {
						database: params('db.database'),
						host: params('db.host'),
						port: params('db.port'),
						user: params('db.user'),
						password: params('db.password'),
						ssl: {
							rejectUnauthorized: false
						},
						max: 2,
						connectionTimeoutMillis: 2000,
						idleTimeoutMillis: 10000
					}
				}
			});

			const manager = getManager(Storehouse, 'pg2');
			if (params('db.schema')) {
				manager.on('connect', client => {
					client.query(`SET search_path TO ${params('db.schema')}`)
				})
			}

			const conn = await getConnection(Storehouse, 'pg2');// Storehouse.getConnection<Promise<MyPoolClient>>();
			logger.info('retrieved connection for database', conn.database);


			logger.info('SELECT NOW() =>', JSON.stringify((await manager.query('SELECT NOW()')).rows));

			const client = await getConnection(Storehouse, 'pg2');

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

			const movies = await client.query('SELECT * FROM movies ORDER BY id DESC LIMIT 1');
			let id;
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
	})
});