import knex from 'knex';
import config from '../../knexfileComandos.js';

const dbComandos = knex(config);
export default dbComandos;
