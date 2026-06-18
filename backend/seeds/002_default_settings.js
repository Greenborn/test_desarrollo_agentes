export async function seed(knex) {
  await knex('settings').del();
  await knex('settings').insert([
    {
      setting_key: 'deepseek_key',
      setting_value: '',
      encrypted: false,
    },
    {
      setting_key: 'system_prompt',
      setting_value: 'Eres un agente experto en programación. Responde consultas técnicas con claridad, ejemplos de código y buenas prácticas. Sé conciso y directo.',
      encrypted: false,
    },
    {
      setting_key: 'redmine_token',
      setting_value: '',
      encrypted: false,
    },
    {
      setting_key: 'redmine_url',
      setting_value: '',
      encrypted: false,
    },
    {
      setting_key: 'locale',
      setting_value: 'es_ES.UTF-8',
      encrypted: false,
    },
    {
      setting_key: 'priority_color_low',
      setting_value: '#6b7280',
      encrypted: false,
    },
    {
      setting_key: 'priority_color_normal',
      setting_value: '#3b82f6',
      encrypted: false,
    },
    {
      setting_key: 'priority_color_high',
      setting_value: '#eab308',
      encrypted: false,
    },
    {
      setting_key: 'priority_color_urgent',
      setting_value: '#ef4444',
      encrypted: false,
    },
    {
      setting_key: 'priority_color_immediate',
      setting_value: '#ef4444',
      encrypted: false,
    },
  ]);
}
