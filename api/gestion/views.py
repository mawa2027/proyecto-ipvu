import csv
import os
import logging
import io
from datetime import timedelta

from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import render
from django.utils import timezone
from rest_framework import viewsets, permissions
from .models import *
from .serializers import *
from .serializers import MiLoginPersonalizadoSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from .permissions import *
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.mixins import ListModelMixin, RetrieveModelMixin, CreateModelMixin, UpdateModelMixin
from rest_framework.viewsets import GenericViewSet
from django.contrib.auth.models import User
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth.tokens import default_token_generator
from django.db.models import Count
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.db.models import Q
from django.db.models import Count
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenRefreshView
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak, KeepTogether)
from xml.sax.saxutils import escape
from reportlab.lib import colors
from django.core.files.base import ContentFile
from django.conf import settings
from . import ia_client

logger = logging.getLogger(__name__)




# Notificaciones automaticas. meensajes posibles al recibir un expediente
MENSAJE_NUEVO_CASO = "Nuevo caso recibido"
MENSAJE_CASO_RECIBIDO = "Caso recibido"
ROLES_CON_NOTIFICACION_DE_CASO = ['TS', 'LG']

# aviso a la data entry de a quien quedo asignado el expediente que cargo: es informativo y deja de mostrarse solo
MENSAJE_EXPEDIENTE_CREADO = "Expediente creado"
DIAS_VISIBLE_EXPEDIENTE_CREADO = 5


def nombre_para_mostrar(user):
    perfil = getattr(user, 'usuario', None)
    if perfil:
        return f"{perfil.nombre} {perfil.apellido}".strip()
    return user.get_full_name() or user.username


def crear_notificacion_expediente_creado(usuario_creador, expediente, nombre_asignado):
    postulante = expediente.postulante_titular
    mensaje = (
        f"{MENSAJE_EXPEDIENTE_CREADO}: {postulante.nombre} {postulante.apellido} "
        f"(DDJJ {expediente.DDJJ}), asignado a {nombre_asignado}"
    )
    # sin expediente_relacionado: el expediente ya esta en poder de la TS y la data entry no lo puede abrir
    Notificacion.objects.create(mensaje=mensaje[:200], usuario_destino=usuario_creador)


# verifica si el usuario destino pertenece a un rol que debe recibir notificaciones de expedientes, o sea, LG y TS
def usuario_puede_recibir_notificacion_caso(usuario_destino):
    if not usuario_destino:
        return False

    perfil_destino = getattr(usuario_destino, 'usuario', None)

    if not perfil_destino:
        return False

    return perfil_destino.rol.nombre_rol in ROLES_CON_NOTIFICACION_DE_CASO


# determina si el usuario ya habia recibido antes el mismo expediente para que el la notificacion no diga NUEVO
# se revisan notificaciones previas y pases anteriores el pase actual se excluye para no contarlo como antecedente 
def usuario_recibio_expediente_antes(usuario_destino, expediente, pase_actual=None):
    notificacion_previa = Notificacion.objects.filter(
        usuario_destino=usuario_destino,
        expediente_relacionado=expediente
    ).exists()

    pases_previos = HistorialPase.objects.filter(
        expediente=expediente,
        usuario_destino=usuario_destino
    )
    # evita contar el pase actual como un pase previo
    if pase_actual:
        pases_previos = pases_previos.exclude(id=pase_actual.id)

    return notificacion_previa or pases_previos.exists()


# crea la notificacion cuando un usuario de TS o Legales recibe un expediente
# si es la primera vez q recibe muestra Nuevo caso recibido. si ya lo recibio antes muestra Caso recibido
def crear_notificacion_recepcion_expediente(usuario_destino, expediente, pase_actual=None):
    if not usuario_puede_recibir_notificacion_caso(usuario_destino):
        return

    recibio_antes = usuario_recibio_expediente_antes(
        usuario_destino=usuario_destino,
        expediente=expediente,
        pase_actual=pase_actual
    )

    mensaje = MENSAJE_CASO_RECIBIDO if recibio_antes else MENSAJE_NUEVO_CASO

    Notificacion.objects.create(
        mensaje=mensaje,
        usuario_destino=usuario_destino,
        expediente_relacionado=expediente
    )

# Regla de acceso: cada usuario (TS, LG, DE) solo ve y toca los expedientes que tiene en su poder
# (usuario_asignado). Al hacer un pase, el expediente deja de ser suyo y deja de verlo. El superadmin ve todo.
def filtrar_expedientes_en_poder(queryset, request, campo_expediente='expediente'):
    if usuario_tiene_rol(request, ['SU']):
        return queryset
    return queryset.filter(**{f'{campo_expediente}__usuario_asignado': request.user}).distinct()


def validar_expediente_en_poder(request, expediente):
    if expediente is None or usuario_tiene_rol(request, ['SU']):
        return
    if expediente.usuario_asignado_id != request.user.id:
        raise PermissionDenied('El expediente no está en tu poder: pedí que te lo pasen.')


def registrar_auditoria(user_request, expediente, mensaje):
    """
    Guarda un registro en HistorialAccion.
    """
    try:
        # Buscamos el perfil de Usuario (tu modelo) asociado al User logueado
        perfil_usuario = getattr(user_request, 'usuario', None)
        if perfil_usuario:
            HistorialAccion.objects.create(
                mensaje_accion=mensaje,
                id_usuario_accion=perfil_usuario,
                id_expediente=expediente
            )
    except Exception as e:
        print(f"Error al registrar auditoria: {e}")


