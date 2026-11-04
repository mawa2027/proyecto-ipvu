import React, { useCallback, useEffect, useRef, useState } from 'react'
import { SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { expedienteService } from '../../services/expedientes/expediente';

// colores y textos de cada estado que devuelve el microservicio de IA
const SEMAFOROS = {
    VERDE: {
        titulo: 'Semáforo verde',
        texto: 'No se encontraron inconsistencias entre la DDJJ y el informe.',
        luz: 'bg-green-500',
        caja: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-800 dark:text-green-400',
    },
    AMARILLO: {
        titulo: 'Semáforo amarillo',
        texto: 'Hay diferencias para revisar entre la DDJJ y el informe.',
        luz: 'bg-yellow-400',
        caja: 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30 text-yellow-800 dark:text-yellow-300',
    },
    ROJO: {
        titulo: 'Semáforo rojo',
        texto: 'Hay inconsistencias importantes entre la DDJJ y el informe.',
        luz: 'bg-red-500',
        caja: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-400',
    },
};

const SEVERIDADES = {
    ALTA: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300',
    MEDIA: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-300',
    BAJA: 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300',
};

export const SemaforoInconsistencias = ({ expedienteId }) => {
    const [resultado, setResultado] = useState(null);
    const [evaluando, setEvaluando] = useState(true);
    const [error, setError] = useState(null);
    // expediente que ya se cargo al abrirlo: en desarrollo StrictMode corre los efectos dos veces y
    // sin esto se le podria pedir el semaforo dos veces a la IA (y quedarian dos registros en la auditoria)
    const evaluadoAlAbrir = useRef(null);

    const handleEvaluar = useCallback(async () => {
        setEvaluando(true);
        setError(null);
        try {
            const data = await expedienteService.evaluarSemaforo(expedienteId);
            setResultado(data);
        } catch (err) {
            console.error('Error al evaluar inconsistencias:', err);
            setError(err.response?.data?.error || 'No se pudo evaluar el expediente. Intentá de nuevo.');
        } finally {
            setEvaluando(false);
        }
    }, [expedienteId]);

    // al abrir el detalle se muestra el ultimo semaforo guardado; si no hay (nunca se evaluo, o se edito
    // el formulario o el titular despues) se evalua solo. El boton queda para volver a evaluar.
    useEffect(() => {
        if (evaluadoAlAbrir.current === expedienteId) return;
        evaluadoAlAbrir.current = expedienteId;

        const cargarGuardado = async () => {
            try {
                const guardado = await expedienteService.obtenerSemaforo(expedienteId);
                if (guardado) {
                    setResultado(guardado);
                    setEvaluando(false);
                    return;
                }
            } catch (err) {
                console.error('Error al obtener el semáforo guardado:', err);
            }
            handleEvaluar();
        };
        cargarGuardado();
    }, [expedienteId, handleEvaluar]);

    const semaforo = resultado ? SEMAFOROS[resultado.semaforo] : null;

    return (
        <div className="mt-5 bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700 rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h4 className="text-gray-800 dark:text-slate-100 font-bold text-base flex items-center gap-1.5">
                        <SparklesIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        Control de inconsistencias
                    </h4>
                    <p className="text-gray-600 dark:text-slate-400 text-sm">
                        La IA compara la DDJJ del titular con el informe socio-habitacional.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleEvaluar}
                    disabled={evaluando}
                    className="inline-flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 border border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-60 disabled:cursor-wait font-semibold text-sm px-4 py-1.5 h-9 rounded-lg transition w-full sm:w-auto whitespace-nowrap"
                >
                    {evaluando && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                    {evaluando ? 'Evaluando...' : 'Volver a evaluar'}
                </button>
            </div>

            {evaluando && (
                <p className="mt-3 text-gray-500 dark:text-slate-400 text-xs">
                    Si el servicio de IA estaba inactivo puede tardar hasta un minuto en responder.
                </p>
            )}

            {error && (
                <div className="mt-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {semaforo && !evaluando && (
                <div className="mt-4 flex flex-col gap-3">
                    <div className={`flex items-center gap-3 border rounded-lg px-4 py-3 ${semaforo.caja}`}>
                        <span className={`w-4 h-4 rounded-full shrink-0 ${semaforo.luz}`} />
                        <div>
                            <p className="font-bold text-sm">
                                {semaforo.titulo}
                                {resultado.total_inconsistencias > 0 && ` · ${resultado.total_inconsistencias} ${resultado.total_inconsistencias === 1 ? 'inconsistencia' : 'inconsistencias'}`}
                            </p>
                            <p className="text-sm">{semaforo.texto}</p>
                            {resultado.fecha_evaluacion && (
                                <p className="text-xs opacity-75 mt-1">
                                    Evaluado el {new Date(resultado.fecha_evaluacion).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                                </p>
                            )}
                        </div>
                    </div>

                    {resultado.inconsistencias.map((inconsistencia, index) => (
                        <div key={index} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-gray-800 dark:text-slate-100 text-sm font-semibold">{inconsistencia.descripcion}</p>
                                {inconsistencia.severidad && (
                                    <span className={`shrink-0 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${SEVERIDADES[inconsistencia.severidad] || SEVERIDADES.BAJA}`}>
                                        {inconsistencia.severidad}
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                <div>
                                    <p className="text-gray-500 dark:text-slate-400 text-xs">En la DDJJ</p>
                                    <p className="text-gray-800 dark:text-slate-100 text-sm">{inconsistencia.valor_ddjj || '---'}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 dark:text-slate-400 text-xs">En el informe</p>
                                    <p className="text-gray-800 dark:text-slate-100 text-sm">{inconsistencia.valor_informe || '---'}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
