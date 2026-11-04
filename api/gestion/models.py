from django.db import models
from django.contrib.auth.models import User

# Create your models here.
class PostulanteTitular(models.Model):
    nombre = models.CharField (max_length=40)
    apellido = models.CharField (max_length=40)
    telefono = models.CharField (max_length=15)
    dni = models.CharField (max_length=15, unique=True)
    domicilio_actual = models.CharField (max_length=200)
    email = models.EmailField(null=True, blank=True)
    # Usamos DecimalField para la plata, así te permite poner centavos si querés
    ingresos = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    # Un booleano simple para la discapacidad (por defecto arranca en falso)
    tiene_discapacidad = models.BooleanField(default=False)
    #fechas
    fecha_creacion = models.DateTimeField (auto_now_add=True)
    fecha_modificacion = models.DateTimeField (auto_now=True)
    
    def __str__(self):
        return f"{self.nombre} {self.apellido} - DNI: {self.dni}"


class EstadoExpediente(models.Model):
    tipo_estado = [
        ('SINI', 'Sin Iniciar'),
        ('1V', '1ra Visita'),
        ('LEG', 'Legales'),
        ('DOCP', 'Doc Presentada'),
        ('AP', 'Apto'),
        ('NOAP', 'No Apto'),
        ('NUEVAV', 'Nueva Visita'),
    ]
    
    nombre = models.CharField(max_length=10, choices=tipo_estado, unique=True)
    
    def __str__(self):
        #get_FOO_display() muestra el texto legible ("Apto") y no el código ("AP")
        return self.get_nombre_display()
    
    @property
    def color(self):
        # asocia cada codigo a un color
        colores = {
            'SINI': 'gray',       # Sin Iniciar -> Gris
            '1V': 'blue',       # 1ra Visita -> Azul
            'LEG': 'purple',     # Legales -> Morado
            'DOCP': 'teal',       # Doc Presentada -> Turquesa
            'AP': 'green',      # Apto -> Verde
            'NOAP': 'red',        # No Apto -> Rojo
            'NUEVAV': 'orange',     # Nueva Visita -> Naranja
            }
    
    
class Expediente(models.Model):
    #fechas
    fecha_creacion =  models.DateTimeField(auto_now_add=True)
    fecha_limite_ts = models.DateTimeField(null=True, blank=True)
    DDJJ = models.CharField(max_length=50, null=True, blank=True, unique=True) 
    visto = models.BooleanField(default=False)
    #FK
    postulante_titular = models.ForeignKey(PostulanteTitular, on_delete=models.CASCADE)
    usuario_asignado = models.ForeignKey(User, on_delete= models.SET_NULL, null=True)
    estado_expediente = models.ForeignKey(EstadoExpediente, on_delete= models.RESTRICT)
    
    def __str__(self):
        return f"Expediente ID: {self.id}"
    
    class Meta:
        ordering = ['-id']


class Rol(models.Model):
     #django exige dos opciones, una abreviacion y un string legible
     tipo_rol = [('TS','TRABAJADORA SOCIAL'),
        ('SU', 'SUPERUSUARIO'),
        ('LG','LEGALES'),
        ('DE','DATA ENTRY'),]
     descripcion = models.CharField(max_length=100)

     nombre_rol = models.CharField(max_length=2, choices=tipo_rol)
     #para que al seleccionar un rol se muestre el nombre del rol
     def __str__(self):
        return self.get_nombre_rol_display()

class Usuario(models.Model):
    usuario = models.OneToOneField(User, on_delete=models.CASCADE)
    nombre = models.CharField(max_length=50,)
    apellido = models.CharField(max_length=50,)
    matricula = models.CharField(max_length=20, unique=True, null=True, blank=True)
    dni = models.CharField(max_length=15)
    email= models.EmailField(unique=True, null=True, blank=True)
    activo = models.BooleanField(default=True)

    
    #FK
    rol = models.ForeignKey(Rol, on_delete=models.RESTRICT)

    requiere_cambio_password  = models.BooleanField(default=True)
    
    def __str__(self):
        return f"Perfil de: {self.usuario.username} {self.usuario.last_name} - DNI: {self.dni}"


class DocumentoAdjunto(models.Model):
    tipo_documento = models.CharField(max_length=200)
    archivo = models.FileField(upload_to='documentos_expedientes/', null=True, blank=True)
    #FK
    subido_por = models.ForeignKey(User, on_delete=models.RESTRICT, related_name='mis_documentos_subidos')
    expediente = models.ForeignKey(Expediente, on_delete=models.PROTECT, related_name='documentos', null=True, blank=True)
    def __str__(self):
        return f"ID Documento: {self.id}"


    
