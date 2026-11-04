from rest_framework import serializers
from .models import *
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.models import User
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import force_str
from django.contrib.auth.tokens import default_token_generator
from django.utils import timezone


# los adjuntos se descargan por el endpoint protegido, nunca por /media/ (ver DocumentoAdjuntoViewSet.descargar)
def url_descarga(documento):
    return f'/api/documentoadjunto/{documento.id}/descargar/' if documento.archivo else None


EXTENSIONES_ADJUNTO = ('.pdf', '.png', '.jpg', '.jpeg')
TAMANIO_MAXIMO_ADJUNTO_MB = 10


# textos que, cargados en el campo discapacidad, significan que el postulante no tiene discapacidad
VALORES_SIN_DISCAPACIDAD = {'', 'ninguna', 'no', 'sin', 'sin discapacidad', '0', 'false'}


class PostulanteTitularSerializer(serializers.ModelSerializer):
    ddjj = serializers.CharField(write_only=True)
    discapacidad = serializers.CharField(write_only=True, required=False, allow_blank=True)
    fecha_inscripcion = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        model = PostulanteTitular
        fields = '__all__'
        read_only_fields = ('fecha_creacion', 'fecha_modificacion')

    def validate(self, attrs):
        # traduce el texto libre de discapacidad al booleano del modelo, tanto al crear como al editar
        discapacidad = attrs.pop('discapacidad', None)
        if discapacidad is not None:
            attrs['tiene_discapacidad'] = str(discapacidad).strip().lower() not in VALORES_SIN_DISCAPACIDAD

        # fecha_inscripcion todavia no existe en el modelo: se descarta hasta que el equipo decida si se persiste
        attrs.pop('fecha_inscripcion', None)
        return attrs
        
        
class EstadoExpedienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstadoExpediente
        fields = ['id', 'nombre']
        read_only_fields = ('nombre',)

class ExpedienteSerializer(serializers.ModelSerializer):
    estado_expediente = EstadoExpedienteSerializer(read_only= True)
    estado_expediente_id = serializers.PrimaryKeyRelatedField(queryset=EstadoExpediente.objects.all(), source='estado_expediente',write_only=True)
    documentos_adjuntos = serializers.SerializerMethodField()
    
    class Meta:
        model = Expediente
        fields = '__all__'
        read_only_fields = ('fecha_creacion', 'fecha_modificacion')
        
    def to_representation(self, instance):
        response = super().to_representation(instance)
        
         #calculo de dias en poder
        # se calcula en Python sobre los pases ya precargados (prefetch_related en la vista) para no consultar la base por cada expediente
        ultimo_pase = max(instance.historial_pases.all(), key=lambda pase: pase.fecha_envio, default=None)
        fecha_referencia = None

        if ultimo_pase and ultimo_pase.fecha_envio:
            fecha_referencia = ultimo_pase.fecha_envio
        elif instance.fecha_creacion:
            fecha_referencia = instance.fecha_creacion

        if fecha_referencia:
            diferencia = timezone.now() - fecha_referencia
            response['dias_en_poder'] = diferencia.days
        else:
            response['dias_en_poder'] = 0
            
           #estado del expediente
        if instance.estado_expediente:
            response['estado_expediente'] = instance.estado_expediente.nombre
        else:
            response['estado_expediente'] = "Sin estado"

            #postulante titular
        if instance.postulante_titular:
            titular = instance.postulante_titular
            response['postulante_titular'] = {
                'id': titular.id,
                'nombre': titular.nombre,
                'apellido': titular.apellido,
                'dni': titular.dni,
                'domicilio': getattr(titular, 'domicilio_actual', getattr(titular, 'domicilio', 'Sin domicilio')),
                'telefono': getattr(titular, 'telefono', 'Sin teléfono'),
                'email': getattr(titular, 'email', 'Sin email')
            }
        else:
            response['postulante_titular'] = None

            #usuario asignado
        if instance.usuario_asignado:
            user = instance.usuario_asignado
            perfil = getattr(user, 'usuario', None)
            rol_nombre = perfil.rol.nombre_rol if perfil and perfil.rol else "Sin Rol"
            
            nombre_real = getattr(perfil, 'nombre', user.first_name) if perfil else user.first_name
            apellido_real = getattr(perfil, 'apellido', user.last_name) if perfil else user.last_name
            
            response['usuario_asignado'] = {
                'id': user.id,
                'nombre': nombre_real,
                'apellido': apellido_real,
                'rol': rol_nombre
            }
        else:
            response['usuario_asignado'] = None

        return response

    def get_documentos_adjuntos(self, obj):
        # .all() reutiliza los documentos y pases precargados por la vista en lugar de hacer 2 consultas por documento
        documentos_adjuntos = []
        for doc in obj.documentos.all():
            pases_ids = [pase.id for pase in doc.historial_pases.all()]
            documentos_adjuntos.append({
                "id": doc.id,
                "tipo_documento": doc.tipo_documento,
                "archivo": doc.archivo.name if doc.archivo else None,
                "archivo_url": url_descarga(doc),
                "historial_pases": pases_ids,
                "pendiente_pase": not pases_ids,
            })
        return documentos_adjuntos
    
    def update(self, instance, validated_data):
        # Obligamos a que sí o sí usen tu @action "cambiar_estado"
        validated_data.pop('estado_expediente', None)
        
        # Obligamos a que usen el HistorialPase para transferir expedientes.
        validated_data.pop('usuario_asignado', None)

        return super().update(instance, validated_data)
    
    
class RolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rol
        fields = '__all__'
        read_only_fields = ('tipo_rol','nombre_rol')
        
class UsuarioSerializer(serializers.ModelSerializer):

    class Meta:
        model = Usuario
        fields = '__all__'
        # requiere_cambio_password solo lo apaga el propio usuario al elegir su password
        # (la inicial es el DNI): si se pudiera mandar en False, la cuenta quedaria con el DNI de password
        read_only_fields = ('usuario', 'requiere_cambio_password')
        
    def create(self, validated_data):
        dni_ingresado = validated_data.get('dni')
        email_ingresado= validated_data.get('email')
        
        nuevo_usuario= User.objects.create_user (
            username = dni_ingresado,
            password = dni_ingresado,
            email=email_ingresado
        )
        perfil_usuario = Usuario.objects.create(usuario=nuevo_usuario, **validated_data)
        
        return perfil_usuario
        
    # datos que solo el superadmin puede ver de otros usuarios. El resto de los roles usa este
    # serializer solo para el desplegable de pases (id, nombre y rol): el DNI es ademas el usuario y
    # la contrasena inicial, y requiere_cambio_password delata que cuentas siguen con esa contrasena,
    # asi que exponerlos deja enumerar y tomar cuentas ajenas, incluidas las de superadmin.
    CAMPOS_SOLO_SUPERADMIN = ('dni', 'email', 'matricula', 'requiere_cambio_password', 'username_display')

    def to_representation(self, instance):
        ret = super().to_representation(instance)

        if instance.usuario:
            ret['username_display'] = instance.usuario.username

        if instance.rol:
            ret['rol_display'] = instance.rol.nombre_rol

        ret['nombre_completo'] = f"{instance.nombre} {instance.apellido}"

        request = self.context.get('request')
        actor = getattr(request, 'user', None) if request else None
        es_superadmin = bool(
            actor and actor.is_authenticated and hasattr(actor, 'usuario')
            and actor.usuario.rol and actor.usuario.rol.nombre_rol == 'SU'
        )
        if not es_superadmin:
            for campo in self.CAMPOS_SOLO_SUPERADMIN:
                ret.pop(campo, None)

        return ret
    
class DocumentoAdjuntoSerializer(serializers.ModelSerializer):
    archivo_url = serializers.SerializerMethodField()
    historial_pases = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    pendiente_pase = serializers.SerializerMethodField()

    class Meta:
        model = DocumentoAdjunto
        fields = [
            'id',
            'archivo',
            'archivo_url',
            'tipo_documento',
            'subido_por',
            'expediente',
            'historial_pases',
            'pendiente_pase',
        ]
        read_only_fields = ['subido_por']
        
    def get_archivo_url(self, obj):
        return url_descarga(obj)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # solo el nombre: la URL de /media/ no se expone
        ret['archivo'] = instance.archivo.name if instance.archivo else None
        return ret

    def validate_archivo(self, archivo):
        if archivo is None:
            return archivo
        if not archivo.name.lower().endswith(EXTENSIONES_ADJUNTO):
            raise serializers.ValidationError(
                f"Formato no soportado. Formatos válidos: {', '.join(EXTENSIONES_ADJUNTO)}"
            )
        if archivo.size > TAMANIO_MAXIMO_ADJUNTO_MB * 1024 * 1024:
            raise serializers.ValidationError(f"El archivo supera los {TAMANIO_MAXIMO_ADJUNTO_MB} MB permitidos.")
        return archivo

    def get_pendiente_pase(self, obj):
        return not obj.historial_pases.exists()

