import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { usuarioService } from '../../../services/usuarios/usuarios';
import { useToast } from '../../../context/ToastContext';

const FormUsuario = () => {
    const navigate = useNavigate();
    const toast = useToast();
    // Inicializamos React Hook Form
    const { register, watch, setValue, formState: { errors }, handleSubmit, reset } = useForm();
    const [open, setOpen] = useState(false);
    const [perfilSeleccionado, setPerfilSeleccionado] = useState("");
    const [cargando, setCargando] = useState(false);


    const handleSelect = (perfilNombre, rolId) => {
        setPerfilSeleccionado(perfilNombre);

        setValue("rol_id", rolId, {
            shouldValidate: true,
            shouldDirty: true
        });

        setOpen(false);
    }

    const onSubmit = async (data) => {
        try {
            setCargando(true);

            const payload = {
                nombre: data.nombre,
                apellido: data.apellido,
                dni: data.dni,
                email: data.email,
                rol: data.rol_id
            };

            const matricula = data.matricula?.trim();
            if (matricula) {
                payload.matricula = matricula;
            }

            const crearUsuario = await usuarioService.postUsuario(payload)
            console.log('crearUsuario :>> ', crearUsuario);
            toast.success("¡Usuario creado con éxito!");

            reset()
            setPerfilSeleccionado("")
            navigate("/expedientes")

        } catch (error) {
            console.error(error);
            toast.error("Error al crear el usuario.");
        } finally {
            setCargando(false);
        }
    }

    return (
        <div className="w-full flex flex-col items-center p-4 py-8">
            <div className="w-full max-w-3xl flex flex-col gap-4">
                <div>
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold transition group"
                    >
                        <ArrowLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                        <span>Volver</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="w-full rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-xl dark:shadow-black/30 border border-gray-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-5 transition-colors">

                <h3 className="text-gray-800 dark:text-slate-100 font-bold text-[18px] tracking-tight text-center col-span-full">
                    Crear Usuario
                </h3>

                <div className='grid grid-cols-1 gap-1.5'>
                    <label className="text-gray-800 dark:text-slate-200 font-semibold text-sm ml-1">Nombre</label>
                    <input
                        type="text"
                        autoComplete="given-name"
                        {...register('nombre', { required: "El nombre es obligatorio" })}
                        className="w-full px-3 py-2 font-normal text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200 rounded-md"
                    />
                    {errors.nombre && <p className="text-xs text-red-600 dark:text-red-400 ml-1">{errors.nombre.message}</p>}
                </div>

                <div className='grid grid-cols-1 gap-1.5'>
                    <label className="text-gray-800 dark:text-slate-200 font-semibold text-sm ml-1">Apellido</label>
                    <input
                        type="text"
                        autoComplete="family-name"
                        {...register('apellido', { required: "El apellido es obligatorio" })}
                        className="w-full px-3 py-2 font-normal text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200 rounded-md"
                    />
                    {errors.apellido && <p className="text-xs text-red-600 dark:text-red-400 ml-1">{errors.apellido.message}</p>}
                </div>

                <div className='grid grid-cols-1 gap-1.5'>
                    <label className="text-gray-800 dark:text-slate-200 font-semibold text-sm ml-1">DNI</label>
                    <input
                        type="text"
                        {...register('dni', {
                            required: "El DNI es obligatorio",
                            pattern: { value: /^\d+$/, message: "Solo se permiten números" },
                            minLength: { value: 7, message: "El DNI debe tener mas de 7 caracteres" },
                            maxLength: { value: 9, message: "El DNI debe tener menos de 9 caracteres" },
                        })}
                        className="w-full px-3 py-2 font-normal text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200 rounded-md"
                    />
                    {errors.dni && <p className="text-xs text-red-600 dark:text-red-400 ml-1">{errors.dni.message}</p>}
                </div>

                <div className='grid grid-cols-1 gap-1.5'>
                    <label className="text-gray-800 dark:text-slate-200 font-semibold text-sm ml-1">Matrícula <span className="text-gray-400 dark:text-slate-500 font-normal">(opcional)</span></label>
                    <input
                        type="text"
                        {...register('matricula', {
                            maxLength: { value: 20, message: "La matrícula debe tener menos de 20 caracteres" }
                        })}
                        className="w-full px-3 py-2 font-normal text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200 rounded-md"
                    />
                    {errors.matricula && <p className="text-xs text-red-600 dark:text-red-400 ml-1">{errors.matricula.message}</p>}
                </div>

                <div className='grid grid-cols-1 gap-1.5'>
                    <label className="text-gray-800 dark:text-slate-200 font-semibold text-sm ml-1">Email</label>
                    <input
                        type="email"
                        autoComplete="email"
                        {...register('email', {
                            required: "El email es obligatorio",
                            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Formato de email inválido" }
                        })}
                        className="w-full px-3 py-2 font-normal text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200 rounded-md"
                    />
                    {errors.email && <p className="text-xs text-red-600 dark:text-red-400 ml-1">{errors.email.message}</p>}
                </div>

                <div className="relative grid grid-cols-1 gap-1.5">
                    <label className="text-gray-800 dark:text-slate-200 font-semibold text-sm ml-1">Perfil</label>


                    <input type="hidden" {...register('rol_id', { required: "Debes seleccionar un perfil" })} />

                    <button
                        type="button"
                        onClick={() => setOpen(!open)}
                        className="w-full px-3 py-2 text-sm border font-normal border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-100 rounded-md text-left hover:bg-white dark:hover:bg-slate-700 focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500/40 transition-colors"
                    >
                        {perfilSeleccionado || "Seleccionar perfil"}
                    </button>

                    {open && (
                        <div className="absolute w-full mt-[70px] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">

                            <div
                                onClick={() => handleSelect("Trabajadora Social", 1)}
                                className="px-3 py-2 text-sm font-normal text-gray-800 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
                            >
                                Trabajadora Social
                            </div>

                            <div
                                onClick={() => handleSelect("Legales", 2)}
                                className="px-3 py-2 text-sm font-normal text-gray-800 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
                            >
                                Legales
                            </div>

                            <div
                                onClick={() => handleSelect("Mesa de Entrada", 3)}
                                className="px-3 py-2 text-sm font-normal text-gray-800 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
                            >
                                Data Entry
                            </div>

                            <div
                                onClick={() => handleSelect("Administrador", 4)}
                                className="px-3 py-2 text-sm font-normal text-gray-800 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
                            >
                                Administrador
                            </div>

                        </div>
                    )}
                    {errors.rol_id && <p className="text-xs text-red-600 dark:text-red-400 ml-1">{errors.rol_id.message}</p>}
                </div>

                <div className="col-span-full flex justify-center mt-2">
                    <button
                        type="submit"
                        disabled={cargando}
                        className={`text-white font-bold text-sm px-6 py-2 rounded-lg shadow-sm transition-colors duration-200
                        ${cargando ? 'bg-gray-400 dark:bg-slate-600 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
                    >
                        {cargando ? "Creando..." : "Crear Usuario"}
                    </button>
                </div>

                </form>
            </div>
        </div>
    )
}

export default FormUsuario;