from rest_framework.permissions import BasePermission


def usuario_tiene_rol(request, roles):
    usuario = request.user

    # la contrasena inicial es el DNI: hasta cambiarla, el usuario solo puede usar establecer-password-inicial
    return bool(
        usuario
        and usuario.is_authenticated
        and hasattr(usuario, 'usuario')
        and not usuario.usuario.requiere_cambio_password
        and usuario.usuario.rol.nombre_rol in roles
    )


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return usuario_tiene_rol(request, ['SU'])

class IsDataEntry(BasePermission):
    def has_permission(self, request, view):
        return usuario_tiene_rol(request, ['DE'])
    
class IsLegales(BasePermission):
    def has_permission(self, request, view):
        return usuario_tiene_rol(request, ['LG'])
    
class IsTrabajadoraSocial(BasePermission):
    def has_permission(self, request, view):
        return usuario_tiene_rol(request, ['TS'])

class IsAnyRole(BasePermission):
    def has_permission(self, request, view):
        return usuario_tiene_rol(request, ['TS', 'SU', 'LG', 'DE'])
    
class IsDataEntryOrSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return usuario_tiene_rol(request, ['DE', 'SU'])
