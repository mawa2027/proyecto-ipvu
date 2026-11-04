import os
import requests
import random

from dotenv import load_dotenv

load_dotenv()

# 1. Tus URLs
URL_LOGIN = "http://127.0.0.1:8000/api/login/"
URL_API = "http://127.0.0.1:8000/api/postulantetitular/"

# 2. Tus datos: se leen del .env (PRUEBAS_USUARIO y PRUEBAS_PASSWORD) para no dejar contraseñas en el codigo
credenciales = {
    "username": os.environ.get("PRUEBAS_USUARIO", ""),
    "password": os.environ.get("PRUEBAS_PASSWORD", "")
}

print("Iniciando sesión...")
sesion = requests.post(URL_LOGIN, json=credenciales)

if sesion.status_code == 200:
    token = sesion.json().get('access')
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print("✅ Login exitoso. ¡Cargando los 61 expedientes faltantes sin riesgo de choque!\n")
    
    nombres = ["Matías", "Agustín", "Julieta", "Tomás", "Bautista", "Martina", "Catalina", "Joaquín", 
               "Ignacio", "Paula", "Daniela", "Federico", "Nicolás", "Victoria", "Gonzalo", "Milagros", 
               "Gastón", "Luciana", "Esteban", "Rocío"]
               
    apellidos = ["Fernández", "López", "González", "Rodríguez", "Sánchez", "Pérez", "Ruiz", "Giménez", 
                 "Suárez", "Ríos", "Coronel", "Ledesma", "Juárez", "Carrizo", "Domínguez", "Navarro", 
                 "Acosta", "Villalba", "Molina", "Castaño"]

    # Repetimos 61 veces para completar los 150
    for i in range(1, 62):
        # Generamos un número totalmente aleatorio para la DDJJ para evitar cualquier duplicado
        num_aleatorio = random.randint(5000, 9999)
        
        datos = {
            "nombre": random.choice(nombres),
            "apellido": random.choice(apellidos),
            "dni": str(random.randint(20000000, 55000000)),
            "telefono": f"38515{random.randint(4000000, 9999999)}",
            "domicilio_actual": f"Calle Falsa {random.randint(100, 3000)}",
            "ddjj": f"DDJJ-2026-{num_aleatorio}X", 
            "ingresos": random.randint(300000, 1500000),
            "tiene_discapacidad": random.choice([True, False])
        }
        
        respuesta = requests.post(URL_API, json=datos, headers=headers)
        
        if respuesta.status_code == 201:
            print(f"✅ {i}/61 Creado ({datos['ddjj']}): {datos['nombre']} {datos['apellido']}")
        else:
            print(f"❌ Error en {i}/61: {respuesta.status_code} - {respuesta.text}")

else:
    print(f"🚨 Falló el login: {sesion.status_code} - {sesion.text}")