class PostulanteTitularViewSet(viewsets.ModelViewSet):
    queryset = PostulanteTitular.objects.all()
    serializer_class = PostulanteTitularSerializer

    def get_queryset(self):
        return filtrar_expedientes_en_poder(PostulanteTitular.objects.all(), self.request)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        response.data['asignado_a'] = self.nombre_asignado
        return response

    def perform_create(self, serializer):   
        ddjj = serializer.validated_data.pop('ddjj')
        postulante = serializer.save()
        estado_inicial = EstadoExpediente.objects.get(nombre='SINI')
        trabajadora_social = obtener_siguiente_trabajadora_social()
        
        # crea el expediente inicial y conserva la instancia para generar la notificacion al usuario asignado
        expediente = Expediente.objects.create(
            postulante_titular=postulante,
            estado_expediente=estado_inicial,
            DDJJ=ddjj,
            usuario_asignado=trabajadora_social
        )
        
        # notifica a la trabajadora social cuando recibe el expediente por primera vez
        crear_notificacion_recepcion_expediente(trabajadora_social, expediente)

        # y a quien lo cargo, a quien le quedo asignado (el nombre tambien vuelve en la respuesta para el cartel)
        self.nombre_asignado = nombre_para_mostrar(trabajadora_social)
        crear_notificacion_expediente_creado(self.request.user, expediente, self.nombre_asignado)

        # NUEVO: Auditoría de creación
        registrar_auditoria(
            self.request.user,
            expediente,
            f"Expediente inicial creado y asignado a TS: {trabajadora_social.first_name} {trabajadora_social.last_name}."
        )
        
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update']:
            return [IsDataEntryOrSuperAdmin()]
        if self.action == 'destroy':
            return [IsSuperAdmin()]
        return [IsAnyRole()]
    

class EstadoExpedienteViewSet(ListModelMixin, RetrieveModelMixin, GenericViewSet, UpdateModelMixin):
    queryset = EstadoExpediente.objects.all()
    serializer_class = EstadoExpedienteSerializer

    # los estados son el catalogo del sistema: todos lo leen, solo el superadmin lo modifica
    def get_permissions(self):
        if self.action in ['update', 'partial_update']:
            return [IsSuperAdmin()]
        return [IsAnyRole()]


#Algoritmo de asignacion de trabajadoras sociales para la creacion de expedientes
def obtener_siguiente_trabajadora_social():
    # 1. ¡Acá está el cambio! Solo traemos a las TS que están activas
    trabajadoras = list(
        User.objects
        .filter(usuario__rol__nombre_rol="TS", usuario__activo=True)
        .order_by("id")
    )

    if not trabajadoras:
        return None

    # 2. Buscamos el último expediente (ya no hace falta filtrar activo acá, 
    # pero dejarlo no hace daño)
    ultimo_expediente = (
        Expediente.objects
        .filter(usuario_asignado__usuario__rol__nombre_rol="TS")
        .order_by("-id")
        .first()
    )

    if not ultimo_expediente or not ultimo_expediente.usuario_asignado:
        return trabajadoras[0]

    ultimo_usuario = ultimo_expediente.usuario_asignado

    # 3. Si el último usuario se dio de baja y ya no está en la lista de activas, 
    # va a saltar al 'except' y arrancar desde el principio. ¡Perfecto!
    try:
        indice_actual = trabajadoras.index(ultimo_usuario)
        siguiente_indice = indice_actual + 1
        
        if siguiente_indice >= len(trabajadoras):
            siguiente_indice = 0
            
        return trabajadoras[siguiente_indice]
        
    except ValueError:
        # Si el último usuario se dio de baja, buscamos a la siguiente TS 
        # que tenga un ID mayor al que se fue.
        siguientes = [t for t in trabajadoras if t.id > ultimo_usuario.id]
        
        if siguientes:
            return siguientes[0] # Le toca al próximo en la fila
        else:
            return trabajadoras[0] # Si el que se fue era el último, volvemos a empezar

