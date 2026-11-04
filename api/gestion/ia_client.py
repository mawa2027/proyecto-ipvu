"""
Cliente del microservicio de IA (FastAPI). Tiene dos funciones:
- autocompletar_ddjj: extrae los datos de una DDJJ escaneada o en PDF (fase 1).
- evaluar_semaforo: coteja la DDJJ con el informe socio-habitacional y devuelve el semaforo (fase 2).

Django hace de intermediario: el frontend nunca habla directo con el microservicio.
Aca tambien se traduce la respuesta del microservicio a los nombres de campo de nuestro formulario,
asi un cambio de formato del lado de IA se corrige en un solo lugar.
"""
import logging
import re
from datetime import datetime

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# formatos en los que puede llegar la fecha de inscripcion (el de hoy es dd/mm/aaaa)
FORMATOS_FECHA = ('%Y/%m/%d', '%d/%m/%Y', '%d/%m/%y')

SEMAFOROS = ('VERDE', 'AMARILLO', 'ROJO')


class IAServiceError(Exception):
    """El microservicio respondio con un error interno o con datos que no se pueden usar."""


class IAServiceRejected(IAServiceError):
    """El microservicio rechazo el archivo (formato invalido, archivo vacio, etc.)."""


class IAServiceUnavailable(IAServiceError):
    """El microservicio no responde: esta apagado, no hay red o tardo demasiado."""


def autocompletar_ddjj(archivo):
    """
    Envia el archivo al endpoint /autocompletar-ddjj y devuelve los datos con los nombres
    de campo de nuestro formulario de nuevo expediente.
    """
    archivo.seek(0)
    files = {'archivo': (archivo.name, archivo.read(), archivo.content_type or 'application/octet-stream')}

    datos = _post('/autocompletar-ddjj', files=files, mensaje_rechazo='El servicio de IA rechazó el archivo.')
    return normalizar_datos_ddjj(datos)


def evaluar_semaforo(expediente, formulario):
    """
    Envia los datos de la DDJJ (titular y expediente) y del informe socio-habitacional al endpoint
    /evaluar-semaforo, que los coteja y devuelve el semaforo (VERDE, AMARILLO o ROJO) con las
    inconsistencias encontradas.
    """
    payload = armar_peticion_semaforo(expediente, formulario)
    datos = _post('/evaluar-semaforo', json=payload,
                  mensaje_rechazo='El servicio de IA rechazó los datos del expediente.')
    return normalizar_semaforo(datos)


def armar_peticion_semaforo(expediente, formulario):
    """Traduce nuestros modelos al formato PeticionSemaforo que espera el microservicio."""
    titular = expediente.postulante_titular
    return {
        'id_tramite': str(expediente.id),
        'datos_ddjj': {
            'numero_ddjj': _texto(expediente.DDJJ),
            'nombre': _texto(titular.nombre),
            'apellido': _texto(titular.apellido),
            'dni_titular': _texto(titular.dni),
            'telefono': _texto(titular.telefono),
            'domicilio_actual': _texto(titular.domicilio_actual),
            'email': _texto(titular.email),
            'discapacidad': 'Sí' if titular.tiene_discapacidad else 'No',
            'fecha_inscripcion': None,
        },
        'datos_informe': {
            'profesional_actuante': _profesional(expediente),
            'caso_referencia': f'Expediente N° {expediente.id}',
            # el formulario no tiene su propio DJ N°: muestra el del expediente
            'dj_n': _texto(expediente.DDJJ),
            # vacio va como None: asi el microservicio no lo cuenta como domicilio distinto
            'domicilio': _texto(formulario.domicilio_constatado),
            'grupo_familiar_constituyente': _texto(formulario.grupo_familiar),
            'situacion_habitacional': _texto(formulario.situacion_habitacional),
            'aspecto_economico': _texto(formulario.aspecto_economico),
            'situacion_de_salud': _texto(formulario.situacion_salud),
            'nivel_de_estudios': _texto(formulario.nivel_estudios),
            'relevamiento_vecinal': _texto(formulario.relevamiento_vecinal),
            'observaciones': _texto(formulario.observaciones),
        },
    }


