import { UsersIcon } from '@heroicons/react/24/outline';
import React, { useEffect, useState } from 'react';
import { usuarioService } from '../../../services/usuarios/usuarios';
import { Link, useNavigate } from 'react-router';
import { auditoriaService } from '../../../services/auditoria/auditoria';
import AdminQuickLinks from '../AdminQuickLinks';
import { useToast } from '../../../context/ToastContext';
import { usePaginacion } from '../../../hooks/usePaginacion';
import Paginacion from '../../Paginacion/Paginacion';

const obtenerUsuarioId = (usuario) => Number(usuario?.usuario ?? usuario?.id);

const usuarioEsTS = (usuario) => usuario?.rol_display === 'TS';

const Usuarios = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const [listaUsuarios, setListaUsuarios] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);
    const [perfilSeleccionado, setPerfilSeleccionado] = useState('Todos');
    const [busqueda, setBusqueda] = useState('');

    console.log('listaUsuarios :>> ', listaUsuarios);

    useEffect(() => {
        const fetchUsuariosYCasos = async () => {
            try {
                setCargando(true);
                setError(null);

                const usuariosData = await usuarioService.getUsuarios();
                const auditoriaResult = await auditoriaService.getAuditoriaUsuarios()
                    .catch(() => null);

                let metricasPorPerfil = new Map();

                const auditoriaTieneVistos = auditoriaResult?.every((item) => item.total_vistos !== undefined);

                if (auditoriaResult && auditoriaTieneVistos) {
                    metricasPorPerfil = new Map(
                        auditoriaResult.map((item) => [
                            Number(item.usuario_id),
                            {
                                cantidad_casos: item.total_asignados ?? 0,
                                cantidad_vistos: item.total_vistos ?? 0
                            }
                        ])
                    );
                } else {
                    const expedientesData = await auditoriaService.getExpedientes()
                        .catch(() => []);

                    metricasPorPerfil = usuariosData.reduce((mapa, usuario) => {
                        const usuarioId = obtenerUsuarioId(usuario);
                        const casosAsignados = expedientesData.filter((exp) => Number(exp.usuario_asignado?.id) === usuarioId);

                        mapa.set(Number(usuario.id), {
                            cantidad_casos: casosAsignados.length,
                            cantidad_vistos: casosAsignados.filter((exp) => exp.visto).length
                        });

                        return mapa;
                    }, new Map());
                }

                const usuariosConCasos = usuariosData.map((usuario) => ({
                    ...usuario,
                    cantidad_casos: metricasPorPerfil.get(Number(usuario.id))?.cantidad_casos ?? 0,
                    cantidad_vistos: metricasPorPerfil.get(Number(usuario.id))?.cantidad_vistos ?? 0
                }));

                setListaUsuarios(usuariosConCasos);
            } catch (err) {
                console.error(err);
                setError("Ocurrió un error al cargar la lista de usuarios.");
            } finally {
                setCargando(false);
            }
        };

        fetchUsuariosYCasos();
    }, []);

    const handleToggleActivo = async (usuario) => {
        const nuevoEstado = !usuario.activo;

        setListaUsuarios((prev) =>
            prev.map((u) => (u.id === usuario.id ? { ...u, activo: nuevoEstado } : u))
        );

        try {
            await usuarioService.cambiarEstadoActivo(usuario.id, nuevoEstado);
        } catch (err) {
            console.error("No se pudo actualizar el estado del usuario", err);
            setListaUsuarios((prev) =>
                prev.map((u) => (u.id === usuario.id ? { ...u, activo: usuario.activo } : u))
            );
            toast.error("No se pudo actualizar el estado del usuario. Intentá nuevamente.");
        }
    };

    const usuariosFiltrados = listaUsuarios.filter((u) => {
        const pasaPerfil = perfilSeleccionado === 'Todos' || u.rol_display === perfilSeleccionado;
        const textoBusqueda = busqueda.toLowerCase();


        const pasaBusqueda =
            u.nombre?.toLowerCase().includes(textoBusqueda) ||
            u.apellido?.toLowerCase().includes(textoBusqueda) ||
            u.dni?.includes(textoBusqueda);

        return pasaPerfil && pasaBusqueda;
    });

    const { paginaActual, setPaginaActual, totalPaginas, itemsPaginados, totalItems } = usePaginacion(usuariosFiltrados);

    return (
        <div className="w-full flex justify-center items-start p-4 py-8">
            <div className="w-full max-w-6xl flex flex-col gap-4">

                <AdminQuickLinks excludePaths={["/usuarios"]} />

                <div className="w-full bg-white dark:bg-slate-900 shadow-lg dark:shadow-black/30 border border-transparent dark:border-slate-800 rounded-2xl p-6 md:p-10 transition-colors">

                    <div>
                        <h3 className="text-gray-800 dark:text-slate-100 font-bold text-xl">
                            Usuarios
                        </h3>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-100 dark:bg-slate-800 p-3 rounded-xl shadow-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition">
                            <select
                                value={perfilSeleccionado}
                                onChange={(e) => setPerfilSeleccionado(e.target.value)}
                                className="w-full bg-transparent outline-none text-gray-700 dark:text-slate-200 font-medium cursor-pointer pr-2"
                            >
                                <option className="text-gray-800" value="Todos">Todos los perfiles</option>
                                <option className="text-gray-800" value="SU">Administrador</option>
                                <option className="text-gray-800" value="TS">Trabajadora Social</option>
                                <option className="text-gray-800" value="DE">Administrativa</option>
                                <option className="text-gray-800" value="LG">Legales</option>
                            </select>
                        </div>

                        <div className="bg-gray-100 dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-transparent focus-within:border-gray-300 dark:focus-within:border-slate-600 transition">
                            <input
                                type="text"
                                placeholder="Buscar por nombre, apellido o DNI..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="w-full bg-transparent outline-none text-gray-700 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500"
                            />
                        </div>

                        <Link
                            to="/crearUsuario"
                            className="flex items-center justify-between bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl shadow-sm transition"
                        >
                            <span className="font-semibold">Crear nuevo usuario</span>
                            <UsersIcon className="w-5 h-5 text-blue-100" />
                        </Link>
                    </div>

                    <div className="mt-6 overflow-x-auto">

                        <div className="grid grid-cols-6 gap-2 min-w-[880px] bg-gray-100 dark:bg-slate-800 p-3 rounded-lg text-gray-700 dark:text-slate-300 font-semibold text-sm">
                            <span>Nombre</span>
                            <span>Perfil</span>
                            <span>DNI</span>
                            <span>Total</span>
                            <span>Vistos</span>
                            <span>Estado</span>
                        </div>


                        {cargando ? (
                            <div className="text-center p-8 text-gray-500 dark:text-slate-400 animate-pulse text-sm">
                                Cargando personal del IPVU...
                            </div>
                        ) : error ? (
                            <div className="text-center p-8 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20 text-sm mt-2">
                                {error}
                            </div>
                        ) : itemsPaginados.length === 0 ? (
                            <div className="text-center p-8 text-gray-400 dark:text-slate-500 text-sm">
                                No se encontraron usuarios con esos criterios.
                            </div>
                        ) : (
                            itemsPaginados.map((e) => (
                                <div
                                    key={e.id}
                                    onClick={() => navigate(`/DetalleUsuario/${e.id}`)}
                                    className={`grid grid-cols-6 gap-2 items-center w-full min-w-[880px] text-left p-4 border-b dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition cursor-pointer ${e.activo === false ? 'opacity-60' : ''}`}
                                >

                                    <span className="text-gray-700 dark:text-slate-300 capitalize">{`${e.apellido} ${e.nombre}`}</span>

                                    <span className="text-gray-700">
                                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold
                                                ${e.rol_display === 'TS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : ''}
                                                ${e.rol_display === 'SU' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300' : ''}
                                                ${e.rol_display === 'LG' ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' : ''}
                                                ${e.rol_display === 'DE' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : ''}
                                            `}>
                                            {e.rol_display === 'TS' && 'Trabajadora Social'}
                                            {e.rol_display === 'SU' && 'Administrador'}
                                            {e.rol_display === 'LG' && 'Legales'}
                                            {e.rol_display === 'DE' && 'Data Entry'}
                                        </span>
                                    </span>


                                    <span className="text-gray-700 dark:text-slate-300 font-mono">{e.dni || "---"}</span>


                                    <span className="text-gray-700 text-sm text-left">
                                        {usuarioEsTS(e) ? (
                                            <span className="bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-full text-xs font-semibold text-gray-600 dark:text-slate-300">
                                                {e.cantidad_casos ?? 0} expedientes
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 dark:text-slate-500 pl-4">-</span>
                                        )}
                                    </span>

                                    <span className="text-gray-700 text-sm text-left">
                                        {usuarioEsTS(e) ? (
                                            <span className="bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-full text-xs font-semibold text-green-700 dark:text-green-400">
                                                {e.cantidad_vistos ?? 0} vistos
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 dark:text-slate-500 pl-4">-</span>
                                        )}
                                    </span>

                                    <span>
                                        <button
                                            type="button"
                                            onClick={(ev) => {
                                                ev.stopPropagation();
                                                handleToggleActivo(e);
                                            }}
                                            className={`px-2.5 py-1 rounded-full text-xs font-bold border transition ${e.activo !== false
                                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30 dark:hover:bg-green-500/20'
                                                : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600 dark:hover:bg-slate-600'
                                                }`}
                                        >
                                            {e.activo !== false ? 'Activo' : 'Inactivo'}
                                        </button>
                                    </span>
                                </div>
                            ))
                        )}
                    </div>

                    {!cargando && !error && (
                        <Paginacion
                            paginaActual={paginaActual}
                            totalPaginas={totalPaginas}
                            onCambiarPagina={setPaginaActual}
                            totalItems={totalItems}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default Usuarios;
