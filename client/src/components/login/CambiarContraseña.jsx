import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router';
import { nuevaContraseña } from '../../services/authService/nuevaContraseña';
import useTemporaryPasswordReveal from '../../hooks/useTemporaryPasswordReveal.js';
import { useToast } from '../../context/ToastContext.jsx';

const LOGIN_BG_URL_SM = "https://res.cloudinary.com/dmgvv9nbt/image/upload/v1787791149/images_avzw0a.jpg";
const LOGIN_BG_URL_LG = "https://res.cloudinary.com/dmgvv9nbt/image/upload/v1787791066/torres_de_rio_03_dmvcik.jpg";

const EyeIcon = ({ visible }) => (
    visible ? (
        /* Icono Ojo Abierto */
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
    ) : (
        /* Icono Ojo Cerrado / Tachado */
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
    )
);

const CambiarContraseña = () => {
    const { register, watch, formState: { errors }, handleSubmit } = useForm();
    const [cargando, setCargando] = useState(false);
    const navigate = useNavigate();
    const toast = useToast();

    // 👁️ Al hacer click en el ojo, muestra la contraseña unos segundos y luego la vuelve a ocultar
    const [verNuevaContraseña, toggleVerNuevaContraseña] = useTemporaryPasswordReveal();
    const [verRepetirContraseña, toggleVerRepetirContraseña] = useTemporaryPasswordReveal();

    const nuevaContaseñaWatch = watch("nuevaContraseña")

    const onSubmit = async (data) => {
        try {
            setCargando(true);

            const payload = {
                nueva_password: data.nuevaContraseña,
                confirmar_password: data.repetirContraseña
            };

            console.log("Enviando al backend:", payload);

            await nuevaContraseña.cambiarContraseña(payload);

            toast.success("¡Contraseña establecida con éxito! Ingresando al sistema...");


            const userRolId = localStorage.getItem("rol_id");

            if (userRolId === "4") {
                navigate("/expedientes");
            } else {
                navigate("/expedientes");
            }

        } catch (error) {
            console.error("Error al cambiar la contraseña:", error.response?.data || error.message);
            toast.error("Hubo un problema al guardar tu contraseña. Intentá nuevamente.");
        } finally {
            setCargando(false);
        }
    };


    return (
        <div className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden p-4">
            {/* Imagen de fondo: una para pantallas chicas y otra para pantallas grandes, ambas se adaptan al tamaño */}
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat lg:hidden"
                style={{ backgroundImage: `url(${LOGIN_BG_URL_SM})` }}
            />
            <div
                className="absolute inset-0 hidden bg-cover bg-center bg-no-repeat lg:block"
                style={{ backgroundImage: `url(${LOGIN_BG_URL_LG})` }}
            />
            {/* Overlay para dar contraste y legibilidad al formulario */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-950/80 via-slate-900/70 to-black/80" />

            <form
                onSubmit={handleSubmit(onSubmit)}
                className="relative z-10 w-full max-w-sm rounded-3xl bg-white/75 backdrop-blur-xl p-6 sm:p-8 shadow-2xl border border-white/40"
            >

                <div className="flex flex-col items-center mb-6">
                    <div className="bg-blue-600 p-2.5 rounded-xl mb-3 shadow-lg shadow-blue-600/30">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h3 className="text-gray-800 font-semibold text-[13px] tracking-tight">IPVU Santiago del Estero</h3>
                    <p className="text-gray-400 text-[10px] mt-0.5 text-center leading-tight">
                        Instituto Provincial de Vivienda y Urbanismo
                    </p>
                </div>


                <div className="space-y-4">

                    {/* NUEVA CONTRASEÑA CON EL OJO */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-gray-800 font-bold text-xs ml-1">Nueva Contraseña:</label>
                        <div className="relative w-full flex items-center">
                            <input
                                type={verNuevaContraseña ? "text" : "password"}
                                autoComplete="new-password"
                                {...register('nuevaContraseña', {
                                    required: true,
                                    minLength: 8,
                                    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
                                })}
                                className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 focus:bg-white transition-all duration-200"
                            />
                            <button
                                type="button"
                                onClick={toggleVerNuevaContraseña}
                                className="absolute right-3 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                            >
                                <EyeIcon visible={verNuevaContraseña} />
                            </button>
                        </div>
                        {errors.nuevaContraseña?.type === 'required' && <p className="font-sans text-sm text-red-600">La contraseña es obligatoria</p>}
                        {errors.nuevaContraseña?.type === 'minLength' && <p className="font-sans text-sm text-red-600">Debe tener al menos 8 caracteres</p>}
                        {errors.nuevaContraseña?.type === 'pattern' && <p className="font-sans text-sm text-red-600">Debe incluir mayúscula, minúscula, un número y un carácter especial</p>}

                    </div>

                    {/* REPETIR CONTRASEÑA CON EL OJO */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-gray-800 font-bold text-xs ml-1">Repetir Contraseña</label>
                        <div className="relative w-full flex items-center">
                            <input
                                type={verRepetirContraseña ? "text" : "password"}
                                autoComplete="new-password"
                                {...register('repetirContraseña', {
                                    required: true,
                                    validate: (value) =>
                                        value === nuevaContaseñaWatch || "Las contraseñas no coinciden"
                                })}
                                className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 focus:bg-white transition-all duration-200"
                            />
                            <button
                                type="button"
                                onClick={toggleVerRepetirContraseña}
                                className="absolute right-3 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                            >
                                <EyeIcon visible={verRepetirContraseña} />
                            </button>
                        </div>
                        {errors.repetirContraseña?.type === 'required' && <p className="font-sans text-sm text-red-600">La contraseña es obligatoria</p>}
                        {errors.repetirContraseña?.type === 'validate' && <p className="font-sans text-sm text-red-600">{errors.repetirContraseña.message}</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={cargando}
                        className={`w-full text-white font-bold text-[13px] py-2.5 rounded-lg shadow-sm transition-colors duration-200 mt-2
                        ${cargando ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
                    >
                        {cargando ? "Guardando contraseña..." : "Cambiar Contraseña"}
                    </button>


                </div>

            </form>
        </div>
    )
}

export default CambiarContraseña
