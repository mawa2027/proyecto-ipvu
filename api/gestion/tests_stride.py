"""
Pruebas de seguridad organizadas segun STRIDE:

  S - Spoofing (suplantacion)              -> SpoofingTests
  T - Tampering (alteracion de datos)      -> TamperingTests
  R - Repudiation (negar haber hecho algo) -> RepudiationTests
  I - Information disclosure (filtracion)  -> InformationDisclosureTests
  D - Denial of service                    -> DenialOfServiceTests
  E - Elevation of privilege               -> ElevationOfPrivilegeTests

Regla de acceso que prueban: cada usuario (TS, LG, DE) solo ve y toca los expedientes que tiene en su poder;
al hacer un pase deja de verlo. Solo el superadmin ve todo y solo el ve la auditoria.
"""
import re
from datetime import timedelta

import jwt
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from .models import (
    DocumentoAdjunto, EstadoExpediente, Expediente, FormularioSocioHabitacional, HistorialAccion,
    HistorialPase, Notificacion, PostulanteTitular,
)
from .tests import SeguridadBaseTestCase

PASSWORD = 'ClaveSegura123!'


class StrideBaseTestCase(SeguridadBaseTestCase):
    """
    Escenario: dos trabajadoras sociales, cada una con su expediente (con un documento y un formulario),
    mas un data entry, un usuario de legales y un superadmin.
    """

    def setUp(self):
        super().setUp()
        self.su = self.crear_usuario('admin', 'SU')
        self.lg = self.crear_usuario('legales', 'LG')
        self.ts1 = self.crear_usuario('ts1', 'TS')
        self.ts2 = self.crear_usuario('ts2', 'TS')

        self.estado_sini = EstadoExpediente.objects.get(nombre='SINI')
        EstadoExpediente.objects.create(nombre='AP')

        self.exp_ts1 = self.crear_expediente('20111111', self.ts1)
        self.exp_ts2 = self.crear_expediente('20222222', self.ts2)

        self.doc_ts1 = DocumentoAdjunto.objects.create(
            tipo_documento='DNI', subido_por=self.ts1, expediente=self.exp_ts1,
            archivo=SimpleUploadedFile('dni_ts1.pdf', b'%PDF-1.4 privado de ts1'),
        )
        self.form_ts1 = FormularioSocioHabitacional.objects.create(expediente=self.exp_ts1, grupo_familiar='4 personas')
        self.pase_ts1 = HistorialPase.objects.create(
            expediente=self.exp_ts1, usuario_origen=self.su, usuario_destino=self.ts1, observacion='Asignado',
        )

    def crear_expediente(self, dni, asignado):
        postulante = PostulanteTitular.objects.create(
            nombre='Postulante', apellido=dni, telefono='385', dni=dni, domicilio_actual='Calle',
        )
        return Expediente.objects.create(
            postulante_titular=postulante, estado_expediente=self.estado_sini, usuario_asignado=asignado,
        )

    def como(self, user):
        self.client.force_authenticate(user)
        return self.client

    def con_token(self, token):
        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return self.client


