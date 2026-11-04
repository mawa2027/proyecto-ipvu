import { api } from "../../api/axiosConfig";

const getBackendOrigin = () => {
    try {
        return new URL(api.defaults.baseURL).origin;
    } catch {
        return "";
    }
};

export const resolverArchivoUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${getBackendOrigin()}${url}`;
};

export const documentoAdjuntoService = {
    obtenerPorExpediente: async (expedienteId) => {
        const response = await api.get(`/documentoadjunto/?expediente=${expedienteId}`);
        return response.data;
    },

    crear: async ({ expedienteId, archivo }) => {
        const formData = new FormData();
        formData.append("expediente", Number(expedienteId));
        formData.append("tipo_documento", archivo.name);
        formData.append("archivo", archivo);

        const response = await api.post("/documentoadjunto/", formData, {
            headers: {
                "Content-Type": "multipart/form-data"
            }
        });

        return response.data;
    },

    eliminar: async (documentoId) => {
        await api.delete(`/documentoadjunto/${documentoId}/`);
    },

    // los archivos piden login: se bajan con axios (que manda el token) y se arma una URL local del navegador
    obtenerArchivo: async (documentoId) => {
        const response = await api.get(`/documentoadjunto/${documentoId}/descargar/`, {
            responseType: "blob"
        });
        return response.data;
    },

    abrirEnPestania: async (documentoId) => {
        // la pestaña se abre antes del await para que el navegador no la bloquee como popup
        const pestania = window.open("", "_blank");
        try {
            const blob = await documentoAdjuntoService.obtenerArchivo(documentoId);
            const urlBlob = window.URL.createObjectURL(blob);
            if (pestania) {
                pestania.location.href = urlBlob;
            } else {
                window.location.href = urlBlob;
            }
            setTimeout(() => window.URL.revokeObjectURL(urlBlob), 60000);
        } catch (error) {
            pestania?.close();
            throw error;
        }
    },

    descargar: async (documentoId, nombreArchivo) => {
        const blob = await documentoAdjuntoService.obtenerArchivo(documentoId);
        const urlBlob = window.URL.createObjectURL(blob);

        const linkDescarga = document.createElement("a");
        linkDescarga.href = urlBlob;
        linkDescarga.download = nombreArchivo;
        document.body.appendChild(linkDescarga);
        linkDescarga.click();
        linkDescarga.remove();
        window.URL.revokeObjectURL(urlBlob);
    }
};
