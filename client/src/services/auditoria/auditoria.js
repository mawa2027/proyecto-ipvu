import { api } from "../../api/axiosConfig";

export const auditoriaService = {
    getExpedientes: async () => {
        try {
            const response = await api.get("/expediente/");
            return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            console.error("Error en getExpedientes:", error);
            throw error;
        }
    },

    getAuditoriaUsuarios: async () => {
        try {
            const response = await api.get("/usuario/auditoria_usuarios/");
            return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            console.error("Error en getAuditoriaUsuarios:", error);
            throw error;
        }
    },

    getExpedientePorTS: async (trabajadoraSocial) => {
        try {
            const usuarioId = typeof trabajadoraSocial === "object"
                ? trabajadoraSocial.usuario
                : trabajadoraSocial;

            const response = await api.get(`/expediente/?usuario_asignado=${usuarioId}`);
            return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            console.error("Error en getExpedientePorTS:", error);
            throw error;
        }
    },

    // Trae la auditoria (ordenada de la mas reciente a la mas vieja). Acepta filtros opcionales:
    // { usuario, rol, expediente, q, desde, hasta }. Los vacios no se mandan.
    getHistorialAcciones: async (filtros = {}) => {
        try {
            const params = {};
            Object.entries(filtros).forEach(([clave, valor]) => {
                if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
                    params[clave] = valor;
                }
            });
            const response = await api.get("/historialaccion/", { params });
            return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            console.error("Error en getHistorialAcciones:", error);
            throw error;
        }
    }
};
