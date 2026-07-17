const COMMIT_PROMPT = 'Analizá los cambios del diff de Git (fuente PRINCIPAL) y generá un mensaje de commit que describa los cambios PUNTUALES (archivos, funciones, lógica modificada) y su impacto. Regla 75/25: los cambios puntuales deben ocupar el 75% del mensaje, el contexto general solo el 25% restante. Máximo 512 caracteres. Comenzá en modo planificación mostrando primero la propuesta de commit. IMPORTANTE: Devolvé ÚNICAMENTE el mensaje de commit.'

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
