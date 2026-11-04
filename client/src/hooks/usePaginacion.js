import { useEffect, useMemo, useState } from 'react';

export const ITEMS_POR_PAGINA_DEFAULT = 10;

// Recibe la lista YA filtrada/buscada (no la lista paginada) para que la
// búsqueda siempre corra sobre el set completo de datos, sin importar en
// qué página esté parado el usuario.
export const usePaginacion = (items = [], itemsPorPagina = ITEMS_POR_PAGINA_DEFAULT) => {
    const [paginaActual, setPaginaActual] = useState(1);

    // Si cambia el resultado filtrado (búsqueda, filtros, orden, recarga de
    // datos) volvemos a la página 1 para no quedar "varados" en una página
    // que ya no tiene sentido para el nuevo resultado.
    useEffect(() => {
        setPaginaActual(1);
    }, [items]);

    const totalPaginas = Math.max(1, Math.ceil(items.length / itemsPorPagina));

    const itemsPaginados = useMemo(() => {
        const inicio = (paginaActual - 1) * itemsPorPagina;
        return items.slice(inicio, inicio + itemsPorPagina);
    }, [items, paginaActual, itemsPorPagina]);

    return {
        paginaActual,
        setPaginaActual,
        totalPaginas,
        itemsPaginados,
        totalItems: items.length,
        itemsPorPagina
    };
};
