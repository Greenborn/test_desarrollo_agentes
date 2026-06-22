export function useProjectVariables() {
  async function getVariables(proyectoId) {
    if (!proyectoId) return [];
    try {
      const res = await fetch(`/api/proyecto/${encodeURIComponent(proyectoId)}/variables`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al obtener variables');
      }
      const data = await res.json();
      return data.variables || [];
    } catch (err) {
      console.error('Error en getVariables:', err.message);
      return [];
    }
  }

  function interpolate(text, variables) {
    if (!text || !variables || variables.length === 0) return text;
    let result = text;
    for (const v of variables) {
      const pattern = new RegExp(`\\{\\{${escapeRegex(v.key)}\\}\\}`, 'g');
      result = result.replace(pattern, v.value);
    }
    return result;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async function resolveText(text, proyectoId) {
    if (!text || !proyectoId) return text;
    const variables = await getVariables(proyectoId);
    return interpolate(text, variables);
  }

  return { getVariables, interpolate, resolveText };
}