class HistorialPaseSerializer(serializers.ModelSerializer):
    expediente_info = serializers.SerializerMethodField()
    estado_actual = serializers.SerializerMethodField()
    documentos_adjuntos_detalle = serializers.SerializerMethodField()
    documentos_adjuntos = serializers.PrimaryKeyRelatedField(
        queryset=DocumentoAdjunto.objects.all(), 
        many=True, 
        required=False
    )
    class Meta:
        model = HistorialPase
        fields = [
            'id',
            'expediente',
            'expediente_info',
            'usuario_origen',
            'usuario_destino',
            'documentos_adjuntos',
            'documentos_adjuntos_detalle',
            'observacion',
            'fecha_envio',
            'estado_actual',
        ]
        read_only_fields = ('fecha_envio', 'usuario_origen', 'expediente_info', 'estado_actual', 'documentos_adjuntos_detalle')

    def validate(self, attrs):
        attrs = super().validate(attrs)
        expediente = attrs.get('expediente') or getattr(self.instance, 'expediente', None)
        documentos = attrs.get('documentos_adjuntos', [])

        for doc in documentos:
            if doc.expediente_id != expediente.id:
                raise serializers.ValidationError({
                    'documentos_adjuntos': f'El documento {doc.id} no pertenece al expediente del pase.'
                })
                
        return attrs
        
    def get_estado_actual(self, obj):
        if obj.expediente and obj.expediente.estado_expediente:
            return obj.expediente.estado_expediente.get_nombre_display()
        return "Sin estado"
    
    def get_expediente_info(self, obj):
        expediente = obj.expediente

        return {
            'id': expediente.id,
            'ddjj': expediente.DDJJ,
            'usuario_asignado': {
                'id': expediente.usuario_asignado.id,
                'nombre': expediente.usuario_asignado.first_name,
                'apellido': expediente.usuario_asignado.last_name,
            } if expediente.usuario_asignado else None,
            'postulante_titular': {
                'id': expediente.postulante_titular.id,
                'nombre': expediente.postulante_titular.nombre,
                'apellido': expediente.postulante_titular.apellido,
                'dni': expediente.postulante_titular.dni,
            } if expediente.postulante_titular else None
        }
        
    def get_documentos_adjuntos_detalle(self, obj):
        documentos = obj.documentos_adjuntos.all()

        if documentos.exists():
            return [
                {
                    "id": doc.id,
                    "tipo_documento": doc.tipo_documento,
                    "archivo": doc.archivo.name if doc.archivo else None,
                    "archivo_url": url_descarga(doc)
                } for doc in documentos
            ]
        return []
    
    
    def to_representation(self, instance):
        response = super().to_representation(instance)
        
        usuario_origen = instance.usuario_origen
        if usuario_origen:
            p_origen = getattr(usuario_origen, 'usuario', None)
            nombre_origen = getattr(p_origen, 'nombre', usuario_origen.first_name) if p_origen else usuario_origen.first_name
            apellido_origen = getattr(p_origen, 'apellido', usuario_origen.last_name) if p_origen else usuario_origen.last_name
            response['usuario_origen_display'] = f"{nombre_origen} {apellido_origen}".strip()
        else:
            response['usuario_origen_display'] = "Sistema"
            
        usuario_destino = instance.usuario_destino
        if usuario_destino:
            p_destino = getattr(usuario_destino, 'usuario', None)
            nombre_destino = getattr(p_destino, 'nombre', usuario_destino.first_name) if p_destino else usuario_destino.first_name
            apellido_destino = getattr(p_destino, 'apellido', usuario_destino.last_name) if p_destino else usuario_destino.last_name
            response['usuario_destino_display'] = f"{nombre_destino} {apellido_destino}".strip()
        else:
            response['usuario_destino_display'] = "Sin asignar"
            
        return response
    
        
class NotificacionSerializer(serializers.ModelSerializer):
    # agrega datos resumidos del expediente para mostrar la notificacion sin pedir otro endpoint
    expediente = serializers.SerializerMethodField()

    class Meta:
        model = Notificacion
        fields = [
            'id',
            'mensaje',
            'fecha_creacion',
            'leida',
            'usuario_destino',
            'expediente_relacionado',
            'expediente',
        ]
        read_only_fields = ('fecha_creacion', 'leida', 'expediente')

    # version compacta del expediente relacionado para que el frontend pueda listar el caso recibido
    def get_expediente(self, obj):
        if not obj.expediente_relacionado:
            return None

        expediente = obj.expediente_relacionado
        postulante = expediente.postulante_titular

        return {
            'id': expediente.id,
            'ddjj': expediente.DDJJ,
            'estado': expediente.estado_expediente.nombre,
            'postulante': {
                'id': postulante.id,
                'nombre': postulante.nombre,
                'apellido': postulante.apellido,
                'dni': postulante.dni,
            }
        }