class ExpedienteViewSet(viewsets.ModelViewSet,):
    queryset = Expediente.objects.all().order_by('-id')[:5]
    serializer_class = ExpedienteSerializer

    def retrieve(self, request, *args, **kwargs):
        # 1. Dejamos que el sistema busque el expediente y arme la respuesta normal
        response = super().retrieve(request, *args, **kwargs)
        
        # 2. Obtenemos el expediente que el usuario acaba de abrir
        expediente = self.get_object()
        
        # 3. Guardamos la acción en el historial usando el helper que armamos
        registrar_auditoria(
            request.user,
            expediente,
            "El usuario visualizó los detalles del legajo en pantalla."
        )
        
        return response
    
    def perform_create(self, serializer):
        trabajadora_social = obtener_siguiente_trabajadora_social()
        
        # Guarda el expediente creado manualmente y conserva la instancia para notificar al usuario asignado.
        expediente = serializer.save(usuario_asignado=trabajadora_social)
        
        # Notifica a la Trabajadora Social cuando recibe el expediente creado desde este endpoint.
        crear_notificacion_recepcion_expediente(trabajadora_social, expediente)

        # NUEVO: Auditoría de creación manual
        registrar_auditoria(
            self.request.user,
            expediente,
            f"Expediente manual creado y asignado a TS: {trabajadora_social.first_name} {trabajadora_social.last_name}."
        )


    def get_queryset(self):
        usuario = self.request.user
        
        buscar = self.request.query_params.get('buscar')
        estado = self.request.query_params.get('estado')
        dni = self.request.query_params.get('dni') 
        dni_inicio = self.request.query_params.get('dni_inicio' ) 
        dni_fin = self.request.query_params.get('dni_fin' ) 
        dni_contiene = self.request.query_params.get('dni_contiene')
           
        usuario_asignado = self.request.query_params.get('usuario_asignado')

        
        if not usuario.is_authenticated:
            queryset = Expediente.objects.all()
        elif hasattr(usuario, 'usuario') and usuario.usuario.rol.nombre_rol in ['TS', 'LG', 'DE']:
            queryset = Expediente.objects.filter(usuario_asignado= usuario)
        else:
            queryset = Expediente.objects.all()

        # trae de una vez todo lo que usa ExpedienteSerializer: sin esto se hacian ~9 consultas por expediente
        queryset = queryset.select_related(
            'estado_expediente',
            'postulante_titular',
            'usuario_asignado__usuario__rol',
        ).prefetch_related(
            'historial_pases',
            'documentos__historial_pases',
        )

        if buscar:
            palabras = buscar.split()
            for palabra in palabras:
                queryset = queryset.filter(
                    Q(postulante_titular__nombre__icontains=palabra)|
                    Q(postulante_titular__apellido__icontains=palabra)
                )

        if estado:
            queryset = queryset.filter(estado_expediente__nombre = estado)
            
        if dni:
            queryset = queryset.filter(postulante_titular__dni = dni)
        
        if dni_inicio:
            queryset = queryset.filter(postulante_titular__dni__startswith=dni_inicio)

        if dni_fin:
            queryset = queryset.filter(postulante_titular__dni__endswith=dni_fin)

        if dni_contiene:
         queryset = queryset.filter(postulante_titular__dni__contains=dni_contiene)
            
        if usuario_asignado:
            queryset = queryset.filter(usuario_asignado = usuario_asignado)
            
        return queryset   
    
    def get_permissions(self):
        # cambiar_estado (Apto / No apto / Nueva visita) lo usan todos los roles, siempre sobre
        # expedientes en su poder: get_object() ya filtra por get_queryset
        if self.action in ['create', 'update', 'partial_update']:
            return [IsDataEntry()]
        if self.action in ['destroy']:
            return [IsSuperAdmin()]
        return [IsAnyRole()]

    @action(detail=False, methods=['get'], url_path='reporte-estados')
    def reporte_estados(self, request):
        conteos = (
            Expediente.objects
            .values('estado_expediente__nombre')
            .annotate(cantidad=Count('id'))
        )

        conteos_por_estado = {
            item['estado_expediente__nombre']: item['cantidad']
            for item in conteos
        }

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="reporte_estados_expedientes.csv"'

        writer = csv.writer(response)
        writer.writerow(['Estado', 'Cantidad'])

        estados = dict(EstadoExpediente.tipo_estado)
        for codigo_estado, nombre_estado in estados.items():
            writer.writerow([nombre_estado, conteos_por_estado.get(codigo_estado, 0)])

        return response
    
    
    @action(detail=True, methods=['patch'])
    def cambiar_estado(self, request, pk=None):
        expediente = self.get_object()
        nuevo_estado = request.data.get('estado')

        if nuevo_estado not in ['AP', 'NOAP', 'NUEVAV']:
            return Response({'error': 'Estado no válido'}, status=400)

        try:
            estado_obj = EstadoExpediente.objects.get(nombre=nuevo_estado)
        except EstadoExpediente.DoesNotExist:
            return Response({'error': 'El estado no existe en la base de datos. Crealo primero.'}, status=404)

        estado_anterior = expediente.estado_expediente
        expediente.estado_expediente = estado_obj
        expediente.save()

        registrar_auditoria(
            request.user,
            expediente,
            f"Cambio de estado: de {estado_anterior} a {estado_obj}."
        )

        return Response({'mensaje': 'Estado actualizado'}, status=200)

    @action(detail=True, methods=['get'], url_path='semaforo')
    def semaforo(self, request, pk=None):
        """
        Devuelve el ultimo semaforo guardado, sin llamar a la IA. Si nunca se evaluo, o si despues se
        edito el formulario o los datos del titular, 'resultado' viene en null y el frontend lo pide de nuevo.
        """
        expediente = self.get_object()
        formulario = self._formulario_completo(expediente)
        if formulario is None:
            return Response(
                {"error": "Primero hay que completar el formulario socio-habitacional."},
                status=status.HTTP_400_BAD_REQUEST
            )

        fecha = formulario.semaforo_fecha
        vigente = (
            fecha is not None
            and fecha >= formulario.fecha_modificacion
            and fecha >= expediente.postulante_titular.fecha_modificacion
        )
        return Response({'resultado': formulario.semaforo_resultado if vigente else None})

    @action(detail=True, methods=['post'], url_path='evaluar-semaforo')
    def evaluar_semaforo(self, request, pk=None):
        """
        Coteja la DDJJ con el informe socio-habitacional usando el microservicio de IA, guarda el
        semaforo con las inconsistencias en el formulario y lo devuelve.
        Lo usan todos los roles, sobre expedientes en su poder (get_object filtra por get_queryset).
        """
        expediente = self.get_object()
        formulario = self._formulario_completo(expediente)
        if formulario is None:
            return Response(
                {"error": "Primero hay que completar el formulario socio-habitacional."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            resultado = ia_client.evaluar_semaforo(expediente, formulario)
        except ia_client.IAServiceRejected as e:
            logger.error(f"El servicio de IA rechazo el expediente {expediente.id}: {e}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except ia_client.IAServiceUnavailable as e:
            logger.warning(f"Servicio de IA no disponible evaluando el expediente {expediente.id}: {e}")
            return Response(
                {"error": f"{e} Intentá de nuevo en unos segundos."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except ia_client.IAServiceError as e:
            logger.error(f"Error del servicio de IA evaluando el expediente {expediente.id}: {e}")
            return Response(
                {"error": "El servicio de IA no pudo evaluar el expediente."},
                status=status.HTTP_502_BAD_GATEWAY
            )

        ahora = timezone.now()
        resultado['fecha_evaluacion'] = ahora.isoformat()
        # update en lugar de save: asi no se toca fecha_modificacion y el resultado queda vigente
        FormularioSocioHabitacional.objects.filter(id=formulario.id).update(
            semaforo_resultado=resultado, semaforo_fecha=ahora
        )

        registrar_auditoria(
            request.user,
            expediente,
            f"Se evaluaron inconsistencias con IA: semáforo {resultado['semaforo']} "
            f"({resultado['total_inconsistencias']} inconsistencias)."
        )
        return Response(resultado)

    def _formulario_completo(self, expediente):
        formulario = (
            FormularioSocioHabitacional.objects.filter(expediente=expediente).order_by('-id').first()
        )
        if formulario is None or formulario.estado != 'completado':
            return None
        return formulario



class RolViewSet(ListModelMixin, RetrieveModelMixin, GenericViewSet):
    queryset = Rol.objects.all()
    permission_classes = [IsAnyRole]
    serializer_class = RolSerializer
    
class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    
    def get_permissions(self):
        # get_permissions pisa el permission_classes del @action: cada accion con permisos propios va aca
        if self.action in ['create', 'destroy', 'update', 'partial_update', 'auditoria_usuarios']:
            return [IsSuperAdmin()]
        return [IsAnyRole()]
    
    def get_queryset(self):
        queryset = Usuario.objects.all()
        rol= self.request.query_params.get('rol')

        if rol:
            queryset = queryset.filter(rol__nombre_rol=rol)

        # un rol operativo solo usa este listado para el desplegable de pases: no se incluye a si mismo.
        # El superadmin (pantalla de administracion de usuarios) sigue viendo a todos.
        if not usuario_tiene_rol(self.request, ['SU']):
            queryset = queryset.exclude(usuario=self.request.user)

        return queryset
    
    @action(detail=False, methods=['get'])
    def auditoria_usuarios(self, request):
        try:
            perfiles = self.get_queryset()
            
            #filtro para mostrar solo trabajadoras sociales
            solo_ts = request.query_params.get('solo_ts')
            if solo_ts == 'true':
                perfiles = perfiles.filter(rol__nombre_rol= 'TS')
                
            resultado = []

            for perfil in perfiles:
                user_nativo = perfil.usuario
                expedientes_del_usuario = user_nativo.expediente_set.all()
                
                total_asignados = expedientes_del_usuario.count()
                total_no_vistos = expedientes_del_usuario.filter(visto=False).count()

                desglose_db = expedientes_del_usuario.values('estado_expediente__nombre').annotate(cantidad=Count('id'))

                estados_limpios = {}
                for item in desglose_db:
                    codigo_estado = item['estado_expediente__nombre']
                    clave = codigo_estado if codigo_estado else "Sin estado"
                    estados_limpios[clave] = item['cantidad']

                resultado.append({
                    "usuario_id": perfil.id,
                    "nombre_completo": f"{perfil.apellido}, {perfil.nombre}",
                    "rol": perfil.rol.nombre_rol if perfil.rol else "Sin Rol",
                    "total_asignados": total_asignados,
                    "total_no_vistos": total_no_vistos,
                    "desglose_estados": estados_limpios
                })
            return Response(resultado)
        
        except Exception:
            # el detalle va al log del servidor, nunca en la respuesta (expondria codigo y rutas internas)
            logger.exception("Error armando la auditoria de usuarios")
            return Response({"error_fatal": "No se pudo generar la auditoría de usuarios."}, status=500)
    
    # auditoría creación de usuarios
    def perform_create(self, serializer):
        #se guarda el nuevo usuario
        nuevo_usuario = serializer.save()
        
        # Se busca el perfil de 'Usuario' del administrador que hace la petición
        usuario_admin = Usuario.objects.get(usuario=self.request.user)
        
        # Se deja constancia en la tabla de auditoría
        HistorialAccion.objects.create(
            id_usuario_accion=usuario_admin,
            mensaje_accion=f'Crear usuario: Creó el perfil de usuario para: {nuevo_usuario.nombre} {nuevo_usuario.apellido}.'
        )
    
    # auditoría modificación de usuarios
    def perform_update(self, serializer):
        #se guarda cambio del usuario actualizado
        usuario_actualizado = serializer.save()

        # Se busca el perfil del administrador que hace la petición
        usuario_admin = Usuario.objects.get(usuario=self.request.user)

        #se registra la modificación
        HistorialAccion.objects.create(
            id_usuario_accion=usuario_admin,
            mensaje_accion=f'Actualizar usuario: Modificó los datos o el estado del usuario: {usuario_actualizado.nombre} {usuario_actualizado.apellido}.'
        )
   
    # auditoría eliminación de usuarios
    def perform_destroy(self, instance):
        # 1. Borrado lógico del modelo Usuario personalizado
        instance.activo = False
        instance.save()

        # 2. Borrado lógico del User nativo de Django (para deshabilitar el login)
        user_django = instance.usuario
        user_django.is_active = False
        user_django.save()

        # 3. Se busca el perfil del administrador que hace la petición
        usuario_admin = Usuario.objects.get(usuario=self.request.user)
        nombre_completo = f"{instance.nombre} {instance.apellido}"
        
        # 4. Se deja constancia en la tabla de auditoría
        HistorialAccion.objects.create(
            id_usuario_accion=usuario_admin,
            mensaje_accion=f'Borrar usuario: Dio de baja al usuario {nombre_completo}.'
        )      
        
        
            
        
class DocumentoAdjuntoViewSet(viewsets.ModelViewSet):
    queryset = DocumentoAdjunto.objects.all()
    permission_classes = [IsAnyRole]
    serializer_class = DocumentoAdjuntoSerializer   
    
    #auditoría de subida
    def perform_create(self, serializer):
        validar_expediente_en_poder(self.request, serializer.validated_data.get('expediente'))
        documento = serializer.save(subido_por = self.request.user)

        perfil_usuario = getattr(self.request.user, 'usuario', None)
        if perfil_usuario:
            HistorialAccion.objects.create(
                id_usuario_accion=perfil_usuario,
                id_expediente=documento.expediente,
                mensaje_accion=f'UPLOAD: Se subió el archivo "{documento.archivo.name}".'
            )
    
    def get_queryset(self):
        queryset = filtrar_expedientes_en_poder(DocumentoAdjunto.objects.all(), self.request)
        expediente_id = self.request.query_params.get('expediente')
        
        if expediente_id:
            queryset = queryset.filter(expediente_id=expediente_id)
            
        return queryset
    
    #auditoría de borrado
    def perform_destroy(self, instance):
        # DocumentoAdjunto no tiene borrado lógico (no posee campo "activo"),
        # por eso se elimina el registro real.
        nombre_archivo = instance.archivo.name if instance.archivo else instance.tipo_documento
        expediente = instance.expediente

        instance.delete()

        perfil_usuario = getattr(self.request.user, 'usuario', None)
        if perfil_usuario:
            HistorialAccion.objects.create(
                id_usuario_accion=perfil_usuario,
                id_expediente=expediente,
                mensaje_accion=f'Borrar documento: Eliminó el archivo "{nombre_archivo}".'
            )
    
    # Los archivos NO se sirven por /media/ (quedarian publicos para cualquiera con la URL):
    # se descargan solo por aca, con login y rol, y cada descarga queda en la auditoria.
    @action(detail=True, methods=['get'], url_path='descargar')
    def descargar(self, request, pk=None):
        documento = self.get_object()

        if not documento.archivo:
            raise Http404('El documento no tiene archivo')
        try:
            archivo = documento.archivo.open('rb')
        except FileNotFoundError:
            raise Http404('No se encontro el archivo en el servidor')

        perfil_usuario = getattr(request.user, 'usuario', None)
        if perfil_usuario:
            HistorialAccion.objects.create(
                id_usuario_accion=perfil_usuario,
                id_expediente=documento.expediente,
                mensaje_accion=f'DOWNLOAD: Descargó el archivo "{documento.archivo.name}".'
            )

        return FileResponse(archivo, filename=os.path.basename(documento.archivo.name))

    #nueva ruta: auditoría de descarga
    @action(detail=True, methods=['get'], url_path='registrar-descarga')
    def registrar_descarga(self, request, pk=None):
        documento = self.get_object()

        perfil_usuario = getattr(request.user, 'usuario', None)
        if perfil_usuario:
            HistorialAccion.objects.create(
                id_usuario_accion=perfil_usuario,
                id_expediente=documento.expediente,
                mensaje_accion=f'DOWNLOAD: Descargó el archivo "{documento.archivo.name}".'
            )
        return Response({'mensaje': 'Descarga registrada exitosamente'})


class HistorialPaseViewSet(ListModelMixin, RetrieveModelMixin, CreateModelMixin, GenericViewSet):
    queryset = HistorialPase.objects.all()
    permission_classes = [IsAnyRole]
    serializer_class = HistorialPaseSerializer
    
    def perform_create(self, serializer):
        # solo quien tiene el expediente en su poder lo puede pasar
        validar_expediente_en_poder(self.request, serializer.validated_data.get('expediente'))
        pase = serializer.save(usuario_origen = self.request.user)
        expediente = pase.expediente

        documentos_pendientes = DocumentoAdjunto.objects.filter(
            expediente=expediente,
            historial_pases__isnull=True
        )
        if documentos_pendientes.exists():
            pase.documentos_adjuntos.add(*list(documentos_pendientes))
            serializer.instance = HistorialPase.objects.prefetch_related('documentos_adjuntos').get(id=pase.id)
        
        if pase.usuario_destino:
            expediente.usuario_asignado = pase.usuario_destino
            expediente.save()

        # Notifica al usuario destino cuando recibe el expediente por pase.
        # Si ya lo habia recibido antes, el helper usa el mensaje "Caso recibido".
        crear_notificacion_recepcion_expediente(pase.usuario_destino, expediente, pase_actual=pase)
        
    def get_queryset(self):
        queryset = (
            HistorialPase.objects
            .select_related(
                'expediente',
                'expediente__estado_expediente',
                'expediente__postulante_titular',
                'expediente__usuario_asignado',
                'expediente__usuario_asignado__usuario',
                'usuario_origen',
                'usuario_origen__usuario',
                'usuario_destino',
                'usuario_destino__usuario',
            )
            .prefetch_related('documentos_adjuntos')
        )
        queryset = filtrar_expedientes_en_poder(queryset, self.request)
        expediente_id = self.request.query_params.get('expediente')
        usuario_id = self.request.query_params.get('usuario')
        
        if expediente_id is not None:
            queryset = queryset.filter(expediente_id=expediente_id)

        if usuario_id:
            queryset = queryset.filter(
                Q(usuario_origen_id=usuario_id) |
                Q(usuario_destino_id=usuario_id)
            )
            
        return queryset

        
            
class NotificacionViewSet(viewsets.ModelViewSet):
    queryset = Notificacion.objects.all()
    serializer_class = NotificacionSerializer

    # Devuelve solo las notificaciones del usuario autenticado, ordenadas desde la mas reciente.
    # Los avisos de "expediente creado" dejan de mostrarse a los DIAS_VISIBLE_EXPEDIENTE_CREADO dias (no se borran).
    def get_queryset(self):
        limite = timezone.now() - timedelta(days=DIAS_VISIBLE_EXPEDIENTE_CREADO)
        return Notificacion.objects.filter(
            usuario_destino=self.request.user
        ).exclude(
            mensaje__startswith=MENSAJE_EXPEDIENTE_CREADO,
            fecha_creacion__lt=limite,
        ).order_by('-fecha_creacion')

    def get_permissions(self):
        if self.action == 'create':
            return [IsSuperAdmin()]
        return [IsAnyRole()]

    # Permite que el frontend marque como leida una notificacion ya mostrada al usuario.
    @action(detail=True, methods=['patch'], url_path='marcar-leida')
    def marcar_leida(self, request, pk=None):
        notificacion = self.get_object()
        notificacion.leida = True
        notificacion.save(update_fields=['leida'])
        return Response({'mensaje': 'Notificacion marcada como leida'})

class HistorialAccionViewSet(ListModelMixin, RetrieveModelMixin, GenericViewSet):
    queryset = HistorialAccion.objects.all()
    # la auditoria muestra lo que hizo cada usuario: solo la ve el superadmin (panel de Auditoria y
    # pantalla DetalleUsuario)
    permission_classes = [IsSuperAdmin]
    serializer_class = HistorialAccionSerializer

    def get_queryset(self):
        # trae la auditoria de la mas reciente a la mas vieja, con filtros opcionales por query params.
        # select_related evita una consulta por fila al armar usuario_display y el link al expediente.
        queryset = HistorialAccion.objects.select_related(
            'id_usuario_accion__rol', 'id_expediente'
        ).order_by('-fecha_accion')

        params = self.request.query_params

        usuario = params.get('usuario')
        if usuario:
            queryset = queryset.filter(id_usuario_accion=usuario)

        rol = params.get('rol')
        if rol:
            queryset = queryset.filter(id_usuario_accion__rol__nombre_rol=rol)

        expediente = params.get('expediente')
        if expediente:
            queryset = queryset.filter(id_expediente=expediente)

        texto = params.get('q')
        if texto:
            queryset = queryset.filter(mensaje_accion__icontains=texto)

        # fechas en formato AAAA-MM-DD; se comparan por dia, inclusive en ambos extremos
        desde = params.get('desde')
        if desde:
            queryset = queryset.filter(fecha_accion__date__gte=desde)

        hasta = params.get('hasta')
        if hasta:
            queryset = queryset.filter(fecha_accion__date__lte=hasta)

        return queryset




def _dibujar_encabezado_pie_formulario(canvas, doc):
    canvas.saveState()
    ancho_pagina, alto_pagina = A4

    # --- Rutas de los logos ---
    logo_ipvu_path = os.path.join(
        settings.BASE_DIR, "gestion", "static_pdf", "logo_ipvu.jpg"
    )
    logo_santiago_path = os.path.join(
        settings.BASE_DIR, "gestion", "static_pdf", "logo_santiago.jpg"
    )

    # --- Logo izquierdo (I.P.V.U.) ---
    if os.path.exists(logo_ipvu_path):
        canvas.drawImage(
            logo_ipvu_path,
            x=2 * cm, y=alto_pagina - 2.3 * cm,
            width=2 * cm, height=1.6 * cm,
            preserveAspectRatio=True, mask='auto'
        )
    else:
        logger.warning(f"No se encontró el logo IPVU en: {logo_ipvu_path}")

    # --- Logo derecho (Santiago) ---
    if os.path.exists(logo_santiago_path):
        canvas.drawImage(
            logo_santiago_path,
            x=ancho_pagina - 4 * cm, y=alto_pagina - 2.3 * cm,
            width=2 * cm, height=1.6 * cm,
            preserveAspectRatio=True, mask='auto'
        )
    else:
        logger.warning(f"No se encontró el logo Santiago en: {logo_santiago_path}")

    # --- Encabezado institucional (3 líneas centradas) ---
    y = alto_pagina - 1.3 * cm
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawCentredString(ancho_pagina / 2, y, "INSTITUTO PROVINCIAL DE VIVIENDA Y URBANISMO")
    y -= 0.42 * cm
    canvas.drawCentredString(ancho_pagina / 2, y, "Ministerio de Obras y Servicios Públicos")
    y -= 0.42 * cm
    canvas.drawCentredString(ancho_pagina / 2, y, "SECRETARÍA TÉCNICA DE RELACIONES PUBLICAS E INSTITUCIONALES")

    # --- Fila de contacto ---
    y -= 0.35 * cm
    canvas.setLineWidth(0.5)
    canvas.line(2 * cm, y, ancho_pagina - 2 * cm, y)
    y -= 0.45 * cm
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawCentredString(ancho_pagina * 0.20, y, "Agustín Álvarez N° 90")
    canvas.drawCentredString(ancho_pagina * 0.50, y, "Tel. (0385) 422-1646 / 4989")
    canvas.drawCentredString(ancho_pagina * 0.80, y, "4200 - Santiago del Estero")
    y -= 0.25 * cm
    canvas.line(2 * cm, y, ancho_pagina - 2 * cm, y)

    # --- Pie de página ---
    canvas.setFont("Helvetica-Oblique", 7)
    canvas.drawCentredString(
        ancho_pagina / 2, 1.3 * cm,
        "Secretaría Técnica de Relaciones Públicas - I.P.V.U. - "
        "Lunes a Viernes de 8 a 12 hs. - Santiago del Estero"
    )

    canvas.restoreState()
    
class FormularioSocioHabitacionalViewSet(ListModelMixin, RetrieveModelMixin, CreateModelMixin, UpdateModelMixin, GenericViewSet):
    queryset = FormularioSocioHabitacional.objects.all()
    serializer_class = FormularioSocioHabitacionalSerializer
    
    def get_queryset(self):
        queryset = filtrar_expedientes_en_poder(FormularioSocioHabitacional.objects.all(), self.request)
        expediente_id = self.request.query_params.get('expediente')
        
        if expediente_id:
            queryset = queryset.filter(expediente_id = expediente_id)
            
        return queryset
            
    
    def perform_create(self, serializer):
        validar_expediente_en_poder(self.request, serializer.validated_data.get('expediente'))
        formulario = serializer.save()
        expediente = formulario.expediente
        estado_1v = EstadoExpediente.objects.get(nombre='1V')
        expediente.estado_expediente = estado_1v
        expediente.save()

        # NUEVO: Auditoría de Trabajo de Campo
        registrar_auditoria(
            self.request.user,
            expediente,
            "Se guardó el Informe Socio-Habitacional del caso."
        )
        
        
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update']:
            return [IsTrabajadoraSocial()]
        return [IsAnyRole()]


    @action(detail=True, methods=['get'], url_path='pdf')
    def generar_pdf(self, request, pk=None):
        formulario = self.get_object()
        expediente = formulario.expediente
        pdf_bytes = _construir_pdf_formulario(formulario)
        nombre_archivo = f"Formulario_{formulario.id}.pdf"

        # regenerar el PDF reemplaza la copia que todavia no viajo en ningun pase, en lugar de sumar
        # otra cada vez; las copias que ya se enviaron en un pase quedan intactas como parte del historial
        documento = (
            DocumentoAdjunto.objects
            .filter(expediente=expediente, tipo_documento=TIPO_DOCUMENTO_FORMULARIO, historial_pases__isnull=True)
            .order_by('-id')
            .first()
        )
        if documento is None:
            DocumentoAdjunto.objects.create(
                tipo_documento=TIPO_DOCUMENTO_FORMULARIO,
                archivo=ContentFile(pdf_bytes, name=nombre_archivo),
                subido_por=request.user,
                expediente=expediente
            )
        else:
            # se borra el archivo anterior solo si ningun otro documento lo usa: como la base es compartida y
            # los archivos se guardan en la compu de cada uno, dos documentos pueden terminar con el mismo nombre
            archivo_compartido = (
                DocumentoAdjunto.objects.filter(archivo=documento.archivo.name).exclude(id=documento.id).exists()
            )
            if documento.archivo and not archivo_compartido:
                documento.archivo.delete(save=False)
            documento.subido_por = request.user
            documento.archivo.save(nombre_archivo, ContentFile(pdf_bytes), save=True)

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
        return response


TIPO_DOCUMENTO_FORMULARIO = "Formulario Socio Habitacional"

# estilo del cuerpo del informe; el encabezado y el pie con logos los dibuja _dibujar_encabezado_pie_formulario
COLOR_BORDE_PDF = colors.HexColor('#9CA3AF')
COLOR_FONDO_TITULO_PDF = colors.HexColor('#E5E7EB')
COLOR_ETIQUETA_PDF = colors.HexColor('#F3F4F6')
ANCHO_CUERPO_PDF = 17 * cm  # A4 menos 2 cm de margen de cada lado
MESES_PDF = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]


def _texto_pdf(valor, vacio='-'):
    # escapa &, < y > para que reportlab no los tome como etiquetas, y respeta los saltos de linea
    texto = str(valor or '').strip()
    return escape(texto).replace('\n', '<br/>') if texto else vacio


def _construir_pdf_formulario(formulario):
    """Arma el PDF del informe socio-habitacional y devuelve sus bytes."""
    expediente = formulario.expediente

    # --- Datos del profesional asignado ---
    profesional = ""
    if expediente.usuario_asignado:
        try:
            perfil = expediente.usuario_asignado.usuario
            profesional = f"{perfil.apellido}, {perfil.nombre} (Mat. {perfil.matricula})"
        except (AttributeError, ObjectDoesNotExist) as e:
            logger.warning(
                f"No se pudo obtener perfil detallado para usuario_asignado "
                f"id={expediente.usuario_asignado_id}: {e}"
            )
            profesional = (
                f"{expediente.usuario_asignado.last_name}, "
                f"{expediente.usuario_asignado.first_name}"
            )

    # --- Datos del titular ---
    domicilio = apellido = nombre = dni = ""
    if expediente.postulante_titular:
        titular = expediente.postulante_titular
        domicilio = getattr(titular, 'domicilio_actual', '') or ''
        apellido = getattr(titular, 'apellido', '') or ''
        nombre = getattr(titular, 'nombre', '') or ''
        dni = getattr(titular, 'dni', '') or ''
    titular_completo = ", ".join(parte for parte in (apellido, nombre) if parte)

    # --- Fecha ---
    fecha = formulario.fecha_modificacion or formulario.fecha_creacion
    if fecha:
        texto_fecha = f"Santiago del Estero, {fecha.day} de {MESES_PDF[fecha.month - 1]} de {fecha.year}"
    else:
        texto_fecha = "Santiago del Estero, ____ de ______________ de 20___"

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=3.6 * cm,
        bottomMargin=2.2 * cm,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='TituloFormulario', parent=styles['Heading1'],
                              alignment=TA_CENTER, fontSize=13, spaceBefore=2, spaceAfter=10))
    styles.add(ParagraphStyle(name='EtiquetaDato', parent=styles['Normal'],
                              fontName='Helvetica-Bold', fontSize=9, leading=11))
    styles.add(ParagraphStyle(name='ValorDato', parent=styles['Normal'], fontSize=9.5, leading=11.5))
    styles.add(ParagraphStyle(name='SeccionTitulo', parent=styles['Normal'],
                              fontName='Helvetica-Bold', fontSize=10, leading=12))
    styles.add(ParagraphStyle(name='TextoCuerpo', parent=styles['Normal'], fontSize=10, leading=14))
    styles.add(ParagraphStyle(name='FirmaEtiqueta', parent=styles['Normal'],
                              alignment=TA_CENTER, fontSize=9, leading=11))

    elementos = []

    def bloque_identificacion():
        def etiqueta(texto):
            return Paragraph(texto, styles['EtiquetaDato'])

        def valor(texto):
            return Paragraph(_texto_pdf(texto), styles['ValorDato'])

        tabla = Table(
            [
                [etiqueta("Profesional actuante"), valor(profesional), '', ''],
                [etiqueta("Caso de referencia"), valor(f"Expediente N° {expediente.id}"),
                 etiqueta("DJ N°"), valor(expediente.DDJJ)],
                [etiqueta("Titular"), valor(titular_completo), etiqueta("DNI"), valor(dni)],
                [etiqueta("Domicilio"), valor(domicilio), '', ''],
                [etiqueta("Domicilio constatado"), valor(formulario.domicilio_constatado), '', ''],
            ],
            colWidths=[3.8 * cm, 6.2 * cm, 1.6 * cm, 5.4 * cm],
        )
        tabla.setStyle(TableStyle([
            ('SPAN', (1, 0), (3, 0)),
            ('SPAN', (1, 3), (3, 3)),
            ('SPAN', (1, 4), (3, 4)),
            ('BOX', (0, 0), (-1, -1), 0.75, COLOR_BORDE_PDF),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, COLOR_BORDE_PDF),
            ('BACKGROUND', (0, 0), (0, -1), COLOR_ETIQUETA_PDF),
            ('BACKGROUND', (2, 1), (2, 2), COLOR_ETIQUETA_PDF),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elementos.append(tabla)
        elementos.append(Spacer(1, 0.45 * cm))

    def seccion(titulo, bajada, contenido, alto_minimo):
        # recuadro con alto minimo: con poco texto la hoja queda pareja; con mucho, el recuadro crece
        # y si no entra sigue en la pagina siguiente repitiendo el titulo
        encabezado = f"{titulo}"
        if bajada:
            encabezado += f" &nbsp;<font name='Helvetica-Oblique' size='8' color='#6B7280'>{bajada}</font>"
        tabla = Table(
            [
                [Paragraph(encabezado, styles['SeccionTitulo'])],
                [Paragraph(_texto_pdf(contenido, vacio=''), styles['TextoCuerpo'])],
            ],
            colWidths=[ANCHO_CUERPO_PDF],
            minRowHeights=[0, alto_minimo],
            repeatRows=1,
            splitInRow=1,
        )
        tabla.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.75, COLOR_BORDE_PDF),
            ('LINEBELOW', (0, 0), (-1, 0), 0.75, COLOR_BORDE_PDF),
            ('BACKGROUND', (0, 0), (-1, 0), COLOR_FONDO_TITULO_PDF),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 7),
            ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ]))
        # KeepTogether pasa la seccion entera a la hoja siguiente si no entra; solo la parte si ocupa mas de una hoja
        elementos.append(KeepTogether([tabla]))
        elementos.append(Spacer(1, 0.35 * cm))

    def firma(etiqueta, espacio_arriba=1.3 * cm):
        tabla = Table(
            [[''], [Paragraph(etiqueta, styles['FirmaEtiqueta'])]],
            colWidths=[7.5 * cm],
            rowHeights=[espacio_arriba, None],
            hAlign='CENTER',
        )
        tabla.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (0, 0), 0.75, colors.black),
            ('TOPPADDING', (0, 1), (0, 1), 3),
        ]))
        return tabla

    # ============ PÁGINA 1 ============
    elementos.append(Paragraph("INFORME SOCIO HABITACIONAL", styles['TituloFormulario']))
    bloque_identificacion()
    seccion("GRUPO FAMILIAR CONSTITUYENTE", "Tipo y dinámica familiar. Conflictos", formulario.grupo_familiar, 2.2 * cm)
    seccion("SITUACIÓN HABITACIONAL", "Tipo de posesión y tiempo de habitabilidad", formulario.situacion_habitacional, 2.2 * cm)
    seccion("ASPECTO ECONÓMICO", "Ingresos y calidad de vida", formulario.aspecto_economico, 2.2 * cm)
    seccion("SITUACIÓN DE SALUD", "Discapacidad. Invalidez", formulario.situacion_salud, 2.2 * cm)
    seccion("NIVEL DE ESTUDIOS", None, formulario.nivel_estudios, 1.1 * cm)
    elementos.append(KeepTogether([firma("Firma y Aclaración del Entrevistado")]))

    # ============ PÁGINA 2 ============
    elementos.append(PageBreak())
    seccion("RELEVAMIENTO VECINAL", None, formulario.relevamiento_vecinal, 5.5 * cm)
    elementos.append(KeepTogether([firma("Firma y Aclaración del Entrevistado")]))
    elementos.append(Spacer(1, 0.6 * cm))
    seccion("OBSERVACIONES Y/O PARTICULARIDADES", None, formulario.observaciones, 5.5 * cm)

    # --- Cierre: fecha, saludo y firma del profesional, siempre juntos en la misma hoja ---
    elementos.append(KeepTogether([
        Spacer(1, 0.4 * cm),
        Paragraph(texto_fecha, styles['TextoCuerpo']),
        Spacer(1, 0.2 * cm),
        Paragraph("Atentamente", styles['TextoCuerpo']),
        firma("Firma y Sello del Profesional Actuante", espacio_arriba=1.6 * cm),
    ]))

    doc.build(
        elementos,
        onFirstPage=_dibujar_encabezado_pie_formulario,
        onLaterPages=_dibujar_encabezado_pie_formulario,
    )
    return buffer.getvalue()
    
