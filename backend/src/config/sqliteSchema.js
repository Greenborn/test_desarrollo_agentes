export async function createSchema(knex) {
  await knex.schema
    .createTable('workspaces', (table) => {
      table.increments('id');
      table.string('name', 255).notNullable();
      table.boolean('is_default').defaultTo(false);
      table.string('color', 7).defaultTo('#75AADB');
      table.string('slug', 255).notNullable().unique();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('users', (table) => {
      table.increments('id');
      table.string('username', 100).notNullable().unique();
      table.string('password_hash', 255).notNullable();
      table.text('role').notNullable().defaultTo('user');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('templates', (table) => {
      table.increments('id');
      table.string('slug', 100).notNullable().unique();
      table.text('content').notNullable();
      table.boolean('is_protected').notNullable().defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('global_settings', (table) => {
      table.string('setting_key', 100).primary();
      table.text('setting_value').notNullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('chat_sessions', (table) => {
      table.increments('id');
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('workspace_id').unsigned().notNullable().defaultTo(1).references('id').inTable('workspaces');
      table.string('title', 255).nullable();
      table.string('cwd', 500).nullable();
      table.string('proyecto_id', 255).nullable();
      table.integer('id_ticket_redmine').nullable();
      table.boolean('archived').notNullable().defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('settings', (table) => {
      table.increments('id');
      table.integer('workspace_id').unsigned().notNullable().defaultTo(1);
      table.string('setting_key', 100).notNullable();
      table.text('setting_value').notNullable();
      table.boolean('encrypted').defaultTo(false);
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['workspace_id', 'setting_key']);
    })
    .createTable('user_settings', (table) => {
      table.increments('id');
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('key', 255).notNullable();
      table.text('value').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['user_id', 'key']);
    })
    .createTable('proyectos', (table) => {
      table.string('id', 255).primary();
      table.integer('workspace_id').unsigned().notNullable().defaultTo(1);
      table.text('descripcion').notNullable();
      table.integer('redmine_id').notNullable();
      table.integer('redmine_status').nullable();
      table.datetime('redmine_created_on').nullable();
      table.datetime('redmine_updated_on').nullable();
      table.string('redmine_parent_id', 255).nullable();
      table.string('redmine_parent_name', 255).nullable();
      table.string('url_github', 500).nullable();
      table.text('despliegue_config').nullable();
      table.string('color', 7).defaultTo('#6b7280');
      table.unique(['redmine_id', 'workspace_id']);
    })
    .createTable('command_history', (table) => {
      table.increments('id');
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('command', 500).notNullable();
      table.integer('session_id').unsigned().nullable().references('id').inTable('chat_sessions').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('chat_messages', (table) => {
      table.increments('id');
      table.integer('session_id').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
      table.text('role').notNullable();
      table.text('content').notNullable();
      table.text('thinking').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('funcionalidades', (table) => {
      table.increments('id');
      table.integer('session_id').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
      table.timestamp('fecha_hora').defaultTo(knex.fn.now());
      table.text('etapa').notNullable().defaultTo('RELEVAMIENTO');
      table.text('parametros').nullable();
      table.string('proyecto_id', 255).nullable();
      table.string('nombre', 255).notNullable().defaultTo('Sin nombre');
      table.string('url_redmine', 255).nullable();
      table.index('session_id');
    })
    .createTable('gastos_tokens_usados', (table) => {
      table.increments('id');
      table.integer('id_chat_session').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
      table.string('id_proyecto', 255).notNullable().references('id').inTable('proyectos').onDelete('CASCADE');
      table.decimal('precio', 10, 4).notNullable();
      table.integer('tokens').notNullable();
      table.timestamp('fecha_hora').defaultTo(knex.fn.now());
      table.string('id_sesion_opencode', 255).nullable();
    })
    .createTable('tickets', (table) => {
      table.increments('id');
      table.integer('workspace_id').unsigned().notNullable().defaultTo(1);
      table.string('proyecto_id', 255).notNullable().references('id').inTable('proyectos').onDelete('CASCADE');
      table.integer('redmine_id').notNullable().unique();
      table.string('subject', 500).notNullable();
      table.text('description').nullable();
      table.string('status_name', 100).nullable();
      table.string('tracker_name', 100).nullable();
      table.string('priority_name', 100).nullable();
      table.integer('priority_id').nullable();
      table.string('assigned_to_name', 255).nullable();
      table.string('author_name', 255).nullable();
      table.date('start_date').nullable();
      table.date('due_date').nullable();
      table.decimal('estimated_hours', 10, 2).nullable();
      table.integer('done_ratio').nullable();
      table.string('fixed_version_name', 255).nullable();
      table.datetime('redmine_created_on').nullable();
      table.datetime('redmine_updated_on').nullable();
      table.datetime('redmine_closed_on').nullable();
    })
    .createTable('project_variables', (table) => {
      table.increments('id');
      table.string('proyecto_id', 255).notNullable().references('id').inTable('proyectos').onDelete('CASCADE');
      table.string('key', 255).notNullable();
      table.text('value').notNullable().defaultTo('');
      table.string('type', 20).notNullable().defaultTo('db');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['proyecto_id', 'key']);
    })
    .createTable('workspace_environments', (table) => {
      table.increments('id');
      table.integer('workspace_id').unsigned().notNullable().defaultTo(1);
      table.string('name', 100).notNullable();
      table.string('branch', 255).notNullable();
      table.text('description').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['workspace_id', 'name']);
    })
    .createTable('documentacion_escaneo', (table) => {
      table.increments('id');
      table.integer('session_id').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
      table.timestamp('fecha_hora_inicio').defaultTo(knex.fn.now());
      table.timestamp('fecha_hora_fin').nullable();
      table.integer('total_archivos').nullable();
      table.integer('archivos_procesados').nullable();
      table.index(['session_id', 'fecha_hora_inicio']);
    })
    .createTable('documentacion_archivo', (table) => {
      table.increments('id');
      table.integer('escaneo_id').unsigned().notNullable().references('id').inTable('documentacion_escaneo').onDelete('CASCADE');
      table.string('nombre', 500).notNullable();
      table.text('ruta').notNullable();
      table.string('tipo', 50).notNullable();
      table.string('extension', 50).nullable();
      table.integer('tamano').nullable();
      table.text('descripcion').nullable();
      table.index('escaneo_id');
    })
    .createTable('documentacion_notas', (table) => {
      table.increments('id');
      table.string('id_proyecto', 255).notNullable();
      table.string('clave', 255).notNullable();
      table.text('valor').nullable();
      table.integer('id_ticket').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['id_proyecto', 'clave']);
      table.index('id_proyecto');
    })
    .createTable('documentacion_base_datos', (table) => {
      table.increments('id');
      table.string('id_proyecto', 255).notNullable().references('id').inTable('proyectos');
      table.text('data').nullable();
      table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
      table.timestamp('fecha_edicion').defaultTo(knex.fn.now());
    })
    .createTable('documentacion_subproyectos', (table) => {
      table.increments('id');
      table.string('id_proyecto', 255).notNullable().references('id').inTable('proyectos');
      table.text('data').nullable();
      table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
      table.timestamp('fecha_edicion').defaultTo(knex.fn.now());
    })
    .createTable('documentacion_endpoints', (table) => {
      table.increments('id');
      table.string('id_proyecto', 255).notNullable().references('id').inTable('proyectos');
      table.text('data').nullable();
      table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
      table.timestamp('fecha_edicion').defaultTo(knex.fn.now());
    })
    .createTable('documentacion_web_sockets', (table) => {
      table.increments('id');
      table.string('id_proyecto', 255).notNullable().references('id').inTable('proyectos');
      table.text('data').nullable();
      table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
      table.timestamp('fecha_edicion').defaultTo(knex.fn.now());
    })
    .createTable('documentacion_funcionalidades', (table) => {
      table.increments('id');
      table.string('id_proyecto', 255).notNullable().references('id').inTable('proyectos');
      table.text('data').nullable();
      table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
      table.timestamp('fecha_edicion').defaultTo(knex.fn.now());
    })
    .createTable('playwright_console_logs', (table) => {
      table.increments('id');
      table.integer('chat_session_id').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
      table.string('playwright_session_id', 36).notNullable();
      table.string('type', 20).notNullable();
      table.text('text').notNullable();
      table.text('location').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('playwright_network_logs', (table) => {
      table.increments('id');
      table.integer('chat_session_id').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
      table.string('playwright_session_id', 36).notNullable();
      table.string('method', 10).notNullable();
      table.text('url').notNullable();
      table.integer('status_code').nullable();
      table.text('request_headers').nullable();
      table.text('response_headers').nullable();
      table.string('resource_type', 50).nullable();
      table.text('response_body').nullable();
      table.text('error').nullable();
      table.text('request_body').nullable();
      table.integer('request_size').nullable();
      table.integer('response_size').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('playwright_event_recordings', (table) => {
      table.increments('id');
      table.integer('chat_session_id').unsigned().nullable().references('id').inTable('chat_sessions').onDelete('SET NULL');
      table.string('project_id', 255).notNullable();
      table.string('name', 255).notNullable();
      table.string('playwright_session_id', 36).nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('playwright_events', (table) => {
      table.increments('id');
      table.integer('chat_session_id').unsigned().nullable().references('id').inTable('chat_sessions').onDelete('SET NULL');
      table.string('playwright_session_id', 36).notNullable();
      table.string('event_type', 50).notNullable();
      table.text('selector').nullable();
      table.string('tag_name', 50).nullable();
      table.text('text_content').nullable();
      table.text('value').nullable();
      table.text('url').nullable();
      table.integer('x').nullable();
      table.integer('y').nullable();
      table.string('key', 50).nullable();
      table.text('key_code').nullable();
      table.boolean('alt_key').nullable();
      table.boolean('ctrl_key').nullable();
      table.boolean('shift_key').nullable();
      table.boolean('meta_key').nullable();
      table.integer('scroll_x').nullable();
      table.integer('scroll_y').nullable();
      table.text('target_rect').nullable();
      table.text('metadata').nullable();
      table.integer('recording_id').unsigned().nullable().references('id').inTable('playwright_event_recordings').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index('chat_session_id');
      table.index('playwright_session_id');
      table.index('recording_id');
    })
    .createTable('redmine_comentarios', (table) => {
      table.increments('id');
      table.integer('session_id').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
      table.integer('ticket_redmine_id').notNullable();
      table.text('comentario').notNullable();
      table.integer('workspace_id').unsigned().notNullable().defaultTo(1);
      table.text('estado').notNullable().defaultTo('pendiente');
      table.text('tipo').notNullable().defaultTo('comentario_commit');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('comandos_personalizados_proyectos', (table) => {
      table.increments('id');
      table.string('label', 255).notNullable();
      table.text('descripcion').nullable();
      table.string('id_proyecto', 255).notNullable();
      table.string('comando', 512).notNullable();
      table.boolean('ocultar_ejecucion').notNullable().defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('archivos', (table) => {
      table.increments('id');
      table.string('proyecto_id', 255).notNullable();
      table.integer('chat_session_id').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
      table.string('nombre_original', 500).notNullable();
      table.string('nombre_storage', 500).notNullable();
      table.string('tipo', 100).notNullable();
      table.integer('tamano').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('capturas_metadata', (table) => {
      table.increments('id');
      table.integer('archivo_id').unsigned().notNullable().references('id').inTable('archivos').onDelete('CASCADE');
      table.string('key', 255).notNullable();
      table.text('value').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });

  console.log('✓ Schema SQLite creado correctamente');
}
