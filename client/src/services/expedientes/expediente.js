import { api } from "../../api/axiosConfig";

const normalizarLista = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
};

export const expedienteService = {

    getExpediente: async () => {
        try {
            const response = await api.get("/expediente/")
            return normalizarLista(response.data)
        } catch (error) {
            console.log("Error al obtener expedientes:", error)
            throw error;
        }
    },

    getExpedienteId: async (id) => {
        try {
            const response = await api.get(`/expediente/${id}/`)
            return response.data
        } catch (error) {
            console.log(`Error al obtener el expediente con el id:${id} `, error)
            throw error;
        }
    },

    marcarComoVisto: async (id) => {
        try {
            const response = await api.patch(`/expediente/${id}/`, { visto: true });
            return response.data;
        } catch (error) {
            console.log("Error al marcar como visto:", error);
        }
    },

    estadoExpediente: async (id, datos) => {
        const response = await api.patch(`/expediente/${id}/`, datos);
        return response.data;
    },

    // ultimo semaforo guardado (no llama a la IA); viene en null si nunca se evaluo o quedo viejo
    obtenerSemaforo: async (id) => {
        const response = await api.get(`/expediente/${id}/semaforo/`);
        return response.data.resultado;
    },

    // el back le pide al microservicio de IA que compare la DDJJ con el formulario socio-habitacional
    evaluarSemaforo: async (id) => {
        const response = await api.post(`/expediente/${id}/evaluar-semaforo/`);
        return response.data;
    }
}