class MiLoginPersonalizadoView(TokenObtainPairView):
    serializer_class = MiLoginPersonalizadoSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"
    
    #interceptar login para que superadmin consulte en auditoría
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        
        # si el login fue un exito, o sea, status 200, se registra la acción
        if response.status_code == 200:
            try:
                #  Se busca el User nativo de Django usando el username de la petición
                usuario_django = User.objects.get(username=request.data.get('username'))
                
                #  Se busca tu modelo Usuario personalizado vinculado a ese User
                usuario_personalizado = Usuario.objects.get(usuario=usuario_django)

                #  Se crea el registro en el historial con el modelo correcto
                HistorialAccion.objects.create(
                    id_usuario_accion=usuario_personalizado,
                    mensaje_accion='Login: El usuario inició sesión en el sistema.'
                )
            except User.DoesNotExist:
                pass
            except Usuario.DoesNotExist:
                pass
                
        return response           
          
   

class EstablecerPasswordInicialView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = EstablecerPasswordInicialSerializer(
            data=request.data,
            context={"request": request}
        )

        serializer.is_valid(raise_exception=True)    
        serializer.save()

        return Response({"mensaje": "Contraseña actualizada correctamente"})

class SolicitarResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes =[ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = SolicitarResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        usuario = User.objects.filter(email=email).first()

        if usuario:
            uid = urlsafe_base64_encode(force_bytes(usuario.pk))
            token = default_token_generator.make_token(usuario)
            reset_link = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}/"

            send_mail(
                subject="Restablecer contraseña",
                message=(
                    "Recibimos una solicitud para restablecer tu password.\n\n"
                    f"Usa este enlace para crear una password nueva:\n{reset_link}\n\n"
                    "Si no solicitaste este cambio, puedes ignorar este mensaje."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[usuario.email],
                fail_silently=False,
            )

        return Response({
            "mensaje": "Si el email existe, se enviaron instrucciones para resetear la contraseña."
        })


class ConfirmarResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"
    def post(self, request):
        serializer = ConfirmarResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            "mensaje": "Contraseña actualizada correctamente."
        })


