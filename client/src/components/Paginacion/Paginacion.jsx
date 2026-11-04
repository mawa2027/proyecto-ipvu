import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const generarNumerosDePagina = (paginaActual, totalPaginas) => {
    const rango = [];
    const delta = 1;

    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        const esBorde = pagina === 1 || pagina === totalPaginas;
        const esCercana = Math.abs(pagina - paginaActual) <= delta;

        if (esBorde || esCercana) {
            rango.push(pagina);
        } else if (rango[rango.length - 1] !== '...') {
            rango.push('...');
        }
    }

    return rango;
};

const Paginacion = ({ paginaActual, totalPaginas, onCambiarPagina, totalItems = 0, itemsPorPagina = 10 }) => {
    if (totalPaginas <= 1) return null;

    const irAPagina = (pagina) => {
        if (pagina < 1 || pagina > totalPaginas || pagina === paginaActual) return;
        onCambiarPagina(pagina);
    };

    const inicio = (paginaActual - 1) * itemsPorPagina + 1;
    const fin = Math.min(paginaActual * itemsPorPagina, totalItems);
    const numeros = generarNumerosDePagina(paginaActual, totalPaginas);

    return (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
            <span className="text-sm text-gray-500 dark:text-slate-400">
                Mostrando {inicio}-{fin} de {totalItems}
            </span>

            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => irAPagina(paginaActual - 1)}
                    disabled={paginaActual === 1}
                    className="p-2 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition"
                    aria-label="Página anterior"
                >
                    <ChevronLeftIcon className="w-4 h-4" />
                </button>

                {numeros.map((pagina, idx) =>
                    pagina === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 dark:text-slate-500 select-none">
                            ...
                        </span>
                    ) : (
                        <button
                            key={pagina}
                            type="button"
                            onClick={() => irAPagina(pagina)}
                            className={`min-w-[36px] h-9 px-1 rounded-lg text-sm font-semibold transition ${pagina === paginaActual
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            {pagina}
                        </button>
                    )
                )}

                <button
                    type="button"
                    onClick={() => irAPagina(paginaActual + 1)}
                    disabled={paginaActual === totalPaginas}
                    className="p-2 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition"
                    aria-label="Página siguiente"
                >
                    <ChevronRightIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default Paginacion;
