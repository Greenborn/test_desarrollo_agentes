import knex from 'knex';
import config from '../../knexfileConfig.js';

const dbConfig = knex(config);
export default dbConfig;