# ---------------------------------------------------------------------------
# S - Spoofing: hacerse pasar por otro usuario
# ---------------------------------------------------------------------------
class SpoofingTests(StrideBaseTestCase):

    def test_token_firmado_con_otra_clave_es_rechazado(self):
        payload = dict(AccessToken.for_user(self.su).payload)
        falso = jwt.encode(payload, 'clave-del-atacante-de-al-menos-32-bytes', algorithm='HS256')
        self.assertEqual(self.con_token(falso).get('/api/usuario/').status_code, 401)

    def test_token_sin_firma_alg_none_es_rechazado(self):
        payload = dict(AccessToken.for_user(self.su).payload)
        falso = jwt.encode(payload, None, algorithm='none')
        self.assertEqual(self.con_token(falso).get('/api/usuario/').status_code, 401)

    def test_token_con_user_id_cambiado_es_rechazado(self):
        # el atacante toma su propio token y le cambia el user_id por el del superadmin
        token = str(AccessToken.for_user(self.ts1))
        cabecera, cuerpo, firma = token.split('.')
        payload = jwt.decode(token, options={'verify_signature': False})
        payload['user_id'] = str(self.su.id)
        cuerpo_falso = jwt.encode(payload, 'x' * 32, algorithm='HS256').split('.')[1]
        self.assertEqual(self.con_token(f'{cabecera}.{cuerpo_falso}.{firma}').get('/api/usuario/').status_code, 401)

    def test_token_vencido_es_rechazado(self):
        token = AccessToken.for_user(self.ts1)
        token.set_exp(lifetime=-timedelta(seconds=1))
        self.assertEqual(self.con_token(str(token)).get('/api/expediente/').status_code, 401)

    def test_refresh_no_sirve_como_token_de_acceso(self):
        refresh = RefreshToken.for_user(self.ts1)
        self.assertEqual(self.con_token(str(refresh)).get('/api/expediente/').status_code, 401)

    def test_usuario_dado_de_baja_no_puede_loguearse(self):
        self.como(self.su).delete(f'/api/usuario/{self.ts1.usuario.id}/')
        self.client.force_authenticate(None)
        response = self.client.post('/api/login/', {'username': 'ts1', 'password': PASSWORD})
        self.assertEqual(response.status_code, 401)

    def test_usuario_dado_de_baja_pierde_el_token_que_ya_tenia(self):
        token = str(AccessToken.for_user(self.ts1))
        self.como(self.su).delete(f'/api/usuario/{self.ts1.usuario.id}/')
        self.assertEqual(self.con_token(token).get('/api/expediente/').status_code, 401)

    def test_usuario_nuevo_no_accede_a_datos_hasta_cambiar_la_password_inicial(self):
        # la password inicial es el DNI: quien conozca el DNI no puede usar la cuenta hasta que se cambie
        nuevo = self.crear_usuario('nuevo', 'TS', requiere_cambio_password=True)
        self.assertEqual(self.como(nuevo).get('/api/expediente/').status_code, 403)

        response = self.client.post('/api/establecer-password-inicial/', {
            'nueva_password': 'OtraClaveSegura456!', 'confirmar_password': 'OtraClaveSegura456!',
        })
        self.assertEqual(response.status_code, 200)
        nuevo.refresh_from_db()
        self.assertEqual(self.como(nuevo).get('/api/expediente/').status_code, 200)

    def test_usuario_creado_por_el_admin_arranca_con_cambio_de_password_obligatorio(self):
        from .models import Rol
        response = self.como(self.su).post('/api/usuario/', {
            'nombre': 'Nueva', 'apellido': 'TS', 'dni': '40123456', 'email': 'nueva@ipvu.test',
            'rol': Rol.objects.get(nombre_rol='TS').id, 'requiere_cambio_password': False,
        })
        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.get(username='40123456').usuario.requiere_cambio_password)

    def test_link_de_reseteo_no_se_puede_reusar(self):
        uid = urlsafe_base64_encode(force_bytes(self.ts1.pk))
        token = default_token_generator.make_token(self.ts1)
        datos = {'uid': uid, 'token': token,
                 'nueva_password': 'NuevaClave789!x', 'confirmar_password': 'NuevaClave789!x'}

        self.assertEqual(self.client.post('/api/password-reset/confirmar/', datos).status_code, 200)
        datos.update(nueva_password='OtraMas789!xy', confirmar_password='OtraMas789!xy')
        self.assertEqual(self.client.post('/api/password-reset/confirmar/', datos).status_code, 400)

    def test_link_de_reseteo_de_otro_usuario_no_sirve(self):
        # token valido de ts2 usado con el uid de ts1
        datos = {
            'uid': urlsafe_base64_encode(force_bytes(self.ts1.pk)),
            'token': default_token_generator.make_token(self.ts2),
            'nueva_password': 'NuevaClave789!x', 'confirmar_password': 'NuevaClave789!x',
        }
        self.assertEqual(self.client.post('/api/password-reset/confirmar/', datos).status_code, 400)


