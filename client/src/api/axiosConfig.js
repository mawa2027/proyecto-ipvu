import axios from "axios"

export const api = axios.create({
    baseURL: import.meta.env.PROD
    ? "https://api-ipvu.itseprueba.com.ar/api"
    : "https://api-ipvu.itseprueba.com.ar/api",
        headers: {
        "Content-Type": "application/json"
    }
})

// INTERCEPTOR: Se ejecuta antes de que CUALQUIER petición viaje al backend
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// El token de acceso dura 5 minutos. Cuando el back responde 401 se pide uno nuevo con el refresh
// y se reintenta la petición. Si el refresh también venció (30 min sin usar el sistema), se cierra la sesión.
const RUTAS_SIN_RENOVAR = ["/login/", "/token/refresh/"];
let renovacionEnCurso = null;

const cerrarSesionVencida = () => {
    localStorage.clear();
    window.location.href = "/login";
};

const renovarToken = async () => {
    const refresh = localStorage.getItem("refresh");
    if (!refresh) throw new Error("Sin refresh token");

    // axios "pelado" para no pasar por estos mismos interceptores
    const response = await axios.post(`${api.defaults.baseURL}/token/refresh/`, { refresh });
    localStorage.setItem("token", response.data.access);
    if (response.data.refresh) {
        localStorage.setItem("refresh", response.data.refresh);
    }
    return response.data.access;
};

api.interceptors.response.use((response) => response, async (error) => {
    const original = error.config;
    const esRutaSinRenovar = RUTAS_SIN_RENOVAR.some((ruta) => original?.url?.includes(ruta));

    if (error.response?.status !== 401 || !original || original._reintentado || esRutaSinRenovar) {
        return Promise.reject(error);
    }
    original._reintentado = true;

    try {
        // si llegan varios 401 juntos, todos esperan la misma renovación
        renovacionEnCurso = renovacionEnCurso || renovarToken();
        const nuevoToken = await renovacionEnCurso;
        original.headers.Authorization = `Bearer ${nuevoToken}`;
        return api(original);
    } catch (errorRenovacion) {
        cerrarSesionVencida();
        return Promise.reject(error);
    } finally {
        renovacionEnCurso = null;
    }
});
