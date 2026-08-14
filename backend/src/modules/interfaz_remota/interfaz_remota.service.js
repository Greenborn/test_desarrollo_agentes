import { login, getGestionCredentials } from '../gestion/gestion.service.js';

let loginState = {
  attempted: false,
  success: false,
  configured: false,
  token: null,
  url: null,
  message: null,
  requestLog: null,
  checkedAt: null,
};

export async function initInterfazRemotaLogin() {
  loginState = {
    attempted: true,
    success: false,
    configured: false,
    token: null,
    url: null,
    message: null,
    requestLog: null,
    checkedAt: new Date().toISOString(),
  };

  try {
    const creds = await getGestionCredentials(1);
    if (!creds) {
      loginState.configured = false;
      loginState.message = 'Gestión interna no configurada.';
      console.log('[interfaz_remota] No hay credenciales de gestión interna configuradas.');
      return loginState;
    }

    loginState.configured = true;
    loginState.url = creds.gestionUrl;

    const result = await login(creds.gestionUrl, creds.username, creds.password);
    loginState.success = true;
    loginState.token = result.token;
    loginState.requestLog = result.requestLog;
    loginState.message = 'Login exitoso en gestión interna.';
    console.log('[interfaz_remota] Login exitoso en gestión interna.');
  } catch (err) {
    loginState.success = false;
    loginState.message = err.message ? err.message : 'Error al conectar con gestión interna.';
    loginState.requestLog = err.requestLog ? err.requestLog : null;
    console.log('[interfaz_remota] Error en login a gestión interna:', err.message);
  }

  return loginState;
}

export function getInterfazRemotaLoginState() {
  return loginState;
}
