import { api } from "../../api/axiosConfig";

export const nuevaContraseña = {

    cambiarContraseña: async (data) => {
        try {
            const response = await api.post("/establecer-password-inicial/", data)
            return response.data
        } catch (error) {
            console.log(error)
        }
    }

}