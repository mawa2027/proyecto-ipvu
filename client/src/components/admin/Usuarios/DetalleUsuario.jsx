import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
    ArrowLeftIcon,
    BriefcaseIcon,
    ArrowPathIcon,
    EyeIcon,
    ClipboardDocumentListIcon,
    ClockIcon
} from '@heroicons/react/24/outline';
import { usuarioService } from '../../../services/usuarios/usuarios';
import { auditoriaService } from '../../../services/auditoria/auditoria';
import { historial } from '../../../services/historial/historial';
import { usePaginacion } from '../../../hooks/usePaginacion';
import Paginacion from '../../Paginacion/Paginacion';

const CONFIG_ESTADOS = {
    SINI: { texto: 'Sin Iniciar', color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600' },
    '1V': { texto: '1ra Visita', color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30' },
    LEG: { texto: 'Legales', color: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30' },
    DOCP: { texto: 'Doc Presentada', color: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30' },
    AP: { texto: 'Apto', color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30' },
    NOAP: { texto: 'No Apto', color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30' },
    NUEVAV: { texto: 'Nueva Visita', color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30' }
};

const ESTADOS_EN_EJECUCION = ['SINI', '1V', 'LEG', 'DOCP', 'NUEVAV'];

const obtenerCodigoEstado = (expediente) => {
    if (!expediente?.estado_expediente) return null;
    if (typeof expediente.estado_expediente === 'string') return expediente.estado_expediente;
    return expediente.estado_expediente.nombre;
};

const formatearFechaHora = (fecha) => {
    if (!fecha) return '---';
    return new Date(fecha).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const DetalleUsuario = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const rolId = Number(localStorage.getItem('rol_id'));
    const esSuperUsuario = rolId === 4;

    const [usuario, setUsuario] = useState(null);
    const [expedientes, setExpedientes] = useState([]);
    const [expedientesPorId, setExpedientesPorId] = useState(new Map());
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);

    const [vista, setVista] = useState('expedientes');
    const [auditorias, setAuditorias] = useState([]);
    const [auditoriaCargada, setAuditoriaCargada] = useState(false);
    const [cargandoAuditoria, setCargandoAuditoria] = useState(false);
    const [errorAuditoria, setErrorAuditoria] = useState(null);

    useEffect(() => {
        const cargarDetalle = async () => {
            try {
                setCargando(true);
                setError(null);

                const perfil = await usuarioService.getUsuario(id);
                const usuarioId = perfil.usuario ?? perfil.id;

                const [
                    expedientesAsignadosResult,
                    todosLosExpedientesResult,
                    pasesDelUsuarioResult
                ] = await Promise.allSettled([
                    auditoriaService.getExpedientePorTS(perfil),
                    auditoriaService.getExpedientes(),
                    historial.obtenerPasesPorUsuario(usuarioId)
                ]);

                const expedientesAsignados = expedientesAsignadosResult.status === 'fulfilled'
                    ? expedientesAsignadosResult.value
                    : [];
                const todosLosExpedientes = todosLosExpedientesResult.status === 'fulfilled'
                    ? todosLosExpedientesResult.value
                    : expedientesAsignados;
                const pasesDelUsuario = pasesDelUsuarioResult.status === 'fulfilled'
                    ? pasesDelUsuarioResult.value
                    : [];

                const idsTrabajados = new Set([
                    ...expedientesAsignados.map((exp) => exp.id),
                    ...pasesDelUsuario.map((pase) => Number(pase.expediente))
                ]);

                const expedientesTrabajados = todosLosExpedientes.filter((exp) => idsTrabajados.has(Number(exp.id)));

                setUsuario(perfil);
                setExpedientes(expedientesTrabajados.length > 0 ? expedientesTrabajados : expedientesAsignados);
                setExpedientesPorId(new Map(todosLosExpedientes.map((exp) => [Number(exp.id), exp])));
            } catch (err) {
                console.error(err);
                setError("No se pudo cargar el detalle del usuario.");
            } finally {
                setCargando(false);
            }
        };

        if (id) {
            cargarDetalle();
        } else {
            setError("No se indicó un usuario para consultar.");
            setCargando(false);
        }
    }, [id]);

    const metricas = useMemo(() => {
        return {
            total: expedientes.length,
            vistos: expedientes.filter((exp) => exp.visto).length,
            enEjecucion: expedientes.filter((exp) => ESTADOS_EN_EJECUCION.includes(obtenerCodigoEstado(exp))).length
        };
    }, [expedientes]);

    const {
        paginaActual: paginaExpedientes,
        setPaginaActual: setPaginaExpedientes,
        totalPaginas: totalPaginasExpedientes,
        itemsPaginados: expedientesPaginados,
        totalItems: totalExpedientes
    } = usePaginacion(expedientes);

    const {
        paginaActual: paginaAuditorias,
        setPaginaActual: setPaginaAuditorias,
        totalPaginas: totalPaginasAuditorias,
        itemsPaginados: auditoriasPaginadas,
        totalItems: totalAuditorias
    } = usePaginacion(auditorias);

    const handleVerAuditoria = async () => {
        setVista('auditoria');

        if (auditoriaCargada || !usuario) return;

        try {
            setCargandoAuditoria(true);
            setErrorAuditoria(null);

            const todasLasAcciones = await auditoriaService.getHistorialAcciones();
            const idPerfil = usuario.id;

            const propias = todasLasAcciones
                .filter((accion) => Number(accion.id_usuario_accion) === Number(idPerfil))
                .sort((a, b) => new Date(b.fecha_accion) - new Date(a.fecha_accion));

            setAuditorias(propias);
            setAuditoriaCargada(true);
        } catch (err) {
            console.error(err);
            setErrorAuditoria("No se pudo cargar la auditoría de este usuario.");
        } finally {
            setCargandoAuditoria(false);
        }
    };

    if (cargando) {
        return (
            <div className="w-full flex justify-center items-center py-24">
                <p className="text-gray-600 dark:text-slate-300 font-medium">Cargando detalle del usuario...</p>
            </div>
        );
    }

    if (error || !usuario) {
        return (
            <div className="w-full flex justify-center items-center p-4 py-24">
                <div className="bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 p-4 rounded-xl max-w-md text-center font-medium shadow-sm">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col items-center p-4 py-8 md:p-8">
            <div className="w-full max-w-6xl flex flex-col gap-6">
                <div>
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold transition group"
                    >
                        <ArrowLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                        <span>Volver</span>
                    </button>
                </div>

                <div className="w-full bg-white dark:bg-slate-900 shadow-sm dark:shadow-black/30 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-2xl shadow-inner">
                            {usuario.nombre?.[0]}{usuario.apellido?.[0]}
                        </div>
                        <div>
                            <h2 className="text-gray-800 dark:text-slate-100 font-black text-2xl capitalize">
                                {`${usuario.apellido} ${usuario.nombre}`}
                            </h2>
                            <p className="text-gray-500 dark:text-slate-400 font-mono text-sm">Matrícula: {usuario.matricula || "---"}</p>
                            <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">DNI: {usuario.dni || "---"} | {usuario.email || "---"}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between transition-colors">
                        <div>
                            <p className="text-gray-400 dark:text-slate-500 font-semibold text-xs uppercase tracking-wider">Casos totales</p>
                            <h4 className="text-gray-800 dark:text-slate-100 font-black text-3xl mt-1">{metricas.total}</h4>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400"><BriefcaseIcon className="w-6 h-6" /></div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between transition-colors">
                        <div>
                            <p className="text-gray-400 dark:text-slate-500 font-semibold text-xs uppercase tracking-wider">En ejecución</p>
                            <h4 className="text-orange-600 dark:text-orange-400 font-black text-3xl mt-1">{metricas.enEjecucion}</h4>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-500/10 rounded-xl text-orange-600 dark:text-orange-400"><ArrowPathIcon className="w-6 h-6" /></div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between transition-colors">
                        <div>
                            <p className="text-gray-400 dark:text-slate-500 font-semibold text-xs uppercase tracking-wider">Vistos</p>
                            <h4 className="text-green-600 dark:text-green-400 font-black text-3xl mt-1">{metricas.vistos}</h4>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-500/10 rounded-xl text-green-600 dark:text-green-400"><EyeIcon className="w-6 h-6" /></div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm rounded-2xl p-4 sm:p-6 transition-colors">
                    <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                        <h3 className="text-gray-800 dark:text-slate-100 font-bold text-lg">
                            {vista === 'auditoria' ? 'Auditoría del usuario' : 'Expedientes'}
                        </h3>

                        {esSuperUsuario && (
                            <button
                                type="button"
                                onClick={() => (vista === 'auditoria' ? setVista('expedientes') : handleVerAuditoria())}
                                className="inline-flex items-center gap-2 text-sm font-semibold px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white transition shrink-0"
                            >
                                {vista === 'auditoria' ? (
                                    <>
                                        <BriefcaseIcon className="w-4 h-4" />
                                        Ver expedientes
                                    </>
                                ) : (
                                    <>
                                        <ClipboardDocumentListIcon className="w-4 h-4" />
                                        Ver auditoría
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {vista === 'expedientes' ? (
                        <>
                            <div className="overflow-x-auto">
                                <div className="grid grid-cols-6 gap-2 min-w-[980px] bg-gray-50 dark:bg-slate-800 p-3 rounded-xl text-gray-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
                                    <span>DD.JJ</span>
                                    <span>Titular</span>
                                    <span>DNI</span>
                                    <span>Estado</span>
                                    <span>Fecha</span>
                                    <span>Acción</span>
                                </div>

                                {expedientesPaginados.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 dark:text-slate-500 font-medium">
                                        No posee expedientes asignados actualmente.
                                    </div>
                                ) : (
                                    expedientesPaginados.map((exp) => {
                                        const codEstado = obtenerCodigoEstado(exp);
                                        const configEst = CONFIG_ESTADOS[codEstado] || { texto: codEstado || 'Sin estado', color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600' };
                                        const titular = exp.postulante_titular;
                                        const fecha = exp.fecha_creacion ? new Date(exp.fecha_creacion).toLocaleDateString('es-AR') : '---';

                                        return (
                                            <div
                                                key={exp.id}
                                                className="grid grid-cols-6 gap-2 items-center w-full min-w-[980px] text-left p-4 border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50/80 dark:hover:bg-slate-800/60 transition text-sm"
                                            >
                                                <span className="font-bold text-gray-800 dark:text-slate-100">{exp.DDJJ || `#${exp.id}`}</span>
                                                <span className="text-gray-600 dark:text-slate-300 capitalize">{titular ? `${titular.apellido} ${titular.nombre}` : 'Sin titular'}</span>
                                                <span className="text-gray-500 dark:text-slate-400 font-mono">{titular?.dni || '---'}</span>
                                                <span>
                                                    <span className={`px-2.5 py-1 text-xs rounded-full border font-bold ${configEst.color}`}>
                                                        {configEst.texto}
                                                    </span>
                                                </span>
                                                <span className="text-gray-500 dark:text-slate-400">{fecha}</span>
                                                <Link
                                                    to={`/Expediente/${exp.id}`}
                                                    className="inline-flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium w-max"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                    Ver expediente
                                                </Link>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <Paginacion
                                paginaActual={paginaExpedientes}
                                totalPaginas={totalPaginasExpedientes}
                                onCambiarPagina={setPaginaExpedientes}
                                totalItems={totalExpedientes}
                            />
                        </>
                    ) : (
                        <>
                            {cargandoAuditoria ? (
                                <div className="text-center py-10 text-gray-500 dark:text-slate-400 font-medium animate-pulse">
                                    Cargando auditoría del usuario...
                                </div>
                            ) : errorAuditoria ? (
                                <div className="text-center py-8 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20 text-sm">
                                    {errorAuditoria}
                                </div>
                            ) : auditoriasPaginadas.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 dark:text-slate-500 font-medium">
                                    Este usuario no registra actividad en el sistema.
                                </div>
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800 border-t border-gray-100 dark:border-slate-800">
                                    {auditoriasPaginadas.map((accion) => {
                                        const expedienteRelacionado = accion.id_expediente
                                            ? expedientesPorId.get(Number(accion.id_expediente))
                                            : null;

                                        return (
                                            <div
                                                key={accion.id}
                                                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-4 px-1 hover:bg-gray-50/80 dark:hover:bg-slate-800/60 transition"
                                            >
                                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-slate-400 sm:w-40 shrink-0">
                                                    <ClockIcon className="w-4 h-4 shrink-0" />
                                                    {formatearFechaHora(accion.fecha_accion)}
                                                </div>

                                                <p className="flex-1 text-sm text-gray-700 dark:text-slate-200 break-words">
                                                    {accion.mensaje_accion}
                                                </p>

                                                {accion.id_expediente && (
                                                    <Link
                                                        to={`/Expediente/${accion.id_expediente}`}
                                                        className="inline-flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium w-max shrink-0"
                                                    >
                                                        <EyeIcon className="w-4 h-4" />
                                                        {expedienteRelacionado?.DDJJ || `Expediente #${accion.id_expediente}`}
                                                    </Link>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {!cargandoAuditoria && !errorAuditoria && (
                                <Paginacion
                                    paginaActual={paginaAuditorias}
                                    totalPaginas={totalPaginasAuditorias}
                                    onCambiarPagina={setPaginaAuditorias}
                                    totalItems={totalAuditorias}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DetalleUsuario;
