export function verifica_permisos(permiso) {
  if (!permiso) return true
  try {
    const usuario = JSON.parse(localStorage.getItem('usuario') || 'null')
    if (!usuario) return false
    if (usuario.roles?.includes('ADMIN')) return true
    if (!permiso) return true
    if (Array.isArray(permiso)) {
      return permiso.some(p => usuario.permisos?.includes(p))
    }
    return usuario.permisos?.includes(permiso) || false
  } catch {
    return false
  }
}
