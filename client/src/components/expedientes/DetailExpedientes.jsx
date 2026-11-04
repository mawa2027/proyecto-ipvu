import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeftIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { expedienteService } from '../../services/expedientes/expediente';
import { form1Service } from '../../services/Formularios/form1Service';
import { usuarioService } from '../../services/usuarios/usuarios';
import { historial } from '../../services/historial/historial';
import { AdjuntarArchivos } from '../Archivos/AdjuntarArchivo';
import { SemaforoInconsistencias } from './SemaforoInconsistencias';
import { estadoExpediente } from '../../services/estadoEpediente/estadoExpediente';
import { formularioPdfService } from '../../services/Formularios/formularioPdfService';
import { documentoAdjuntoService, resolverArchivoUrl } from '../../services/documentos/documentoAdjunto';
import { nombreUsuarioAsignado } from '../../utils/expedienteHelpers';
import { useToast } from '../../context/ToastContext';

const DetailExpedientes = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const toast = useToast()
    const [expediente, setExpediente] = useState(null)
    const [error, setError] = useState(null)
    const [cargando, setCargando] = useState(true)
    const [formulario, setFormulario] = useState([])
    const [mensajePase, setMensajePase] = useState('')
    const [errorMensaje, setErrorMensaje] = useState(false)
    const [listaUsuario, setlistaUsuario] = useState(null)
    const [rolSeleccionado, setRolSeleccionado] = useState('');
    const [usuarioDestino, setUsuarioDestino] = useState('');
    const [historialPases, setHistorialPases] = useState([]);


    const [estadoSeleccionado, setEstadoSeleccionado] = useState('NUEVAV');

    // Opciones para el select de estados del expediente
    const tipo_estado = [
        { value: 'NUEVAV', label: 'Nueva Visita' },
        { value: 'AP', label: 'Apto' },
        { value: 'NOAP', label: 'No Apto' }
    ];

    // console.log('historialPases :>> ', historialPases);
    // console.log('usuarioDestino :>> ', usuarioDestino);
    console.log('formulario :>> ', formulario);
    console.log('historialPases :>> ', historialPases);

    const rolId = Number(localStorage.getItem('rol_id'));
    const usuarioLogueado = String(localStorage.getItem('usuarioLogueado'))
    // console.log('usuarioLogueado :>> ', usuarioLogueado);
    console.log('expediente :>> ', expediente);

    useEffect(() => {
        const obtenerDatos = async () => {
            try {
                setCargando(true);
                setError(null);

                // 🚀 Disparamos las 4 peticiones en paralelo (al mismo tiempo)
                const [dataExpediente, formularioPorExp, usuarios, pasesFiltrados] = await Promise.all([
                    expedienteService.getExpedienteId(id),
                    form1Service.getFormularioPorExpediente(id),
                    usuarioService.getUsuarios(),
                    historial.obtenerPasesPorExpediente(id)
                ]);

                // 1. Guardamos los datos del expediente
                setExpediente(dataExpediente);

                // 2. Procesamos el formulario seleccionando el último del array
                if (Array.isArray(formularioPorExp) && formularioPorExp.length > 0) {
                    const formulariosDelExpediente = formularioPorExp.filter(
                        (form) => Number(form.expediente) === Number(id)
                    );

                    const ultimoFormulario = formulariosDelExpediente[formulariosDelExpediente.length - 1];
                    setFormulario(ultimoFormulario || null);
                } else {
                    setFormulario(null);
                }

                // 3. Filtramos la lista de usuarios
                const usuarioFiltr = usuarios.filter((u) => String(u.username_display) !== String(usuarioLogueado));
                setlistaUsuario(usuarioFiltr);

                // 4. Guardamos el historial de pases
                if (Array.isArray(pasesFiltrados)) {
                    setHistorialPases(pasesFiltrados);
                } else {
                    setHistorialPases([]);
                }

            } catch (error) {
                console.error("Error al procesar la información:", error);
                setError("No se pudo sincronizar el estado del formulario técnico.");
            } finally {
                setCargando(false);
            }
        };

        if (id) {
            obtenerDatos();
        }
    }, [id]);

    // console.log('listaUsuario :>> ', listaUsuario);

    const usuariosFiltrados = React.useMemo(() => {
        if (!rolSeleccionado || !listaUsuario) return [];
        return listaUsuario.filter(user => Number(user.rol) === Number(rolSeleccionado));
    }, [rolSeleccionado, listaUsuario]);

    const obtenerAdjuntosMovimiento = (movimiento) => {
        if (Array.isArray(movimiento?.documentos_adjuntos_detalle)) {
            return movimiento.documentos_adjuntos_detalle;
        }

        return [];
    };

    const obtenerNombreAdjunto = (adjunto) => {
        const nombreDesdeUrl = adjunto?.archivo?.split('/').pop() || adjunto?.archivo_url?.split('/').pop();
        return adjunto?.tipo_documento || adjunto?.nombre || adjunto?.nombre_archivo || nombreDesdeUrl || 'Archivo adjunto';
    };

    const obtenerUrlAdjunto = (adjunto) => {
        return resolverArchivoUrl(adjunto?.archivo_url || adjunto?.archivo || adjunto?.url);
    };

    const adjuntosHistorial = React.useMemo(() => {
        if (!Array.isArray(historialPases)) return [];
        return historialPases.flatMap((movimiento) => obtenerAdjuntosMovimiento(movimiento));
    }, [historialPases]);

    const descargarAdjunto = async (adjunto) => {
        if (!adjunto?.id) return;

        try {
            // con axios viaja el token: el endpoint de descarga pide login
            await documentoAdjuntoService.descargar(adjunto.id, obtenerNombreAdjunto(adjunto));
        } catch (error) {
            console.error('Error al descargar el adjunto:', error);
            toast.error('No se pudo descargar el archivo adjunto.');
        }
    };

    const handleGenerarPdf = async () => {
        if (!formulario?.id) {
            toast.error("No se encuentra el formulario para generar el PDF");
            return;
        }

        try {
            const pdfBlob = await formularioPdfService.generarPdf(formulario.id);
            const urlPdf = window.URL.createObjectURL(pdfBlob);
            const linkDescarga = document.createElement('a');

            linkDescarga.href = urlPdf;
            linkDescarga.download = `Formulario_${formulario.id}.pdf`;
            document.body.appendChild(linkDescarga);
            linkDescarga.click();
            linkDescarga.remove();
            window.URL.revokeObjectURL(urlPdf);
        } catch (error) {
            console.error("Error al generar el PDF:", error);
            toast.error("No se pudo generar el PDF del formulario.");
        }
    };


    //boton Enviar POST
    const handleEnviarPase = async (e) => {
        e.preventDefault();

        // Validación del mensaje
        if (!mensajePase.trim()) {
            setErrorMensaje(true);
            return;
        }
        setErrorMensaje(false);

        // Validación de selección de usuario destino
        if (!usuarioDestino) {
            toast.error("Por favor, selecciona un perfil y un usuario de destino antes de enviar.");
            return;
        }

        const formData = new FormData();
        formData.append('expediente', Number(id));
        formData.append('observacion', mensajePase.trim());
        formData.append('usuario_destino', Number(usuarioDestino));

        //  BACKEND AGREGADO: Si es rolId === 3, enviamos el estado seleccionado en el FormData final
        // if (rolId === 3) {
        //     formData.append('nuevo_estado', estadoSeleccionado);
        // }

        try {
            // console.log("Enviando pase...");


            if (rolId === 3) {
                // Intentá mandarlo como un objeto JSON simple en lugar de FormData
                const datosEstado = {
                    // Cambiá la clave según lo que pida tu backend:
                    estado: estadoSeleccionado
                };

                // Llamamos a la función pasándole el ID y el objeto con el dato
                await estadoExpediente.patchEstadoExp(id, datosEstado);
            }

            await historial.postHistorialPase(formData);

            setMensajePase('');
            setRolSeleccionado('');
            setUsuarioDestino('');
            setEstadoSeleccionado('SINI'); // Reseteamos al valor inicial
            toast.success("Pase del expediente realizado correctamente.");
            navigate("/expedientes")

        } catch (error) {
            console.error("Error al enviar el pase:", error);
            toast.error("Hubo un error al procesar el pase en el servidor. Revisa los datos.");
        }
    };

    if (cargando) {
        return (
            <div className="w-full flex justify-center items-center p-4 py-24">
                <div className="text-gray-600 dark:text-slate-300 font-medium animate-pulse">Cargando datos del expediente...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full flex justify-center items-center p-4 py-24">
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 px-6 py-4 rounded-xl shadow-sm text-center max-w-md">
                    <p className="font-semibold mb-2">¡Ups! Algo salió mal</p>
                    <p className="text-sm">{error}</p>
                </div>
            </div>
        );
    }

    const estadoGlobal = typeof expediente?.estado_expediente === 'string'
        ? expediente.estado_expediente
        : expediente?.estado_expediente?.nombre;

    const esNuevaVisitaTrabajadoraSocial = rolId === 1 && estadoGlobal === 'NUEVAV';
    const formularioActual = esNuevaVisitaTrabajadoraSocial ? null : formulario;
    const estadoInternoForm = esNuevaVisitaTrabajadoraSocial
        ? 'sin iniciar'
        : formularioActual?.estado || 'sin iniciar';

    const mostrarFormularioTrabajadoraSocial = rolId === 1 && ['SINI', '1V', 'NUEVAV'].includes(estadoGlobal);
    const mostrarAdjuntarArchivos = rolId === 2 || rolId === 3 || (rolId === 1 && estadoGlobal === 'AP');
    const formularioCompletado = estadoInternoForm === 'completado';
    const formularioSoloLectura = false;
    const mostrarBotonPdf = mostrarFormularioTrabajadoraSocial && formularioCompletado && Boolean(formularioActual?.id);

    let textoBotonFormulario = "Crear formulario";
    if (esNuevaVisitaTrabajadoraSocial) {
        textoBotonFormulario = "Realizar tarea";
    } else if (estadoInternoForm === "en progreso") {
        textoBotonFormulario = "Editar formulario";
    } else if (estadoInternoForm === "completado") {
        textoBotonFormulario = "Ver formulario";
    }

    return (
        <div className="w-full flex flex-col items-center p-4 py-8">
            <div className="w-full max-w-6xl flex flex-col gap-4">
                <div>
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold transition group"
                    >
                        <ArrowLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                        <span>Volver</span>
                    </button>
                </div>

                <div className="w-full bg-white dark:bg-slate-900 shadow-lg dark:shadow-black/30 border border-transparent dark:border-slate-800 rounded-2xl p-6 md:p-10 transition-colors">

                {/* DATOS DEL TITULAR */}
                <h3 className="text-gray-800 dark:text-slate-100 font-bold text-xl">Datos del Titular</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                    <div>
                        <p className="text-gray-600 dark:text-slate-400 text-sm">Nombre completo</p>
                        <p className="text-gray-800 dark:text-slate-100 font-semibold">{expediente?.postulante_titular?.apellido} {expediente?.postulante_titular?.nombre}</p>
                    </div>
                    <div>
                        <p className="text-gray-600 dark:text-slate-400 text-sm">D.N.I</p>
                        <p className="text-gray-800 dark:text-slate-100 font-semibold">{expediente?.postulante_titular?.dni}</p>
                    </div>
                    <div>
                        <p className="text-gray-600 dark:text-slate-400 text-sm">Domicilio</p>
                        <p className="text-gray-800 dark:text-slate-100 font-semibold">{expediente?.postulante_titular?.domicilio}</p>
                    </div>
                    <div>
                        <p className="text-gray-600 dark:text-slate-400 text-sm">Fecha de inicio</p>
                        <p className="text-gray-800 dark:text-slate-100 font-semibold">{expediente?.fecha_creacion
                            ? new Date(expediente.fecha_creacion).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
                            : '---'}</p>
                    </div>
                    {(rolId === 3 || rolId === 4) && (
                        <>
                            <div>
                                <p className="text-gray-600 dark:text-slate-400 text-sm">Usuario Asignado</p>
                                <p className="text-gray-800 dark:text-slate-100 font-semibold capitalize">
                                    {nombreUsuarioAsignado(expediente)}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-600 dark:text-slate-400 text-sm">Días en Poder</p>
                                <p className="text-gray-800 dark:text-slate-100 font-semibold">
                                    {expediente?.dias_en_poder ?? 0} días
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* SEMÁFORO DE INCONSISTENCIAS: recién con el formulario socio-habitacional terminado */}
                {formularioCompletado && <SemaforoInconsistencias expedienteId={id} />}

                {/* ─── SECCIÓN DE ACCIONES ─── */}
                <div className="mt-5 bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700 rounded-xl p-5 shadow-sm">



                    <div className="flex flex-col gap-1.5 mb-4">
                        <label className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-1">
                            Mensaje de Pase <span className="text-red-500 dark:text-red-400">*</span>
                        </label>
                        <textarea
                            value={mensajePase}
                            onChange={(e) => {
                                setMensajePase(e.target.value);
                                if (e.target.value.trim()) setErrorMensaje(false);
                            }}
                            placeholder="Escribí un mensaje o informe sobre lo realizado antes de enviar..."
                            className={`w-full min-h-[85px] p-3 text-sm bg-white dark:bg-slate-800 border rounded-lg focus:outline-none focus:ring-2 placeholder-gray-400 dark:placeholder-slate-500 text-gray-800 dark:text-slate-100 transition ${errorMensaje
                                ? 'border-red-500 dark:border-red-500 focus:ring-red-200 dark:focus:ring-red-500/30'
                                : 'border-gray-300 dark:border-slate-600 focus:ring-blue-500 dark:focus:ring-blue-500/40'
                                }`}
                            rows="3"
                        />

                        {errorMensaje && (
                            <span className="text-red-600 dark:text-red-400 text-xs font-semibold animate-fade-in">
                                ⚠️ Debes completar el mensaje de pase antes de enviar el expediente.
                            </span>
                        )}
                    </div>

                    {/* FORMULARIO COMPLETADO */}
                    {estadoInternoForm === "completado" && rolId === 1 && estadoGlobal !== 'AP' && (
                        <div className="mb-4 inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-green-800 dark:text-green-400 px-3 py-1.5 rounded-lg text-xs font-semibold">
                            <span>✓ Ya completaste el formulario socio-habitacional</span>
                        </div>
                    )}

                    {/* Adjuntos para Legales, Administrativa o Trabajadora Social con expediente Apto */}
                    {mostrarAdjuntarArchivos && (
                        <div className="mb-4 p-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-200/60 dark:border-slate-700">
                            <AdjuntarArchivos expedienteId={id} adjuntosExcluidos={adjuntosHistorial} />
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mt-2 pt-2 border-t border-gray-200 dark:border-slate-700 w-full">
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end flex-grow">

                            {mostrarFormularioTrabajadoraSocial && (
                                <>
                                    <Link
                                        to="/form1"
                                        state={{
                                            idExpediente: expediente?.id,
                                            ddjj: expediente?.DDJJ,
                                            nombreCompletoUsuario: `${expediente?.usuario_asignado?.apellido || ''} ${expediente?.usuario_asignado?.nombre || ''}`.trim() || 'Sin usuario',
                                            domicilio: expediente?.postulante_titular?.domicilio,
                                            idFormulario: formularioActual?.id || null,
                                            datosPrevios: formularioActual || null,
                                            soloLectura: formularioSoloLectura
                                        }}
                                        className="inline-flex items-center justify-center bg-white dark:bg-slate-800 border border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 font-semibold text-sm px-4 py-1.5 h-9 rounded-lg transition w-full sm:w-auto whitespace-nowrap"
                                    >
                                        {textoBotonFormulario}
                                    </Link>

                                    {mostrarBotonPdf && (
                                        <button
                                            type="button"
                                            onClick={handleGenerarPdf}
                                            className="inline-flex items-center justify-center bg-white dark:bg-slate-800 border border-green-600 dark:border-green-500 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 font-semibold text-sm px-4 py-1.5 h-9 rounded-lg transition w-full sm:w-auto whitespace-nowrap"
                                        >
                                            Generar PDF
                                        </button>
                                    )}
                                </>
                            )}

                            {/* Contenedor de Selects flexibles */}
                            <div className="flex flex-col sm:flex-row gap-3 items-end w-full sm:w-auto">

                                {/*  rolId === 3 data entry */}
                                {rolId === 3 && (
                                    <div className="flex flex-col gap-1 w-full sm:w-48 animate-fade-in">
                                        <label className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Estado de Expediente</label>
                                        <select
                                            value={estadoSeleccionado}
                                            onChange={(e) => setEstadoSeleccionado(e.target.value)}
                                            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg text-sm px-3 py-1.5 h-9 text-gray-700 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500/40 transition cursor-pointer font-medium"
                                        >
                                            {tipo_estado.map((estado) => (
                                                <option key={estado.value} value={estado.value}>
                                                    {estado.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Enviar a Perfil */}
                                <div className="flex flex-col gap-1 w-full sm:w-48">
                                    <label className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Enviar a Perfil</label>
                                    <select
                                        value={rolSeleccionado}
                                        onChange={(e) => {
                                            setRolSeleccionado(e.target.value);
                                            setUsuarioDestino('');
                                        }}
                                        className="w-full border border-gray-300 dark:border-slate-600 rounded-lg text-sm px-3 py-1.5 h-9 text-gray-700 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500/40 transition"
                                    >
                                        <option value="">Seleccionar perfil...</option>
                                        <option value="1">Trabajadora Social</option>
                                        <option value="2">Legales</option>
                                        <option value="3">Administrativa</option>
                                        <option value="4">Administrador</option>
                                    </select>
                                </div>

                                {/*  Usuario Destino */}
                                {rolSeleccionado && (
                                    <div className="flex flex-col gap-1 w-full sm:w-56 animate-fade-in">
                                        <label className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Usuario Destino</label>
                                        <select
                                            value={usuarioDestino}
                                            onChange={(e) => setUsuarioDestino(e.target.value)}
                                            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg text-sm px-3 py-1.5 h-9 text-gray-700 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500/40 transition"
                                        >
                                            <option value="">Seleccionar usuario...</option>
                                            {usuariosFiltrados.map((user) => (
                                                <option key={user.id} value={user.usuario}>
                                                    {user.nombre_completo || `${user.nombre} ${user.apellido}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* BOTÓN ENVIAR */}
                        <button
                            onClick={handleEnviarPase}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-1.5 h-9 rounded-lg transition font-medium shadow-sm w-full md:w-auto whitespace-nowrap self-stretch sm:self-end"
                        >
                            Enviar
                        </button>
                    </div>
                </div>

                {/* HISTORIAL DE MOVIMIENTOS */}
                <h3 className="text-gray-800 dark:text-slate-100 font-bold text-xl mt-8">Historial de Movimiento</h3>

                {!historialPases || historialPases.length === 0 ? (
                    <p className="text-gray-500 dark:text-slate-400 text-sm mt-2 italic">Este expediente aún no registra pases en el historial.</p>
                ) : (
                    historialPases.map((movimiento, index) => {
                        const adjuntosMovimiento = obtenerAdjuntosMovimiento(movimiento);

                        return (
                            <div key={movimiento.id || index} className="relative flex gap-4 pb-6">
                                <div className="flex flex-col items-center">
                                    <div className="w-3 h-3 rounded-full bg-blue-500 dark:bg-blue-400 shrink-0"></div>
                                    <div className="w-0.5 bg-blue-200 dark:bg-blue-500/30 flex-1"></div>
                                </div>
                                <div className='bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-xl p-4 shadow-sm w-full'>
                                    <p className="text-sm text-gray-500 dark:text-slate-400">
                                        Fecha: <span className="text-gray-800 dark:text-slate-100 font-semibold">
                                            {movimiento.fecha_envio
                                                ? new Date(movimiento.fecha_envio).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
                                                : '---'}
                                        </span>
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Usuario Origen: <span className="text-gray-800 dark:text-slate-100 font-semibold">{movimiento.usuario_origen_display || '---'}</span></p>
                                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Usuario Destino: <span className="text-gray-800 dark:text-slate-100 font-semibold">{movimiento.usuario_destino_display || '---'}</span></p>
                                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Observaciones: <span className="text-gray-800 dark:text-slate-100 font-semibold">{movimiento.observacion || 'Sin observaciones'}</span></p>

                                    {adjuntosMovimiento.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-2 mt-3">
                                            {adjuntosMovimiento.map((adjunto, adjuntoIndex) => {
                                                const urlAdjunto = obtenerUrlAdjunto(adjunto);
                                                if (!urlAdjunto) return null;

                                                return (
                                                    <button
                                                        key={adjunto.id || adjuntoIndex}
                                                        type="button"
                                                        onClick={() => descargarAdjunto(adjunto)}
                                                        className="inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30 hover:bg-green-100 dark:hover:bg-green-500/20 text-xs font-semibold px-3 py-1.5 rounded-full transition"
                                                    >
                                                        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                                                        Descargar
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                </div>
            </div>
        </div>
    )
}

export default DetailExpedientes;
