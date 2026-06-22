const COMMIT_PROMPT = 'Analizá los cambios realizados en el proyecto actual (revisando el diff de Git) y generá un mensaje de commit descriptivo. El mensaje debe ser conciso (máximo 300 caracteres) y reflejar claramente las modificaciones aplicadas al código. Debes comenzar en modo planificación mostrando primero la propuesta de commit. IMPORTANTE: Devuelve ÚNICAMENTE el mensaje de commit, sin explicaciones, análisis ni ningún otro texto adicional.'

export async function seed(knex) {
  const existing = await knex('templates').where({ slug: 'commit-prompt' }).first()
  if (!existing) {
    await knex('templates').insert({
      slug: 'commit-prompt',
      content: COMMIT_PROMPT,
      is_protected: true,
    })
  }
}
