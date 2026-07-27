export async function up(knex) {
  const exists = await knex.schema.hasTable('chat_messages');
  if (exists) {
    await knex.schema.dropTableIfExists('chat_messages');
    console.log('[migrate] Tabla "chat_messages" eliminada de app.db (migrada a DB separada)');
  }
}

export async function down(knex) {
  console.log('[migrate] Rollback de limpieza no soportado. chat_messages se mantiene eliminada de app.db.');
}
