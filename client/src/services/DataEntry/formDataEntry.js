import { api } from "../../api/axiosConfig.js"


export const postulanteTitular = {

    crearPostulante: async (datosPostulante) => {
        try {
            const response = await api.post("/postulantetitular/", datosPostulante)
            return response.data
        } catch (error) {
            console.error(error)
            throw error;
        }
    }


}