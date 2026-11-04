import { Link, useLocation, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { form1Service } from "../../../services/Formularios/form1Service";
import { useToast } from "../../../context/ToastContext";

const Form1 = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const toast = useToast();

    // Desestructuramos el estado de la ruta sumando 'idFormulario' y los campos cargados previamente si existen
    const {
        idExpediente,
        ddjj,
        nombreCompletoUsuario,
        domicilio,
        idFormulario, // <-- ID único del formulario guardado para saber si es PATCH
        datosPrevios,   // <-- Objeto opcional con los campos ya guardados en el Back
        soloLectura = false
    } = location.state || {};

    console.log('idFormulario :>> ', idFormulario);

    // Traemos 'reset' para cargar los datos dinámicamente cuando el componente monte
    const { register, handleSubmit, reset, formState: { errors } } = useForm();

    const isEditMode = Boolean(idFormulario);

    // Cargar los campos guardados si estamos en modo edición
    useEffect(() => {
        if (isEditMode && datosPrevios) {
            reset({
                casoDeReferencia: datosPrevios.caso_referencia || "",
                domicilioConstatado: datosPrevios.domicilio_constatado || "",
                grupoFamiliarConstituyente: datosPrevios.grupo_familiar || "",
                situacionHabitacional: datosPrevios.situacion_habitacional || "",
                aspectoEconomico: datosPrevios.aspecto_economico || "",
                situacionDeSalud: datosPrevios.situacion_salud || "",
                nivelDeEstudios: datosPrevios.nivel_estudios || "",
                relevamientoVecinal: datosPrevios.relevamiento_vecinal || "",
                observacionesParticularidades: datosPrevios.observaciones || ""
            });
        }
    }, [isEditMode, datosPrevios, reset]);

    const onSubmit = async (data) => {
        if (soloLectura) {
            navigate(`/expediente/${idExpediente}`);
            return;
        }

        try {
            // Mapeamos los nombres de React Hook Form a lo que espera tu Backend
            const payload = {
                expediente: idExpediente,
                caso_referencia: data.casoDeReferencia,
                domicilio_constatado: data.domicilioConstatado,
                grupo_familiar: data.grupoFamiliarConstituyente,
                situacion_habitacional: data.situacionHabitacional,
                aspecto_economico: data.aspectoEconomico,
                situacion_salud: data.situacionDeSalud,
                nivel_estudios: data.nivelDeEstudios,
                relevamiento_vecinal: data.relevamientoVecinal,
                observaciones: data.observacionesParticularidades
            };

            if (isEditMode) {
                // patch
                console.log('Enviando PATCH con id:', idFormulario, payload);
                await form1Service.actualizarFormulario(idFormulario, payload);
                toast.success("¡Formulario actualizado exitosamente!");
            } else {
                // post
                console.log('Enviando POST:', payload);
                await form1Service.crearFormulario(payload);
                toast.success("¡Formulario creado!");
            }

            navigate(`/expediente/${idExpediente}`);

        } catch (error) {
            console.error("❌ Error completo capturado:", error);

            // Si el backend respondió con un error (ej: 400 Bad Request)
            if (error.response) {
                console.error("Detalles del error del Backend:", error.response.data);
                console.error("Código de estado HTTP:", error.response.status);

                // Convertimos el objeto de error a un texto legible para el toast
                const erroresBackend = JSON.stringify(error.response.data, null, 2);

                toast.error(
                    `Error del servidor (${error.response.status}):\n${erroresBackend}`
                );
            } else if (error.request) {
                // La petición se hizo pero el servidor no respondió nada (error de red/timeout)
                console.error("No se recibió respuesta del servidor:", error.request);
                toast.error("No se recibió respuesta del servidor. Verifica tu conexión.");
            } else {
                // Ocurrió un error al configurar la petición
                console.error("Error al configurar la petición:", error.message);
                toast.error(`Error: ${error.message}`);
            }
        }
    };

    return (
        <div className="flex items-center justify-center p-4 py-8 md:p-12">
            <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-xl dark:shadow-black/30 border border-gray-100 dark:border-slate-800 transition-colors">
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="flex justify-center">
                        <h2 className="text-gray-800 dark:text-slate-100 font-bold text-[18px] tracking-tight text-center">
                            "INFORME SOCIO HABITACIONAL"
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                        <div>
                            <label className="text-gray-800 dark:text-slate-200 font-semibold text-base">Profesional Actuante</label>
                            <p className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 transition-all duration-200">{nombreCompletoUsuario}</p>
                        </div>

                        <div>
                            <label className="text-gray-800 dark:text-slate-200 font-semibold text-base">Caso de referencia</label>
                            <input
                                type="text"
                                readOnly={soloLectura}
                                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200"
                                {...register("casoDeReferencia")}
                            />
                        </div>

                        <div>
                            <label className="text-gray-800 dark:text-slate-200 font-semibold text-base">DJ N°</label>
                            <p className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 transition-all duration-200">{ddjj}</p>
                        </div>

                        <div>
                            <label className="text-gray-800 dark:text-slate-200 font-semibold text-base">Domicilio</label>
                            <p className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 transition-all duration-200">{domicilio}</p>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-gray-800 dark:text-slate-200 font-semibold text-base">Domicilio constatado</label>
                            <p className="text-gray-600 dark:text-slate-400 text-sm">Dónde se realizó la visita, si es distinto al declarado</p>
                            <input
                                type="text"
                                maxLength={200}
                                readOnly={soloLectura}
                                className="w-full mt-2 px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200"
                                {...register("domicilioConstatado")}
                            />
                        </div>
                    </div>

                    <div>
                        <div className="mt-5">
                            <h2 className="text-gray-800 dark:text-slate-200 font-semibold text-base">GRUPO FAMILIAR CONSTITUYENTE</h2>
                            <p className="text-gray-600 dark:text-slate-400 text-sm">Tipo y Dinamia Familiar. Conflictos</p>
                            <textarea
                                readOnly={soloLectura}
                                className="w-full mt-2 px-3 py-3 text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200 resize-none"
                                {...register("grupoFamiliarConstituyente")}
                            />
                        </div>

                        <div className="mt-5">
                            <h2 className="text-gray-800 dark:text-slate-200 font-semibold text-base">SITUACION HABITACIONAL</h2>
                            <p className="text-gray-600 dark:text-slate-400 text-sm">Tipo de posesion y tiempo de habitabilidad</p>
                            <textarea
                                readOnly={soloLectura}
                                className="w-full mt-2 px-3 py-3 text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200 resize-none"
                                {...register("situacionHabitacional")}
                            />
                        </div>

                        <div className="mt-5">
                            <h2 className="text-gray-800 dark:text-slate-200 font-semibold text-base">ASPECTO ECONOMICO</h2>
                            <p className="text-gray-600 dark:text-slate-400 text-sm">Ingresos y Calidad de Vida</p>
                            <textarea
                                readOnly={soloLectura}
                                className="w-full mt-2 px-3 py-3 text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200 resize-none"
                                {...register("aspectoEconomico")}
                            />
                        </div>

                        <div className="mt-5">
                            <h2 className="text-gray-800 dark:text-slate-200 font-semibold text-base">SITUACION DE SALUD</h2>
                            <p className="text-gray-600 dark:text-slate-400 text-sm">Discapacidad. Invalidez</p>
                            <textarea
                                readOnly={soloLectura}
                                className="w-full mt-2 px-3 py-3 text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200 resize-none"
                                {...register("situacionDeSalud")}
                            />
                        </div>

                        <div className="mt-5">
                            <h2 className="text-gray-800 dark:text-slate-200 font-semibold text-base">NIVEL DE ESTUDIOS</h2>
                            <input
                                type="text"
                                readOnly={soloLectura}
                                className="w-full mt-2 px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200"
                                {...register("nivelDeEstudios")}
                            />
                        </div>

                        <div className="mt-5">
                            <h2 className="text-gray-800 dark:text-slate-200 font-semibold text-base">RELEVAMIENTO VECINAL</h2>
                            <textarea
                                readOnly={soloLectura}
                                className="w-full mt-2 px-3 py-3 text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200 resize-none"
                                {...register("relevamientoVecinal")}
                            />
                        </div>

                        <div className="mt-5">
                            <h2 className="text-gray-800 dark:text-slate-200 font-semibold text-base">OBSERVACIONES Y/O PARTICULARIDADES</h2>
                            <textarea
                                readOnly={soloLectura}
                                className="w-full mt-2 px-3 py-3 text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200 resize-none"
                                {...register("observacionesParticularidades")}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col items-center mt-6 gap-3">
                        {soloLectura ? (
                            <Link
                                to={`/expediente/${idExpediente}`}
                                className="w-full md:w-72 bg-gray-600 hover:bg-gray-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-[13px] py-2.5 rounded-lg shadow-sm transition-colors duration-200 text-center"
                            >
                                Volver al expediente
                            </Link>
                        ) : (
                            <button type="submit" className="w-full md:w-72 bg-blue-500 hover:bg-blue-600 text-white font-bold text-[13px] py-2.5 rounded-lg shadow-sm transition-colors duration-200">
                                {isEditMode ? "Actualizar informe" : "Guardar cambios"}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Form1;