class HistorialPase(models.Model):
    #FK
    expediente = models.ForeignKey(Expediente, on_delete=models.CASCADE, related_name='historial_pases')
    usuario_origen = models.ForeignKey(User, on_delete=models.RESTRICT, related_name='pases_enviados' )
    usuario_destino = models.ForeignKey(User, on_delete=models.RESTRICT, related_name='pases_recibidos')
    documentos_adjuntos = models.ManyToManyField(DocumentoAdjunto, related_name='historial_pases', blank=True)
    
    observacion = models.TextField(blank=True, null=True)
    
    #fechas
    fecha_envio = models.DateTimeField (auto_now_add=True)

    def __str__(self):
        return f"Exp {self.expediente.id} - De {self.usuario_origen.username} a {self.usuario_destino.username}"

    class Meta:
        ordering = ['-id']

class Notificacion(models.Model):
    mensaje = models.CharField(max_length=200)
    
    #fecha
    fecha_creacion = models.DateTimeField (auto_now_add=True)
     
    leida = models.BooleanField (default=False)
    
    # suario que recibe la notificacion dentro del sistema
    usuario_destino = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notificaciones_recibidas')

    # expediente que origina la notificacion para poder abrir el caso desde la interfa
    expediente_relacionado = models.ForeignKey(Expediente, on_delete=models.SET_NULL, null=True, blank=True)
    
    def __str__(self):
        return f"Notificación para {self.usuario_destino.username}"


class HistorialAccion(models.Model):
    mensaje_accion=models.CharField(max_length=300)

    #fecha
    fecha_accion=models.DateTimeField(auto_now_add=True)

    #fk
    id_usuario_accion=models.ForeignKey("Usuario",on_delete=models.PROTECT)
    id_expediente=models.ForeignKey(Expediente,on_delete=models.PROTECT, null=True, blank=True)

    def __str__(self):
        return f"ID Accion: {self.id}, mensaje: {self.mensaje_accion}"
    
    
class FormularioSocioHabitacional(models.Model): 
    # Campos completados por la Trabajadora Social. Se permiten vacios para que el formulario pueda existir
    # en estado "sin iniciar" o "en progreso" antes de que todos los datos esten cargados.
    grupo_familiar=models.TextField(blank=True)
    situacion_habitacional=models.TextField(blank=True)
    aspecto_economico=models.TextField(blank=True)
    situacion_salud=models.TextField(blank=True)
    nivel_estudios=models.CharField(max_length=100, blank=True)
    relevamiento_vecinal=models.TextField(blank=True)
    observaciones=models.TextField(blank=True)
    # domicilio donde la Trabajadora Social hizo la visita. El microservicio de IA lo compara con el que
    # declaro el titular en la DDJJ. Es opcional y no cuenta para el estado del formulario.
    domicilio_constatado=models.CharField(max_length=200, blank=True)

    # ultimo semaforo de inconsistencias que devolvio la IA, para no volver a calcularlo cada vez que se
    # abre el expediente. Queda viejo si despues se edita el formulario o los datos del titular.
    semaforo_resultado=models.JSONField(null=True, blank=True)
    semaforo_fecha=models.DateTimeField(null=True, blank=True)


    #FK
    expediente = models.ForeignKey(Expediente, on_delete=models.CASCADE)
    #fechas
    fecha_creacion=models.DateTimeField(auto_now_add=True)
    fecha_modificacion=models.DateTimeField(auto_now=True)

    # Lista centralizada de campos que se usan para calcular automaticamente el estado del formulario.
    CAMPOS_DE_ESTADO = [
        'grupo_familiar',
        'situacion_habitacional',
        'aspecto_economico',
        'situacion_salud',
        'nivel_estudios',
        'relevamiento_vecinal',
        'observaciones',
    ]

    @property
    def estado(self):
        # Calcula cuantos campos tienen contenido real, ignorando espacios en blanco.
        campos_completados = sum(
            1
            for campo in self.CAMPOS_DE_ESTADO
            if str(getattr(self, campo, '') or '').strip()
        )

        # Si no hay ningun campo cargado, el formulario todavia no fue iniciado.
        if campos_completados == 0:
            return 'sin iniciar'

        # Si todos los campos estan cargados, el formulario esta completo.
        if campos_completados == len(self.CAMPOS_DE_ESTADO):
            return 'completado'

        # Si tiene al menos un campo cargado pero no todos, sigue en progreso.
        return 'en progreso'

    def __str__(self):
      return (
        f"Grupo Familiar: {self.grupo_familiar},\n "
        f"Situacion Habitacional: {self.situacion_habitacional}, \n"
        f"Aspecto Economico: {self.aspecto_economico},\n "
        f"Situacion Salud: {self.situacion_salud}, \n  "
        f"Nivel Estudios: {self.nivel_estudios},\n "
        f"Relevamiento Vecinal: {self.relevamiento_vecinal},\n "
        f"Observaciones: {self.observaciones}"
    )