# ---------------------------------------------------------------------------
# T - Tampering: modificar datos que no corresponde
# ---------------------------------------------------------------------------
class TamperingTests(StrideBaseTestCase):

    def test_solo_el_superadmin_modifica_el_catalogo_de_estados(self):
        url = f'/api/estadoexpediente/{self.estado_sini.id}/'
        for user in [self.ts1, self.user_de, self.lg]:
            with self.subTest(user=user.username):
                self.assertEqual(self.como(user).patch(url, {'nombre': 'AP'}).status_code, 403)
        self.estado_sini.refresh_from_db()
        self.assertEqual(self.estado_sini.nombre, 'SINI')

    def test_no_se_puede_falsificar_quien_envia_un_pase(self):
        self.como(self.ts1).post('/api/historialpase/', {
            'expediente': self.exp_ts1.id, 'usuario_destino': self.lg.id, 'usuario_origen': self.su.id,
        })
        self.assertEqual(HistorialPase.objects.latest('id').usuario_origen, self.ts1)

    def test_no_se_puede_falsificar_quien_sube_un_documento(self):
        self.como(self.ts1).post('/api/documentoadjunto/', {
            'expediente': self.exp_ts1.id, 'tipo_documento': 'x', 'subido_por': self.su.id,
            'archivo': SimpleUploadedFile('a.pdf', b'%PDF'),
        }, format='multipart')
        self.assertEqual(DocumentoAdjunto.objects.latest('id').subido_por, self.ts1)

    def test_el_estado_solo_cambia_por_cambiar_estado(self):
        exp_de = self.crear_expediente('20333333', self.user_de)
        estado_ap = EstadoExpediente.objects.get(nombre='AP')
        self.como(self.user_de).patch(f'/api/expediente/{exp_de.id}/', {'estado_expediente_id': estado_ap.id})
        exp_de.refresh_from_db()
        self.assertEqual(exp_de.estado_expediente, self.estado_sini)

    def test_no_se_puede_reasignar_un_expediente_por_update(self):
        exp_de = self.crear_expediente('20444444', self.user_de)
        self.como(self.user_de).patch(f'/api/expediente/{exp_de.id}/', {'usuario_asignado': self.ts2.id})
        exp_de.refresh_from_db()
        self.assertEqual(exp_de.usuario_asignado, self.user_de)

    def test_un_pase_no_puede_llevar_documentos_de_otro_expediente(self):
        doc_ts2 = DocumentoAdjunto.objects.create(
            tipo_documento='x', subido_por=self.ts2, expediente=self.exp_ts2,
            archivo=SimpleUploadedFile('b.pdf', b'%PDF'),
        )
        response = self.como(self.ts1).post('/api/historialpase/', {
            'expediente': self.exp_ts1.id, 'usuario_destino': self.lg.id, 'documentos_adjuntos': [doc_ts2.id],
        })
        self.assertEqual(response.status_code, 400)

    def test_cambiar_estado_solo_acepta_estados_finales(self):
        exp_de = self.crear_expediente('20555555', self.user_de)
        response = self.como(self.user_de).patch(f'/api/expediente/{exp_de.id}/cambiar_estado/', {'estado': 'SINI'})
        self.assertEqual(response.status_code, 400)

    def test_no_se_puede_hacer_un_pase_de_un_expediente_ajeno(self):
        # cualquier rol crea pases de cualquier expediente y se lo puede reasignar
        response = self.como(self.ts2).post('/api/historialpase/', {
            'expediente': self.exp_ts1.id, 'usuario_destino': self.ts2.id,
        })
        self.assertIn(response.status_code, (403, 404))
        self.exp_ts1.refresh_from_db()
        self.assertEqual(self.exp_ts1.usuario_asignado, self.ts1)

    def test_no_se_puede_borrar_un_documento_de_un_expediente_ajeno(self):
        # cualquier rol borra adjuntos de cualquier expediente
        response = self.como(self.ts2).delete(f'/api/documentoadjunto/{self.doc_ts1.id}/')
        self.assertIn(response.status_code, (403, 404))
        self.assertTrue(DocumentoAdjunto.objects.filter(id=self.doc_ts1.id).exists())

    def test_no_se_puede_editar_el_formulario_de_un_expediente_ajeno(self):
        # cualquier TS edita el informe socio-habitacional de cualquier expediente
        response = self.como(self.ts2).patch(f'/api/formulario/{self.form_ts1.id}/', {'grupo_familiar': 'alterado'})
        self.assertIn(response.status_code, (403, 404))

    def test_no_se_puede_subir_un_documento_a_un_expediente_ajeno(self):
        # cualquier rol adjunta archivos a cualquier expediente
        response = self.como(self.ts2).post('/api/documentoadjunto/', {
            'expediente': self.exp_ts1.id, 'tipo_documento': 'x', 'archivo': SimpleUploadedFile('c.pdf', b'%PDF'),
        }, format='multipart')
        self.assertIn(response.status_code, (400, 403, 404))


