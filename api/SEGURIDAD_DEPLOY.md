# Claves y seguridad para el deploy

Todo lo sensible del backend se configura con variables de entorno. En local se leen del archivo `api/.env`; en el servidor de producción se cargan en el `.env` del servidor o en las variables de entorno del servicio. **No hay claves escritas en el código.**

La lista completa de variables, con su explicación, está en [`.env.example`](.env.example).

## Situación actual (desarrollo)

- `api/.env` **está subido al repositorio** e incluye la contraseña de la base de Supabase. Se aceptó así mientras el repo sea privado y el sistema esté en desarrollo.
- Sin variables definidas, el backend usa valores de desarrollo: `DEBUG=False`, cualquier dominio permitido, CORS abierto, correos impresos en la terminal y una `SECRET_KEY` insegura.

## Checklist el día del deploy

Hacerlo en este orden.

### 1. Sacar el `.env` del repositorio

```bash
git rm --cached api/.env
git commit -m "Dejar de versionar api/.env"
```

`.gitignore` ya está preparado para ignorarlo desde ese momento.

> **Avisar al equipo antes:** al hacer pull de ese commit, git **borra** el `api/.env` local de cada integrante. Cada uno debe copiarlo a otro lado antes y restaurarlo después.

### 2. Cambiar todas las claves que estuvieron en el repo

Sacar el archivo no alcanza: las claves quedan para siempre en el historial de git.

| Clave | Dónde se cambia |
|---|---|
| Contraseña de la base | Panel de la base (Supabase: Settings → Database → Reset database password). Si producción usa una base propia de la provincia, crearla con una contraseña nueva. |
| Contraseña del usuario de `PRUEBAS_USUARIO` | Desde el sistema, o eliminar ese usuario en producción |

### 3. Completar el `.env` del servidor

Partir de `.env.example`. Mínimo indispensable:

```
DATABASE_URL=postgresql://USUARIO:CONTRASEÑA_NUEVA@HOST:5432/BASE
SECRET_KEY=<generada, ver abajo>
DEBUG=False
ALLOWED_HOSTS=api.ipvu.example.gob.ar
CORS_ALLOWED_ORIGINS=https://ipvu.example.gob.ar
FRONTEND_URL=https://ipvu.example.gob.ar
USAR_HTTPS=True
```

Los dominios son ejemplos: reemplazarlos por los reales del servidor de la provincia.

Generar la `SECRET_KEY` (una sola vez, y guardarla solo en el servidor):

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

> Cambiar la `SECRET_KEY` cierra la sesión de todos los usuarios e invalida los links de reseteo de contraseña pendientes. Es esperable.

Si el sistema debe enviar correos reales (reseteo de contraseña), completar también `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend` y los datos `EMAIL_*` del servidor de correo.

Si se usa el microservicio de IA: `IA_API_URL` con su dirección y `IA_API_KEY` con la clave que entregue ese equipo.

### 4. Verificar

```bash
python manage.py check --deploy
```

Solo deben quedar estas dos advertencias, que son **esperables**:

- `security.W005` (`SECURE_HSTS_INCLUDE_SUBDOMAINS`)
- `security.W021` (`SECURE_HSTS_PRELOAD`)

Activarlas obligaría a usar HTTPS en **todos** los subdominios del dominio. En un dominio provincial esos subdominios pertenecen a otros organismos, así que no se activan sin consultarlo con quien administra el dominio.

Si aparece cualquier otra advertencia (`SECRET_KEY`, `DEBUG`, cookies, HTTPS), revisar la variable correspondiente.

## Documentos adjuntos: la carpeta `media/` NO se publica

Los adjuntos (DNI, DDJJ, etc.) se guardan en `api/media/` y **solo** se descargan por
`/api/documentoadjunto/<id>/descargar/`, que pide login y rol y deja la descarga en la auditoría.
Django ya no sirve `/media/` (ni en desarrollo).

En el servidor:

- **No** configurar nginx/Apache para servir `/media/` (es lo que suelen indicar los tutoriales de Django: acá no va).
- La carpeta `media/` no tiene que quedar dentro de una carpeta pública del servidor web.
- Incluir `media/` en los backups junto con la base: si se pierde, se pierden los archivos de todos los expedientes.

## El repositorio (`.git`) y el `.env` NO se publican

Herramientas como `git-dumper` buscan `https://sitio/.git/` y, si responde, reconstruyen todo el código **con su historial** (que tiene claves viejas, como la contraseña de la base que estuvo en `api/.env`). Django no sirve esas rutas (hay un test que lo controla), así que el riesgo está en la configuración del servidor web:

- El frontend se publica **solo** desde `client/build/` (lo que genera `npm run build`), nunca desde la carpeta del repositorio.
- El backend corre con gunicorn detrás de nginx (proxy); nginx no sirve archivos de la carpeta del repo.
- No hacer `git clone` dentro de la carpeta pública del servidor web (`/var/www/html` o similar).
- Por las dudas, bloquear en nginx cualquier archivo o carpeta oculta:

```nginx
location ~ /\. {
    deny all;
    return 404;
}
```

Para verificar después del deploy (las dos tienen que dar 404):

```bash
curl -I https://<dominio>/.git/HEAD
curl -I https://<dominio>/.env
```

## Permisos y sesión

- `DEFAULT_PERMISSION_CLASSES` es `IsAuthenticated`: una vista nueva sin `permission_classes` pide login. Las públicas (login, reseteo de contraseña) declaran `AllowAny`.
- El token de acceso dura 5 minutos y el frontend lo renueva solo con el refresh (`client/src/api/axiosConfig.js`). Después de 30 minutos sin usar el sistema, la sesión se cierra.

## Base nueva en el servidor

`python manage.py migrate` funciona sobre una base vacía (las migraciones 0014 y 0015 que repetían cambios de `0001_initial` ya no tocan la base). Los tests crean la base desde cero (en SQLite) y sirven de primera comprobación; la definitiva es correr `migrate` contra el PostgreSQL vacío del servidor:

```bash
python manage.py test gestion
```

## Pruebas de seguridad (STRIDE)

`gestion/tests_stride.py` prueba el backend contra las 6 categorías de STRIDE (suplantación, alteración, repudio, filtración de datos, denegación de servicio y elevación de privilegios). Corren con `python manage.py test gestion`.

Regla de acceso que hace cumplir el backend (y prueban los tests):

- Trabajadora social, Legales y Data Entry **solo ven y tocan los expedientes que tienen en su poder** (asignados): sus documentos, postulante, formulario y pases.
- Para trabajar un expediente ajeno hay que pedir que te lo pasen. Al hacer un pase, quien lo envía deja de verlo.
- Apto / No apto / Nueva visita lo puede poner cualquier rol, sobre sus expedientes.
- El superadmin ve todo y es el único que ve la auditoría.

## Pendientes de seguridad que no son claves

Conviene resolverlos antes de producción. No se tocaron todavía porque cambian el comportamiento de la API:

- Las tablas de la base no tienen RLS activado (Supabase lo marca como error en el Security Advisor). Deja de aplicar cuando la base se mude al servidor de la provincia.
- `SECURE_HSTS_SECONDS` arranca en una hora; subirlo (por ejemplo, a un año) cuando se confirme que todo funciona por HTTPS.
