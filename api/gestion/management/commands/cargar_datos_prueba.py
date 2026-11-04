from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from gestion.models import Rol, Usuario, PostulanteTitular, EstadoExpediente, Expediente

class Command(BaseCommand):
    help = 'Carga datos de prueba para el sistema IPVU'

    def handle(self, *args, **kwargs):
        
        # 1. Crear roles si no existen
        roles = [('TS', 'Trabajador Social'), ('SU', 'Super Usuario'), ('LG', 'Legales'), ('DE', 'Data Entry')]
        for nombre, desc in roles:
            Rol.objects.get_or_create(nombre_rol=nombre, defaults={'descripcion': desc})
        self.stdout.write('Roles creados')

        # 2. Crear usuarios
        usuarios_data = [
            ('trabajador1', 'TS', 'Sofia', 'Gomez', '11111111', 'MAT-001'),
            ('trabajador2', 'TS', 'Lucia', 'Dominguez', '12341234', 'MAT-002'),
            ('trabajador3', 'TS', 'Lourdes', 'Lopez', '43214321', 'MAT-003'),
            ('legales1', 'LG', 'Martin', 'Lopez', '22222222', 'MAT-004'),
            ('admin1', 'SU', 'Carlos', 'Perez', '33333333', 'MAT-005'),
            ('dataentry1', 'DE', 'Laura', 'Diaz', '44444444', 'MAT-006'),
        ]
        
        for username, rol_nombre, nombre, apellido, dni, matricula in usuarios_data:
            if not User.objects.filter(username=username).exists():
                user = User.objects.create_user(username=username, password=dni)
                rol = Rol.objects.get(nombre_rol=rol_nombre)
                Usuario.objects.create(
                    usuario=user,
                    nombre=nombre,
                    apellido=apellido,
                    dni=dni,
                    matricula=matricula,
                    rol=rol
                )
        self.stdout.write('Usuarios creados')

        # 3. Crear postulantes
        postulantes_data = [
            ('Juan', 'Rodriguez', '55555555', '3814000001', 'Av. Belgrano 123'),
            ('Maria', 'Gonzalez', '66666666', '3814000002', 'Av. Libertad 456'),
            ('Pedro', 'Martinez', '77777777', '3814000003', 'Calle 9 de Julio 789'),
            ('Lucas', 'Diaz', '88888888', '3814000002', 'Av. Libertad 456'),
            ('Nico', 'Paz', '99999999', '3814000002', 'Av. Libertad 456')
        ]
        
        postulantes = []
        for nombre, apellido, dni, tel, dom in postulantes_data:
            p, _ = PostulanteTitular.objects.get_or_create(
                dni=dni,
                defaults={
                    'nombre': nombre,
                    'apellido': apellido,
                    'telefono': tel,
                    'domicilio_actual': dom
                }
            )
            postulantes.append(p)
        self.stdout.write('Postulantes creados')

        # 4. Crear expedientes
        estado_inicial = EstadoExpediente.objects.get(nombre='SINI')
        ts_user = User.objects.get(username='trabajador1')
        
        ddjjs = ['EXP-2024-001', 'EXP-2024-002', 'EXP-2024-003', 'EXP-2024-004', 'EXP-2024-005']
        for i, postulante in enumerate(postulantes):
            Expediente.objects.get_or_create(
                DDJJ=ddjjs[i],
                defaults={
                    'postulante_titular': postulante,
                    'usuario_asignado': ts_user,
                    'estado_expediente': estado_inicial
                }
            )
        self.stdout.write('Expedientes creados')
        
        self.stdout.write(self.style.SUCCESS('Datos de prueba cargados correctamente'))