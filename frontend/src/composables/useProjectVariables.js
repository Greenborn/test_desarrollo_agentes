import wsClient from '../services/wsClient.js';
import { useAuthStore } from '../stores/auth.js';

export function useProjectVariables() {
  async function getVariables(proyectoId) {
    if (!proyectoId) return [];
    try {
      const auth = useAuthStore();
      const data = await wsClient.send('proyectoVarListar', {
        sessionToken: auth.getSessionToken(),
        proyectoId,
      });
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
