import { api } from "../../api/axiosConfig";


export const estadoExpediente = {

    patchEstadoExp: async (id, datos) => {
        console.log('datos :>> ', datos);
        const response = await api.patch(`/expediente/${id}/cambiar_estado/`, datos);
        return response.data;
    },
}