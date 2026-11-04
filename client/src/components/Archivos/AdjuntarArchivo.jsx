import React, { useEffect, useRef, useState } from 'react';
import { TrashIcon, DocumentTextIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { documentoAdjuntoService } from '../../services/documentos/documentoAdjunto';

export const AdjuntarArchivos = ({ expedienteId, adjuntosExcluidos = [], onArchivosChange }) => {
  const [archivos, setArchivos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const obtenerClaveAdjunto = (archivo) => {
    return String(
      archivo?.id ||
      archivo?.archivo_url ||
      archivo?.archivo ||
      archivo?.url ||
      archivo?.tipo_documento ||
      ''
    );
  };

  useEffect(() => {
    const obtenerAdjuntosPendientes = async () => {
      if (!expedienteId) return;

      try {
        setCargando(true);
        setError('');
        const documentos = await documentoAdjuntoService.obtenerPorExpediente(expedienteId);
        const clavesExcluidas = new Set(adjuntosExcluidos.map(obtenerClaveAdjunto).filter(Boolean));
        const documentosPendientes = documentos.filter(
          (documento) => !clavesExcluidas.has(obtenerClaveAdjunto(documento))
        );
        setArchivos(documentosPendientes);
        onArchivosChange?.(documentosPendientes);
      } catch (error) {
        console.error('Error al obtener documentos adjuntos:', error);
        setError('No se pudieron cargar los archivos adjuntos.');
      } finally {
        setCargando(false);
      }
    };

    obtenerAdjuntosPendientes();
  }, [expedienteId, adjuntosExcluidos, onArchivosChange]);

  const handleFileChange = async (e) => {
    const seleccionados = Array.from(e.target.files);
    if (seleccionados.length === 0 || !expedienteId) return;

    try {
      setSubiendo(true);
      setError('');
      const documentosSubidos = await Promise.all(
        seleccionados.map((archivo) =>
          documentoAdjuntoService.crear({ expedienteId, archivo })
        )
      );
      const nuevosArchivos = [...archivos, ...documentosSubidos];
      setArchivos(nuevosArchivos);
      onArchivosChange?.(nuevosArchivos);
    } catch (error) {
      console.error('Error al subir documentos adjuntos:', error);
      setError('No se pudo subir uno de los archivos. Intenta nuevamente.');
    } finally {
      setSubiendo(false);
      e.target.value = '';
    }
  };

  const abrirArchivo = async (documentoId) => {
    try {
      setError('');
      await documentoAdjuntoService.abrirEnPestania(documentoId);
    } catch (error) {
      console.error('Error al abrir documento adjunto:', error);
      setError('No se pudo abrir el archivo adjunto.');
    }
  };

  const removerArchivo = async (documentoId) => {
    if (!documentoId) return;

    try {
      setEliminandoId(documentoId);
      setError('');
      await documentoAdjuntoService.eliminar(documentoId);
      const filtrados = archivos.filter((archivo) => archivo.id !== documentoId);
      setArchivos(filtrados);
      onArchivosChange?.(filtrados);
    } catch (error) {
      console.error('Error al eliminar documento adjunto:', error);
      setError('No se pudo eliminar el archivo adjunto.');
    } finally {
      setEliminandoId(null);
    }
  };

  const obtenerNombreArchivo = (archivo) => {
    const nombreDesdeUrl = archivo.archivo?.split('/').pop() || archivo.archivo_url?.split('/').pop();
    return archivo.tipo_documento || nombreDesdeUrl || 'Archivo adjunto';
  };

  const archivoEsPdf = (archivo) => obtenerNombreArchivo(archivo).toLowerCase().endsWith('.pdf');

  return (
    <div className="w-full pt-1">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current.click()}
          disabled={subiendo || !expedienteId}
          className="whitespace-nowrap px-4 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors h-9 inline-flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {subiendo ? 'Subiendo...' : 'Adjuntar archivo'}
        </button>
        <span className="text-xs font-medium text-gray-500 pl-1 sm:pl-0">
          {cargando
            ? 'Cargando archivos...'
            : archivos.length === 0
              ? 'Ningun archivo adjunto'
              : `${archivos.length} archivo(s) adjunto(s)`}
        </span>
      </div>

      {error && (
        <p className="text-xs text-red-600 font-semibold mt-2">{error}</p>
      )}

      {archivos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 bg-gray-50/60 p-2.5 rounded-xl border border-gray-100">
          {archivos.map((archivo) => {
            const nombreArchivo = obtenerNombreArchivo(archivo);
            const estaEliminando = eliminandoId === archivo.id;

            return (
              <div
                key={archivo.id}
                className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200/80 shadow-sm text-sm"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  {archivoEsPdf(archivo) ? (
                    <DocumentTextIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                  ) : (
                    <PhotoIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                  )}
                  <button
                    type="button"
                    onClick={() => abrirArchivo(archivo.id)}
                    className="truncate font-medium text-gray-700 hover:text-blue-600 text-left"
                    title={nombreArchivo}
                  >
                    {nombreArchivo}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => removerArchivo(archivo.id)}
                  disabled={estaEliminando}
                  className="p-1 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Eliminar archivo adjunto"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
