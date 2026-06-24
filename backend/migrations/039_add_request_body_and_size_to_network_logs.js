export function up(knex) {
  return knex.schema.alterTable('playwright_network_logs', (table) => {
    table.text('request_body').nullable();
    table.integer('request_size').nullable();
    table.integer('response_size').nullable();
  });
}

export function down(knex) {
  return knex.schema.alterTable('playwright_network_logs', (table) => {
    table.dropColumn('request_body');
    table.dropColumn('request_size');
    table.dropColumn('response_size');
  });
}