# ---------------------------------------------------------------------------
# R - Repudiation: que nadie pueda negar lo que hizo
# ---------------------------------------------------------------------------
class RepudiationTests(StrideBaseTestCase):

    def ultima_accion(self):
        return HistorialAccion.objects.latest('id')

    def test_la_auditoria_no_se_puede_modificar_ni_borrar_por_la_api(self):
        accion = HistorialAccion.objects.create(id_usuario_accion=self.ts1.usuario, mensaje_accion='original')
        cliente = self.como(self.su)
        url = f'/api/historialaccion/{accion.id}/'
        self.assertEqual(cliente.post('/api/historialaccion/', {'mensaje_accion': 'falsa'}).status_code, 405)
        self.assertEqual(cliente.patch(url, {'mensaje_accion': 'editada'}).status_code, 405)
        self.assertEqual(cliente.delete(url).status_code, 405)
        accion.refresh_from_db()
        self.assertEqual(accion.mensaje_accion, 'original')

    def test_el_login_queda_registrado(self):
        self.client.post('/api/login/', {'username': 'ts1', 'password': PASSWORD})
        self.assertEqual(self.ultima_accion().id_usuario_accion, self.ts1.usuario)
        self.assertIn('Login', self.ultima_accion().mensaje_accion)

    def test_subir_y_borrar_un_documento_queda_registrado(self):
        cliente = self.como(self.ts1)
        response = cliente.post('/api/documentoadjunto/', {
            'expediente': self.exp_ts1.id, 'tipo_documento': 'x', 'archivo': SimpleUploadedFile('d.pdf', b'%PDF'),
        }, format='multipart')
        self.assertIn('UPLOAD', self.ultima_accion().mensaje_accion)

        cliente.delete(f"/api/documentoadjunto/{response.data['id']}/")
        self.assertIn('Borrar documento', self.ultima_accion().mensaje_accion)
        self.assertEqual(self.ultima_accion().id_usuario_accion, self.ts1.usuario)

    def test_la_descarga_queda_registrada(self):
        self.como(self.ts1).get(f'/api/documentoadjunto/{self.doc_ts1.id}/descargar/')
        self.assertIn('DOWNLOAD', self.ultima_accion().mensaje_accion)
        self.assertEqual(self.ultima_accion().id_usuario_accion, self.ts1.usuario)

    def test_ver_un_expediente_queda_registrado(self):
        self.como(self.ts1).get(f'/api/expediente/{self.exp_ts1.id}/')
        self.assertEqual(self.ultima_accion().id_expediente, self.exp_ts1)

    def test_el_cambio_de_estado_queda_registrado(self):
        exp_de = self.crear_expediente('20666666', self.user_de)
        self.como(self.user_de).patch(f'/api/expediente/{exp_de.id}/cambiar_estado/', {'estado': 'AP'})
        accion = self.ultima_accion()
        self.assertEqual(accion.id_expediente, exp_de)
        self.assertIn('Cambio de estado', accion.mensaje_accion)

    def test_la_baja_de_un_usuario_queda_registrada(self):
        self.como(self.su).delete(f'/api/usuario/{self.ts2.usuario.id}/')
        self.assertIn('Dio de baja', self.ultima_accion().mensaje_accion)
        self.assertEqual(self.ultima_accion().id_usuario_accion, self.su.usuario)

    def test_la_baja_es_logica_y_no_borra_la_historia(self):
        self.como(self.su).delete(f'/api/usuario/{self.ts1.usuario.id}/')
        self.assertTrue(User.objects.filter(id=self.ts1.id).exists())
        self.assertTrue(HistorialPase.objects.filter(id=self.pase_ts1.id).exists())


