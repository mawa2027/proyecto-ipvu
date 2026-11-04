
const Form2 = () => {



  return (
    <div className="flex items-center justify-center p-4 py-8">

      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 shadow-lg dark:shadow-black/30 border border-transparent dark:border-slate-800 rounded-2xl p-6 md:p-10 transition-colors">

        <div className="mb-6 text-center">
          <h2 className="text-gray-800 dark:text-slate-100 font-bold text-lg md:text-xl tracking-tight">
            INSTITUTO PROVINCIAL DE VIVIENDA Y URBANISMO
          </h2>
          <h2 className="text-gray-800 dark:text-slate-100 font-bold text-lg md:text-xl tracking-tight">
            MINISTERIO DE OBRAS Y SERVICIOS PÚBLICOS
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <p className="text-gray-800 dark:text-slate-100 font-semibold text-base md:col-span-2">
            Santiago del Estero
          </p>

          <label className="font-semibold text-gray-700 dark:text-slate-300">Fecha:</label>
          <input
            type="text"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200"
          />

          <label className="font-semibold text-gray-700 dark:text-slate-300">Señor:</label>
          <input
            type="text"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200"
          />

          <label className="font-semibold text-gray-700 dark:text-slate-300">Domicilio:</label>
          <input
            type="text"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200"
          />

          <label className="font-semibold text-gray-700 dark:text-slate-300 md:col-span-2">
            El Instituto Provincial de Vivienda y Urbanismo (I.P.V.U) informa a Ud. que a fin de proseguir con el trámite de Ficha N°
          </label>
          <input
            type="text"
            className="w-full md:col-span-2 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200"
          />
        </div>

        <div className="mt-10">
          <h4 className="text-gray-800 dark:text-slate-100 font-semibold text-base uppercase">
            Todas las fotocopias deberán ser autenticadas por la policía
          </h4>
          <p className="text-gray-700 dark:text-slate-300 font-serif text-sm mt-1">
            Fotocopias de Documento de Identidad 1° y 2° hoja y de todo el grupo familiar.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-1 gap-4">

          <button className="w-full sm:w-auto max-w-[180px] mx-auto sm:mx-0 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow-sm transition duration-200">
            Subir archivo
          </button>

        </div>
      </div>
    </div>
  );
};

export default Form2;