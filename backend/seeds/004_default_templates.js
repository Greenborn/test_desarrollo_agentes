const COMMIT_PROMPT = 'Analizá los cambios realizados en el proyecto actual (revisando el diff de Git) y generá un mensaje de commit descriptivo. El mensaje debe ser conciso (máximo 300 caracteres) y reflejar claramente las modificaciones aplicadas al código. Debes comenzar en modo planificación mostrando primero la propuesta de commit. IMPORTANTE: Devuelve ÚNICAMENTE el mensaje de commit, sin explicaciones, análisis ni ningún otro texto adicional.'

const TESTING_NOTES_PROMPT = 'Analizá las diferencias entre las ramas "{sourceBranch}" y "{targetBranch}" del proyecto.\n\nLos commits que diferen ambas ramas son:\n{diffSummary}\n\nBasado en estos cambios, generá un listado de puntos a considerar para realizar pruebas (testing). Incluí:\n- Qué funcionalidades se ven afectadas por los cambios\n- Qué se recomienda testear específicamente\n- Casos de prueba sugeridos para cada funcionalidad afectada\n- Riesgos potenciales de los cambios\n\nDevolvé la respuesta en formato markdown listando cada punto. Sé específico y basate en los cambios reales del diff.'

export async function seed(knex) {
  const existing = await knex('templates').where({ slug: 'commit-prompt' }).first()
  if (!existing) {
    await knex('templates').insert({
      slug: 'commit-prompt',
      content: COMMIT_PROMPT,
      is_protected: true,
    })
  }

  const existingTesting = await knex('templates').where({ slug: 'testing-notes-prompt' }).first()
  if (!existingTesting) {
    await knex('templates').insert({
      slug: 'testing-notes-prompt',
      content: TESTING_NOTES_PROMPT,
      is_protected: true,
    })
  }
}
