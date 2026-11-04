export const nombreUsuarioAsignado = (expediente) => {
    const usuario = expediente?.usuario_asignado;
    if (!usuario || typeof usuario !== 'object') return 'Sin asignar';
    const nombreCompleto = `${usuario.apellido || ''} ${usuario.nombre || ''}`.trim();
    return nombreCompleto || usuario.username_display || usuario.username || 'Sin asignar';
};
