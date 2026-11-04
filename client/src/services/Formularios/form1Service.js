import { api } from "../../api/axiosConfig";

export const form1Service = {

    obtenerTodosLosFormularios: async () => {

        const response = await api.get('/formulario/');
        return response.data;
    },

    getFormularioPorExpediente: async (idExpediente) => {
        const response = await api.get(`/formulario/?expediente=${idExpediente}`)
        return response.data
    },

    // Guardar por primera vez (POST)
    crearFormulario: async (datos) => {
        const response = await api.post('/formulario/', datos);
        return response.data;
    },

    //  PATCH
    actualizarFormulario: async (id, datos) => {
        const response = await api.put(`/formulario/${id}/`, datos);
        return response.data;
    }
};
