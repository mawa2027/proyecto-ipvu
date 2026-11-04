import { api } from "../../api/axiosConfig.js";

export const authService = {
    iniciarSesion: async (username, password) => {
        try {

            const response = await api.post("/login/", {
                username: username,
                password: password
            });

            if (response.data.access) {
                // Guardamos el token JWT (usamos el .access que manda tu back)
                localStorage.setItem("token", response.data.access);
                // con el refresh se renueva el token cada 5 minutos sin volver a loguearse (ver axiosConfig.js)
                localStorage.setItem("refresh", response.data.refresh);
                localStorage.setItem("usuarioLogueado", String(response.data.username));
                localStorage.setItem("nombre_completo", response.data.nombre_completo);

                // Guardamos el ID del rol (como es un número, lo convertimos a string para el localStorage)
                localStorage.setItem("rol_id", String(response.data.rol_id));

                // Opcional: Guardamos si debe cambiar contraseña
                localStorage.setItem("requiere_cambio", String(response.data.requiere_cambio_password));
            }

            return response.data;
        } catch (error) {
            console.error("Error en las credenciales:", error.response?.data || error.message);
            throw error;
        }
    },


    cerrarSesion: () => {
        localStorage.clear();
    }
};