def normalizar_semaforo(datos):
    """Deja solo lo que muestra el frontend: el color y la lista de inconsistencias."""
    semaforo = str(datos.get('semaforo') or '').upper()
    if semaforo not in SEMAFOROS:
        raise IAServiceError(f'Semáforo desconocido en la respuesta: {datos.get("semaforo")!r}')

    inconsistencias = [
        {
            'campo': _texto(detalle.get('campo')),
            'valor_ddjj': _texto(detalle.get('valor_ddjj')),
            'valor_informe': _texto(detalle.get('valor_informe')),
            'descripcion': _texto(detalle.get('descripcion')),
            'severidad': str(detalle.get('severidad') or '').upper() or None,
        }
        for detalle in (datos.get('detalles') or [])
    ]
    return {
        'semaforo': semaforo,
        'total_inconsistencias': len(inconsistencias),
        'inconsistencias': inconsistencias,
    }


def _post(ruta, mensaje_rechazo, **kwargs):
    """POST al microservicio. Traduce los errores de red y HTTP a las excepciones de este modulo."""
    url = f"{settings.IA_API_URL.rstrip('/')}{ruta}"
    headers = {'X-API-Key': settings.IA_API_KEY} if settings.IA_API_KEY else {}

    try:
        response = requests.post(url, headers=headers, timeout=settings.IA_API_TIMEOUT, **kwargs)
    except requests.Timeout as e:
        raise IAServiceUnavailable('El servicio de IA tardó demasiado en responder.') from e
    except requests.ConnectionError as e:
        raise IAServiceUnavailable('No se pudo conectar con el servicio de IA.') from e

    if 400 <= response.status_code < 500:
        raise IAServiceRejected(_detalle_error(response) or mensaje_rechazo)
    if not response.ok:
        raise IAServiceError(f'HTTP {response.status_code}: {_detalle_error(response)}')

    try:
        return response.json()
    except ValueError as e:
        raise IAServiceError('El servicio de IA devolvió una respuesta que no es JSON.') from e


def _profesional(expediente):
    usuario = expediente.usuario_asignado
    if usuario is None:
        return None
    perfil = getattr(usuario, 'usuario', None)
    if perfil is not None:
        return _texto(f'{perfil.apellido}, {perfil.nombre}')
    return _texto(f'{usuario.last_name}, {usuario.first_name}')


def normalizar_datos_ddjj(datos):
    """Traduce la respuesta del microservicio (modelo DatosDDJJ) a los campos de nuestro formulario."""
    return {
        'ddjj': _texto(datos.get('numero_ddjj')),
        # si el microservicio todavia no separa el apellido, el nombre completo queda en 'nombre'
        # y la operadora lo separa a mano: adivinar el corte falla con nombres compuestos
        'nombre': _texto(datos.get('nombre')),
        'apellido': _texto(datos.get('apellido')),
        'dni': _solo_digitos(datos.get('dni') or datos.get('dni_titular')),
        'telefono': _texto(datos.get('telefono')),
        'domicilio_actual': _texto(datos.get('domicilio_actual')),
        'email': _texto(datos.get('email')),
        'discapacidad': _texto(datos.get('discapacidad')),
        # el <input type="date"> del formulario solo acepta AAAA-MM-DD
        'fecha_inscripcion': _fecha_iso(datos.get('fecha_inscripcion')),
    }


def _texto(valor):
    if valor is None:
        return None
    texto = ' '.join(str(valor).split())
    return texto or None


def _solo_digitos(valor):
    digitos = re.sub(r'\D', '', str(valor or ''))
    return digitos or None


def _fecha_iso(valor):
    texto = _texto(valor)
    if not texto:
        return None
    texto = re.sub(r'[.\-]', '/', texto.replace(' ', ''))
    for formato in FORMATOS_FECHA:
        try:
            return datetime.strptime(texto, formato).date().isoformat()
        except ValueError:
            continue
    logger.warning(f'Fecha de inscripcion con formato no reconocido: {valor!r}')
    return None


def _detalle_error(response):
    # FastAPI devuelve los errores como {"detail": "..."}
    try:
        detalle = response.json().get('detail')
    except (ValueError, AttributeError):
        detalle = None
    return str(detalle) if detalle else response.text[:300]