# ---------------------------------------------------------------------------
# I - Information disclosure: ver datos que no corresponde
# ---------------------------------------------------------------------------
class InformationDisclosureTests(StrideBaseTestCase):

    def test_solo_el_superadmin_ve_la_auditoria(self):
        for user in [self.ts1, self.user_de, self.lg]:
            with self.subTest(user=user.username):
                self.assertEqual(self.como(user).get('/api/historialaccion/').status_code, 403)
                self.assertEqual(self.como(user).get('/api/usuario/auditoria_usuarios/').status_code, 403)
        self.assertEqual(self.como(self.su).get('/api/historialaccion/').status_code, 200)
        self.assertEqual(self.como(self.su).get('/api/usuario/auditoria_usuarios/').status_code, 200)

    def test_una_ts_no_ve_expedientes_ajenos(self):
        cliente = self.como(self.ts2)
        self.assertEqual(cliente.get(f'/api/expediente/{self.exp_ts1.id}/').status_code, 404)
        ids = [exp['id'] for exp in cliente.get('/api/expediente/').data]
        self.assertEqual(ids, [self.exp_ts2.id])

    def test_nadie_ve_notificaciones_ajenas(self):
        notif = Notificacion.objects.create(mensaje='privada', usuario_destino=self.ts1, expediente_relacionado=self.exp_ts1)
        cliente = self.como(self.ts2)
        self.assertEqual(cliente.get(f'/api/notificacion/{notif.id}/').status_code, 404)
        self.assertEqual(cliente.patch(f'/api/notificacion/{notif.id}/marcar-leida/').status_code, 404)

    def test_la_api_de_usuarios_no_expone_passwords(self):
        data = self.como(self.su).get('/api/usuario/').data
        for perfil in data:
            self.assertNotIn('password', perfil)
        self.assertNotIn('pbkdf2', str(data))

    def test_el_reseteo_no_revela_si_el_email_existe(self):
        existe = self.client.post('/api/password-reset/solicitar/', {'email': 'ts1@ipvu.test'})
        no_existe = self.client.post('/api/password-reset/solicitar/', {'email': 'nadie@ipvu.test'})
        self.assertEqual((existe.status_code, existe.data), (no_existe.status_code, no_existe.data))

    def test_el_mail_de_reseteo_va_solo_al_dueno_de_la_cuenta(self):
        self.client.post('/api/password-reset/solicitar/', {'email': 'ts1@ipvu.test'})
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['ts1@ipvu.test'])
        self.assertTrue(re.search(r'/reset-password/[^/]+/[^/]+/', mail.outbox[0].body))

    def test_el_login_no_revela_si_el_usuario_existe(self):
        mal_password = self.client.post('/api/login/', {'username': 'ts1', 'password': 'incorrecta'})
        no_existe = self.client.post('/api/login/', {'username': 'fantasma', 'password': 'incorrecta'})
        self.assertEqual((mal_password.status_code, mal_password.data), (no_existe.status_code, no_existe.data))

    def test_los_errores_de_auditoria_no_devuelven_el_traceback(self):
        from unittest.mock import patch
        with patch('gestion.views.Count', side_effect=RuntimeError('detalle interno')):
            response = self.como(self.su).get('/api/usuario/auditoria_usuarios/')
        self.assertEqual(response.status_code, 500)
        self.assertNotIn('Traceback', str(response.data))
        self.assertNotIn('detalle interno', str(response.data))

    def test_el_backend_no_sirve_el_repositorio_ni_archivos_de_configuracion(self):
        # git-dumper y similares prueban estas rutas para bajarse el codigo y el historial (con claves viejas)
        for ruta in ['/.git/HEAD', '/.git/config', '/.env', '/api/.env', '/manage.py',
                     '/ipvu_backend/settings.py', '/gestion/models.py', '/requirements.txt']:
            with self.subTest(ruta=ruta):
                self.assertEqual(self.client.get(ruta).status_code, 404)

    def test_la_clave_secreta_de_desarrollo_no_se_usa_en_produccion(self):
        # recordatorio para el deploy: con la SECRET_KEY por defecto cualquiera puede firmar tokens
        if not settings.DEBUG and settings.SECRET_KEY == 'your secret key':
            self.skipTest('SECRET_KEY de desarrollo: en el servidor definir SECRET_KEY (ver SEGURIDAD_DEPLOY.md)')

    def test_una_ts_no_descarga_documentos_de_expedientes_ajenos(self):
        # el endpoint de descarga pide login y rol, pero no que el expediente sea suyo
        self.assertIn(self.como(self.ts2).get(f'/api/documentoadjunto/{self.doc_ts1.id}/descargar/').status_code, (403, 404))

    def test_una_ts_no_lista_documentos_de_expedientes_ajenos(self):
        data = self.como(self.ts2).get('/api/documentoadjunto/').data
        self.assertNotIn(self.doc_ts1.id, [doc['id'] for doc in data])

    def test_una_ts_no_ve_postulantes_ajenos(self):
        # /api/postulantetitular/ devuelve DNI, ingresos y domicilio de todos
        response = self.como(self.ts2).get(f'/api/postulantetitular/{self.exp_ts1.postulante_titular.id}/')
        self.assertEqual(response.status_code, 404)

    def test_una_ts_no_ve_formularios_ajenos(self):
        # el informe socio-habitacional (salud, economia) de cualquier expediente
        self.assertEqual(self.como(self.ts2).get(f'/api/formulario/{self.form_ts1.id}/').status_code, 404)

    def test_una_ts_no_ve_pases_de_expedientes_ajenos(self):
        self.assertEqual(self.como(self.ts2).get(f'/api/historialpase/{self.pase_ts1.id}/').status_code, 404)

    def test_legales_solo_ve_lo_que_tiene_asignado(self):
        exp_lg = self.crear_expediente('20888888', self.lg)
        cliente = self.como(self.lg)
        self.assertEqual([exp['id'] for exp in cliente.get('/api/expediente/').data], [exp_lg.id])
        self.assertEqual(cliente.get(f'/api/expediente/{self.exp_ts1.id}/').status_code, 404)
        self.assertEqual(cliente.get(f'/api/documentoadjunto/{self.doc_ts1.id}/descargar/').status_code, 404)

    def test_el_superadmin_ve_todo(self):
        cliente = self.como(self.su)
        self.assertEqual(cliente.get(f'/api/expediente/{self.exp_ts1.id}/').status_code, 200)
        self.assertEqual(cliente.get(f'/api/documentoadjunto/{self.doc_ts1.id}/descargar/').status_code, 200)
        self.assertEqual(cliente.get(f'/api/formulario/{self.form_ts1.id}/').status_code, 200)
        self.assertEqual(cliente.get(f'/api/historialpase/{self.pase_ts1.id}/').status_code, 200)

    def test_al_pasar_un_expediente_la_ts_deja_de_verlo(self):
        cliente = self.como(self.ts1)
        response = cliente.post('/api/historialpase/', {'expediente': self.exp_ts1.id, 'usuario_destino': self.lg.id})
        self.assertEqual(response.status_code, 201)

        self.assertEqual(cliente.get(f'/api/expediente/{self.exp_ts1.id}/').status_code, 404)
        self.assertEqual(cliente.get(f'/api/documentoadjunto/{self.doc_ts1.id}/descargar/').status_code, 404)
        self.assertEqual(cliente.get(f'/api/formulario/{self.form_ts1.id}/').status_code, 404)
        self.assertEqual(cliente.get(f'/api/historialpase/?expediente={self.exp_ts1.id}').data, [])
        # y quien lo recibe ahora si lo ve
        self.assertEqual(self.como(self.lg).get(f'/api/expediente/{self.exp_ts1.id}/').status_code, 200)

    def test_data_entry_sigue_pudiendo_cargar_postulantes_nuevos(self):
        response = self.como(self.user_de).post('/api/postulantetitular/', {
            'nombre': 'Nuevo', 'apellido': 'Postulante', 'telefono': '385', 'dni': '45000000',
            'domicilio_actual': 'Calle 2', 'ddjj': 'DDJJ-1',
        })
        self.assertEqual(response.status_code, 201)


