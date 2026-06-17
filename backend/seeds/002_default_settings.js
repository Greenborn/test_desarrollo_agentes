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
  ]);
}
