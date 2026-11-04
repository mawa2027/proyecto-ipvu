import { useEffect, useRef, useState } from "react";
import { BellIcon } from "@heroicons/react/24/outline";
import { notificacionService } from "../../services/notificaciones/notificaciones";

// Campanita de la data entry: avisos de a quién quedó asignado cada expediente que cargó.
const NotificacionesDataEntry = () => {
    const [notificaciones, setNotificaciones] = useState([]);
    const [abierto, setAbierto] = useState(false);
    const contenedorRef = useRef(null);

    const cargar = async () => {
        try {
            setNotificaciones(await notificacionService.obtenerMias());
        } catch (error) {
            console.error("Error al cargar notificaciones:", error);
        }
    };

    useEffect(() => {
        cargar();
    }, []);

    // cerrar el panel al hacer click afuera
    useEffect(() => {
        if (!abierto) return;
        const cerrarSiEsAfuera = (evento) => {
            if (contenedorRef.current && !contenedorRef.current.contains(evento.target)) {
                setAbierto(false);
            }
        };
        document.addEventListener("mousedown", cerrarSiEsAfuera);
        return () => document.removeEventListener("mousedown", cerrarSiEsAfuera);
    }, [abierto]);

    const noLeidas = notificaciones.filter((notif) => !notif.leida);

    const alternar = async () => {
        const abrir = !abierto;
        setAbierto(abrir);
        if (!abrir) return;

        await cargar();
        // al abrir el panel se dan por vistas
        if (noLeidas.length > 0) {
            await Promise.allSettled(noLeidas.map((notif) => notificacionService.marcarLeida(notif.id)));
            setNotificaciones((actuales) => actuales.map((notif) => ({ ...notif, leida: true })));
        }
    };

    return (
        <div className="relative" ref={contenedorRef}>
            <button
                onClick={alternar}
                title="Notificaciones"
                className="relative flex items-center justify-center w-9 h-9 rounded-lg text-white/90 hover:bg-white/15 transition-colors focus:outline-none"
            >
                <BellIcon className="w-5 h-5" />
                {noLeidas.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                        {noLeidas.length}
                    </span>
                )}
            </button>

            {abierto && (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
                    <p className="px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-slate-100 border-b border-gray-100 dark:border-slate-700">
                        Notificaciones
                    </p>
                    {notificaciones.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-center text-gray-500 dark:text-slate-400">
                            No hay notificaciones
                        </p>
                    ) : (
                        notificaciones.map((notif) => (
                            <div key={notif.id} className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 last:border-b-0">
                                <p className="text-sm text-gray-700 dark:text-slate-200">{notif.mensaje}</p>
                                <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                                    {new Date(notif.fecha_creacion).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificacionesDataEntry;