# ---------------------------------------------------------------------------
# D - Denial of service: abusar del sistema para tumbarlo o bloquear cuentas
# ---------------------------------------------------------------------------
class DenialOfServiceTests(StrideBaseTestCase):

    def test_el_login_limita_los_intentos(self):
        for _ in range(5):
            self.client.post('/api/login/', {'username': 'ts1', 'password': 'incorrecta'})
        response = self.client.post('/api/login/', {'username': 'ts1', 'password': PASSWORD})
        self.assertEqual(response.status_code, 429)

    def test_el_reseteo_de_password_limita_los_intentos(self):
        for _ in range(3):
            self.client.post('/api/password-reset/solicitar/', {'email': 'ts1@ipvu.test'})
        response = self.client.post('/api/password-reset/solicitar/', {'email': 'ts1@ipvu.test'})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(len(mail.outbox), 3)

    def test_el_refresh_limita_los_intentos(self):
        for _ in range(20):
            self.client.post('/api/token/refresh/', {'refresh': 'invalido'})
        self.assertEqual(self.client.post('/api/token/refresh/', {'refresh': 'invalido'}).status_code, 429)

    def test_no_se_aceptan_adjuntos_enormes(self):
        grande = SimpleUploadedFile('grande.pdf', b'0' * (10 * 1024 * 1024 + 1))
        response = self.como(self.ts1).post('/api/documentoadjunto/', {
            'expediente': self.exp_ts1.id, 'tipo_documento': 'x', 'archivo': grande,
        }, format='multipart')
        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------------------