class MiTokenRefreshView(TokenRefreshView):

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "token_refresh"


class ProcesarDocumentoView(APIView):
    """
    Recibe la DDJJ (PDF o foto), la reenvia al microservicio de IA y devuelve los datos extraidos
    para precargar el formulario de nuevo expediente. No guarda nada: la operadora revisa los
    campos y recien al crear el expediente se persisten.
    """
    permission_classes = [IsDataEntryOrSuperAdmin]
    parser_classes = [MultiPartParser]

    EXTENSIONES_PERMITIDAS = ('.pdf', '.png', '.jpg', '.jpeg')
    TAMANIO_MAXIMO_MB = 10

    def post(self, request):
        archivo = request.FILES.get('documento')
        if archivo is None:
            return Response(
                {"error": "Debe adjuntar el documento en el campo 'documento'."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not archivo.name.lower().endswith(self.EXTENSIONES_PERMITIDAS):
            return Response(
                {"error": f"Formato no soportado. Formatos válidos: {', '.join(self.EXTENSIONES_PERMITIDAS)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        if archivo.size > self.TAMANIO_MAXIMO_MB * 1024 * 1024:
            return Response(
                {"error": f"El archivo supera los {self.TAMANIO_MAXIMO_MB} MB permitidos."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            datos = ia_client.autocompletar_ddjj(archivo)
        except ia_client.IAServiceRejected as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except ia_client.IAServiceUnavailable as e:
            logger.warning(f"Servicio de IA no disponible procesando {archivo.name}: {e}")
            return Response(
                {"error": f"{e} Intentá de nuevo en unos segundos o completá los campos a mano."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except ia_client.IAServiceError as e:
            logger.error(f"Error del servicio de IA procesando {archivo.name}: {e}")
            return Response(
                {"error": "El servicio de IA no pudo procesar el documento. Completá los campos a mano."},
                status=status.HTTP_502_BAD_GATEWAY
            )

        return Response(datos)
