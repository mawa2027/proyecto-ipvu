aqui vamos  a ir poniendo de que se trata el proyecto.
que trabajamos en el back como crrer la terminal 
que trabajamos en el front como correr la termnal
y toda la info del proyecto


*** CÓMO LEVANTAR EL BACKEND LOCAL (GUÍA PARA FRONTEND) ***

REQUISITO: Tener instalado Python (al instalarlo, asegúrense de marcar la casilla "Add Python to PATH").

PASO 1: Posicionarse en la rama de integración (hacer esto cada vez que necesiten actualizar el backend)
git fetch
git checkout develop
git pull origin develop

PASO 2: Crear el entorno virtual (se hace una sola vez)
python -m venv venv   (si no funciona con python -m venv venv, prueben haciendo py -m venv venv asi me funciona a mi a veces xd)

PASO 3: Activar el entorno virtual (se hace siempre antes de levantar el server)
.\venv\Scripts\activate

* Si la terminal (PowerShell) les tira un error rojo de permisos al activar, corran este comando una vez, escriban "S" y vuelvan a intentar el Paso 3:
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

PASO 4: Instalar dependencias (hacerlo la primera vez y cada vez que el backend avise que sumó librerías)
pip install -r requirements.txt

PASO 5: Prender el motor
python manage.py runserver

LISTO. El servidor va a quedar corriendo en http://localhost:8000. 
Minimicen esta terminal y déjenla abierta de fondo mientras trabajan en el front.



para mi y piero quedaria asi para subir a la rama develop
# Estando en tu rama-auditoria, subís tus cambios:
git add .
git commit -m "Terminé la auditoría"
git push origin rama-auditoria

# Te pasás a develop y fusionás tus cambios:
git checkout develop
git merge rama-auditoria
git push origin develop