class FormularioSocioHabitacionalSerializer(serializers.ModelSerializer):
    grupo_familiar = serializers.CharField(allow_blank=True, required=False)
    situacion_habitacional = serializers.CharField(allow_blank=True, required=False)
    aspecto_economico = serializers.CharField(allow_blank=True, required=False)
    situacion_salud = serializers.CharField(allow_blank=True, required=False)
    nivel_estudios = serializers.CharField(allow_blank=True, required=False)
    relevamiento_vecinal = serializers.CharField(allow_blank=True, required=False)
    observaciones = serializers.CharField(allow_blank=True, required=False)
    domicilio_constatado = serializers.CharField(allow_blank=True, required=False, max_length=200)

    # Estado calculado automaticamente segun la cantidad de campos completados del formulario.
    estado = serializers.ReadOnlyField()

    class Meta:
        model = FormularioSocioHabitacional
        fields = [
            'id',
            'grupo_familiar',
            'situacion_habitacional',
            'aspecto_economico',
            'situacion_salud',
            'nivel_estudios',
            'relevamiento_vecinal',
            'observaciones',
            'domicilio_constatado',
            'expediente',
            'fecha_creacion',
            'fecha_modificacion',
            'estado',
        ]
        read_only_fields = ('fecha_creacion', 'fecha_modificacion', 'estado')
        

class HistorialAccionSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistorialAccion
        fields = '__all__'
        read_only_fields = ('fecha_accion',)
        
    def to_representation(self, instance):
        response = super().to_representation(instance)
        
        # Agregamos el nombre y el rol del usuario para que el Front no reniegue ni haga consultas extra
        if instance.id_usuario_accion:
            perfil = instance.id_usuario_accion
            response['usuario_display'] = f"{perfil.nombre} {perfil.apellido}"
            response['rol_display'] = perfil.rol.nombre_rol if perfil.rol else None
        else:
            response['usuario_display'] = "Sistema"
            response['rol_display'] = None

        return response
      
class MiLoginPersonalizadoSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        
        try:
            perfil_ipvu = Usuario.objects.get(usuario=self.user)
            
            data['nombre_completo'] = f"{perfil_ipvu.nombre} {perfil_ipvu.apellido}"
            data['rol_id'] = perfil_ipvu.rol.id
            data['requiere_cambio_password'] = perfil_ipvu.requiere_cambio_password
            data['username'] = self.user.username

            
        except Usuario.DoesNotExist:
            pass
            
        return data

class EstablecerPasswordInicialSerializer(serializers.Serializer):
    nueva_password = serializers.CharField(write_only=True)
    confirmar_password = serializers.CharField(write_only=True)
    
    #attrs es diccionario de django que contiene los datos de entrada validados 
    #que vinieron del request
    def validate(self, attrs):
        usuario=self.context["request"].user
        perfil = usuario.usuario

        if not perfil.requiere_cambio_password:
            raise serializers.ValidationError("El usuario no requiere cambio " \
            "de contraseña")
        
        if attrs["nueva_password"] != attrs["confirmar_password"]:
            raise serializers.ValidationError("Las contraseñas no coinciden")
        
        validate_password(attrs["nueva_password"], user=usuario)

        return attrs
    
    

     # **kwargs indica cualquier argumento extra
     
    def save(self, **kwargs):
        usuario = self.context["request"].user
        perfil = usuario.usuario

        usuario.set_password(self.validated_data["nueva_password"])
        usuario.save()

        perfil.requiere_cambio_password = False
        perfil.save(update_fields=["requiere_cambio_password"])

        return usuario
    
# serializador para reset de password en caso de olvidarla

class SolicitarResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ConfirmarResetPasswordSerializer(serializers.Serializer): 
    uid = serializers.CharField()
    token = serializers.CharField()
    nueva_password = serializers.CharField(write_only=True)
    confirmar_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            uid = force_str(urlsafe_base64_decode(attrs['uid']))
            usuario = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError("El link de reset no es válido")

        if not default_token_generator.check_token(usuario, attrs['token']):
            raise serializers.ValidationError("El link de reset no es válido o ha expirado")

        if attrs ['nueva_password'] != attrs['confirmar_password']:
            raise serializers.ValidationError("Las contraseñas no coinciden")

        validate_password(attrs["nueva_password"], user=usuario)
        attrs['usuario'] = usuario


        return attrs 
    
    def save(self, **kwargs):
        usuario = self.validated_data['usuario']
        
        usuario.set_password(self.validated_data["nueva_password"])
        usuario.save()

        if hasattr(usuario, "usuario"):
            perfil = usuario.usuario
            perfil.requiere_cambio_password = False
            perfil.save(update_fields=["requiere_cambio_password"])

        return usuario