# E - Elevation of privilege: hacer cosas de un rol que no se tiene
# ---------------------------------------------------------------------------
class ElevationOfPrivilegeTests(StrideBaseTestCase):

    def test_solo_el_superadmin_administra_usuarios(self):
        from .models import Rol
        rol_su = Rol.objects.get(nombre_rol='SU')
        for user in [self.ts1, self.user_de, self.lg]:
            with self.subTest(user=user.username):
                cliente = self.como(user)
                self.assertEqual(cliente.post('/api/usuario/', {
                    'nombre': 'x', 'apellido': 'x', 'dni': '999', 'rol': rol_su.id,
                }).status_code, 403)
                self.assertEqual(cliente.delete(f'/api/usuario/{self.ts2.usuario.id}/').status_code, 403)

    def test_nadie_se_sube_su_propio_rol(self):
        from .models import Rol
        rol_su = Rol.objects.get(nombre_rol='SU')
        response = self.como(self.ts1).patch(f'/api/usuario/{self.ts1.usuario.id}/', {'rol': rol_su.id})
        self.assertEqual(response.status_code, 403)
        self.ts1.usuario.refresh_from_db()
        self.assertEqual(self.ts1.usuario.rol.nombre_rol, 'TS')

    def test_nadie_reactiva_su_cuenta_dada_de_baja(self):
        self.como(self.su).delete(f'/api/usuario/{self.ts1.usuario.id}/')
        response = self.como(self.ts1).patch(f'/api/usuario/{self.ts1.usuario.id}/', {'activo': True})
        self.assertEqual(response.status_code, 403)

    def test_solo_el_superadmin_borra_expedientes(self):
        exp_de = self.crear_expediente('20777777', self.user_de)
        self.assertEqual(self.como(self.ts1).delete(f'/api/expediente/{self.exp_ts1.id}/').status_code, 403)
        self.assertEqual(self.como(self.user_de).delete(f'/api/expediente/{exp_de.id}/').status_code, 403)

    def test_solo_data_entry_crea_expedientes(self):
        for user in [self.ts1, self.lg]:
            with self.subTest(user=user.username):
                self.assertEqual(self.como(user).post('/api/postulantetitular/', {}).status_code, 403)
                self.assertEqual(self.como(user).post('/api/expediente/', {}).status_code, 403)

    def test_todos_los_roles_ponen_apto_no_apto_en_sus_expedientes(self):
        for user in [self.ts1, self.lg, self.user_de]:
            with self.subTest(user=user.username):
                expediente = self.crear_expediente(f'3{user.id:07d}', user)
                response = self.como(user).patch(f'/api/expediente/{expediente.id}/cambiar_estado/', {'estado': 'AP'})
                self.assertEqual(response.status_code, 200)

    def test_nadie_cambia_el_estado_de_un_expediente_ajeno(self):
        for user in [self.ts2, self.lg, self.user_de]:
            with self.subTest(user=user.username):
                response = self.como(user).patch(f'/api/expediente/{self.exp_ts1.id}/cambiar_estado/', {'estado': 'AP'})
                self.assertEqual(response.status_code, 404)
        self.exp_ts1.refresh_from_db()
        self.assertEqual(self.exp_ts1.estado_expediente, self.estado_sini)

    def test_solo_la_trabajadora_social_carga_el_informe(self):
        for user in [self.user_de, self.lg]:
            with self.subTest(user=user.username):
                response = self.como(user).post('/api/formulario/', {'expediente': self.exp_ts1.id})
                self.assertEqual(response.status_code, 403)

    def test_solo_el_superadmin_crea_notificaciones(self):
        response = self.como(self.ts1).post('/api/notificacion/', {'mensaje': 'x', 'usuario_destino': self.ts2.id})
        self.assertEqual(response.status_code, 403)

    def test_solo_data_entry_y_admin_usan_el_microservicio_de_ia(self):
        response = self.como(self.ts1).post('/api/procesar-documento/', {}, format='multipart')
        self.assertEqual(response.status_code, 403)

    def test_un_superusuario_de_django_sin_perfil_no_entra_a_la_api(self):
        root = User.objects.create_superuser('root', password=PASSWORD)
        self.assertEqual(self.como(root).get('/api/usuario/').status_code, 403)
