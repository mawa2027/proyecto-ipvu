import { api } from "../../api/axiosConfig";

export const formularioPdfService = {
    generarPdf: async (idFormulario) => {
        const response = await api.get(`/formulario/${idFormulario}/pdf/`, {
            responseType: 'blob'
        });

        return response.data;
    }
};
