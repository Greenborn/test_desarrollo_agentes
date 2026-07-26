export async function up(knex) {
  const driver = knex.client.config.client;
  if (driver === 'better-sqlite3' || driver === 'sqlite') {
    // SQLite: alter via portable Knex API
    await knex.schema.alterTable('playwright_event_recordings', (table) => {
      table.dropForeign(['chat_session_id']);
      table.setNullable('chat_session_id');
    });

    await knex('playwright_event_recordings').whereNull('project_id').update({ project_id: '' });

    await knex.schema.alterTable('playwright_event_recordings', (table) => {
      table.dropNullable('project_id');
      table.foreign('chat_session_id').references('id').inTable('chat_sessions').onDelete('SET NULL');
    });

    await knex.schema.alterTable('playwright_events', (table) => {
      table.dropForeign(['chat_session_id']);
      table.setNullable('chat_session_id');
      table.foreign('chat_session_id').references('id').inTable('chat_sessions').onDelete('SET NULL');
    });
    return;
  }

  await knex.raw('ALTER TABLE `playwright_event_recordings` DROP FOREIGN KEY `playwright_event_recordings_chat_session_id_foreign`');
  await knex.raw('ALTER TABLE `playwright_event_recordings` MODIFY `chat_session_id` INT UNSIGNED NULL');

  await knex('playwright_event_recordings').whereNull('project_id').update({ project_id: '' });
  await knex.raw('ALTER TABLE `playwright_event_recordings` MODIFY `project_id` VARCHAR(255) NOT NULL');

  await knex.raw('ALTER TABLE `playwright_event_recordings` ADD CONSTRAINT `playwright_event_recordings_chat_session_id_foreign` FOREIGN KEY (`chat_session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE SET NULL');

  await knex.raw('ALTER TABLE `playwright_events` DROP FOREIGN KEY `playwright_events_chat_session_id_foreign`');
  await knex.raw('ALTER TABLE `playwright_events` MODIFY `chat_session_id` INT UNSIGNED NULL');

  await knex.raw('ALTER TABLE `playwright_events` ADD CONSTRAINT `playwright_events_chat_session_id_foreign` FOREIGN KEY (`chat_session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE SET NULL');
}

export async function down(knex) {
  const driver = knex.client.config.client;
  if (driver === 'better-sqlite3' || driver === 'sqlite') {
    await knex.schema.alterTable('playwright_events', (table) => {
      table.dropForeign(['chat_session_id']);
      table.dropNullable('chat_session_id');
      table.foreign('chat_session_id').references('id').inTable('chat_sessions').onDelete('CASCADE');
    });

    await knex.schema.alterTable('playwright_event_recordings', (table) => {
      table.dropForeign(['chat_session_id']);
      table.dropNullable('chat_session_id');
      table.setNullable('project_id');
      table.foreign('chat_session_id').references('id').inTable('chat_sessions').onDelete('CASCADE');
    });
    return;
  }

  await knex.raw('ALTER TABLE `playwright_events` DROP FOREIGN KEY `playwright_events_chat_session_id_foreign`');
  await knex.raw('ALTER TABLE `playwright_events` MODIFY `chat_session_id` INT UNSIGNED NOT NULL');
  await knex.raw('ALTER TABLE `playwright_events` ADD CONSTRAINT `playwright_events_chat_session_id_foreign` FOREIGN KEY (`chat_session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE CASCADE');

  await knex.raw('ALTER TABLE `playwright_event_recordings` DROP FOREIGN KEY `playwright_event_recordings_chat_session_id_foreign`');
  await knex.raw('ALTER TABLE `playwright_event_recordings` MODIFY `project_id` VARCHAR(255) NULL');
  await knex.raw('ALTER TABLE `playwright_event_recordings` MODIFY `chat_session_id` INT UNSIGNED NOT NULL');
  await knex.raw('ALTER TABLE `playwright_event_recordings` ADD CONSTRAINT `playwright_event_recordings_chat_session_id_foreign` FOREIGN KEY (`chat_session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE CASCADE');
}