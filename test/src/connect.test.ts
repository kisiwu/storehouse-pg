import { Debug } from '@novice1/logger';
import Storehouse from '@storehouse/core';
import { PGManager, getManager, getConnection } from '../../src/index';
import { PoolClient } from 'pg';

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
            ssl: params('db.ssl'),
            max: 2,
            connectionTimeoutMillis: 2000,
            idleTimeoutMillis: 10000
          }
        }
      });

      const conn = await getConnection<MyPoolClient>(Storehouse, 'pg');// Storehouse.getConnection<Promise<MyPoolClient>>();
      logger.info('retrieved connection for database', conn.database);

      const manager = getManager<PGManager<MyPoolClient>>(Storehouse/*, 'pg'*/);
      logger.log('SELECT NOW() =>', await manager.query('SELECT NOW()'));

      const client = await getConnection<MyPoolClient>(Storehouse);
  
      /*
      const newMovie: Movie = {
        title: `Last Knight ${Math.ceil(Math.random() * 1000) + 1}`
      };
      newMovie.rate = 3;
      const r = await Movies.insertOne(newMovie);
      logger.info('added new movie', r.insertedId);
  
      const movies = await Movies.find({}).sort({_id: -1}).limit(1).toArray();
      if (movies.length) {
        const doc = movies[0];
        logger.log('new movie title:', doc.title);
      }

      logger.info('deleted movie', await Movies.deleteOne({ _id: r.insertedId }));

      logger.log('nb current database movies', await Movies.countDocuments());
      */

      //const OtherMovies = getModel<Movie>(Storehouse, 'otherdatabase.movies');
      //logger.log('nb other database movies', await OtherMovies.countDocuments());

      await Storehouse.close(/*true*/);
      logger.info('closed connections');

      /*
      await conn.connect();

      logger.info(await Movies.countDocuments());

      await Storehouse.close();
      */

      logger.info('Done');
    } catch(e) {
      await Storehouse.close();
      logger.info('closed connections');
      throw e;
    }
  });
});
