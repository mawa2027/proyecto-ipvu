import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ClockIcon, EyeIcon, ClipboardDocumentListIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import AdminQuickLinks from '../AdminQuickLinks';
import Paginacion from '../../Paginacion/Paginacion';
import { usePaginacion } from '../../../hooks/usePaginacion';
import { auditoriaService } from '../../../services/auditoria/auditoria';
import { usuarioService } from '../../../services/usuarios/usuarios';

// etiquetas legibles de cada rol y color del badge
const ROLES = {
    SU: { label: 'Superadmin', badge: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' },
    DE: { label: 'Data Entry', badge: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' },
    TS: { label: 'Trabajador Social', badge: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' },
    LG: { label: 'Legales', badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' },
};

const FILTROS_VACIOS = { q: '', usuario: '', rol: '', desde: '', hasta: '' };

const formatearFechaHora = (fecha) => {
    if (!fecha) return '---';
    return new Date(fecha).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
};

const Auditoria = () => {
    const [acciones, setAcciones] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [filtros, setFiltros] = useState(FILTROS_VACIOS);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);

    // lista de usuarios para el desplegable de filtro (solo la ve el superadmin)
    useEffect(() => {
        usuarioService.getUsuarios()
            .then((data) => setUsuarios(Array.isArray(data) ? data : []))
            .catch(() => setUsuarios([]));
    }, []);

    // cada vez que cambia un filtro se vuelve a pedir la auditoria. El texto se espera 400ms para no
    // disparar una consulta por cada tecla.
    useEffect(() => {
        let activo = true;
        const espera = setTimeout(async () => {
            setCargando(true);
            setError(null);
            try {
                const data = await auditoriaService.getHistorialAcciones(filtros);
                if (activo) setAcciones(data);
            } catch (err) {
                console.error('Error al obtener la auditoría:', err);
                if (activo) setError('No se pudo cargar la auditoría. Intentá de nuevo.');
            } finally {
                if (activo) setCargando(false);
            }
        }, 400);

        return () => {
            activo = false;
            clearTimeout(espera);
        };
    }, [filtros]);

    const { paginaActual, setPaginaActual, totalPaginas, itemsPaginados, totalItems, itemsPorPagina } =
        usePaginacion(acciones);

    const hayFiltros = useMemo(
        () => Object.values(filtros).some((v) => String(v).trim() !== ''),
        [filtros]
    );

    const cambiar = (campo) => (e) => setFiltros((prev) => ({ ...prev, [campo]: e.target.value }));

    const claseInput = "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 " +
        "bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 " +
        "focus:ring-blue-400 focus:border-blue-400 transition";

    return (
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
            <AdminQuickLinks excludePaths={["/auditoria"]} />

            <div>
                <h2 className="text-gray-800 dark:text-slate-100 font-bold text-xl flex items-center gap-2">
                    <ClipboardDocumentListIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    Auditoría del sistema
                </h2>
                <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">
                    Todos los movimientos de todos los usuarios, del más reciente al más antiguo.
                </p>
            </div>

            {/* FILTROS */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="lg:col-span-3 relative">
                        <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar en la descripción (ej: Login, Cambio de estado, DOWNLOAD...)"
                            value={filtros.q}
                            onChange={cambiar('q')}
                            className={claseInput + ' pl-9'}
                        />
                    </div>

                    <select value={filtros.usuario} onChange={cambiar('usuario')} className={claseInput}>
                        <option value="">Todos los usuarios</option>
                        {usuarios.map((u) => (
                            <option key={u.id} value={u.id}>{u.nombre_completo}</option>
                        ))}
                    </select>

                    <select value={filtros.rol} onChange={cambiar('rol')} className={claseInput}>
                        <option value="">Todos los roles</option>
                        {Object.entries(ROLES).map(([codigo, { label }]) => (
                            <option key={codigo} value={codigo}>{label}</option>
                        ))}
                    </select>

                    <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 dark:text-slate-400 shrink-0">Desde</label>
                        <input type="date" value={filtros.desde} onChange={cambiar('desde')} className={claseInput} />
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 dark:text-slate-400 shrink-0">Hasta</label>
                        <input type="date" value={filtros.hasta} onChange={cambiar('hasta')} className={claseInput} />
                    </div>

                    <button
                        type="button"
                        onClick={() => setFiltros(FILTROS_VACIOS)}
                        disabled={!hayFiltros}
                        className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        Limpiar filtros
                    </button>
                </div>
            </div>

            {/* RESULTADOS */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                {!cargando && !error && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">
                        {totalItems} {totalItems === 1 ? 'movimiento' : 'movimientos'}
                        {hayFiltros ? ' (filtrados)' : ''}
                    </p>
                )}

                {cargando ? (
                    <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">Cargando auditoría...</div>
                ) : error ? (
                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                ) : itemsPaginados.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 dark:text-slate-500 font-medium">
                        No hay movimientos para los filtros elegidos.
                    </div>
                ) : (
                    <div className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800 border-t border-gray-100 dark:border-slate-800">
                        {itemsPaginados.map((accion) => {
                            const rol = ROLES[accion.rol_display];
                            return (
                                <div
                                    key={accion.id}
                                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-4 px-1 hover:bg-gray-50/80 dark:hover:bg-slate-800/60 transition"
                                >
                                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-slate-400 sm:w-36 shrink-0">
                                        <ClockIcon className="w-4 h-4 shrink-0" />
                                        {formatearFechaHora(accion.fecha_accion)}
                                    </div>

                                    <div className="flex items-center gap-2 sm:w-52 shrink-0">
                                        <span className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">
                                            {accion.usuario_display}
                                        </span>
                                        {rol && (
                                            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${rol.badge}`}>
                                                {rol.label}
                                            </span>
                                        )}
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
                                            Expediente #{accion.id_expediente}
                                        </Link>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {!cargando && !error && (
                    <Paginacion
                        paginaActual={paginaActual}
                        totalPaginas={totalPaginas}
                        onCambiarPagina={setPaginaActual}
                        totalItems={totalItems}
                        itemsPorPagina={itemsPorPagina}
                    />
                )}
            </div>
        </div>
    );
};

export default Auditoria;
