import { api } from "../../api/axiosConfig";

export const notificacionService = {
    // el backend devuelve solo las del usuario logueado (los avisos de expediente creado duran 5 días)
    obtenerMias: async () => {
        const response = await api.get("/notificacion/");
        return response.data;
    },

    marcarLeida: async (id) => {
        await api.patch(`/notificacion/${id}/marcar-leida/`);
    }
};
