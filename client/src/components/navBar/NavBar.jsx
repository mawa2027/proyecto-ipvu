import { useNavigate } from "react-router";
import { SunIcon, MoonIcon, ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { authService } from "../../services/authService/authService";
import useTheme from "../../hooks/useTheme";
import NotificacionesDataEntry from "./NotificacionesDataEntry";

const NavBar = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();

    const nombreUsuario = localStorage.getItem("nombre_completo")

    const iniciales = (nombreUsuario || "")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((palabra) => palabra[0]?.toUpperCase())
        .join("") || "?";

    const handleLogout = () => {
        authService.cerrarSesion()

        navigate("/login")
    }

    const onClickUsuario = () => {
        try {
            const userRolId = localStorage.getItem("rol_id");

            switch (userRolId) {
                // trabajadora social
                case "1":
                    navigate("/expedientes");
                    break;

                case "2":
                    navigate("/expedientes");
                    break;

                // data entry
                case "3":
                    navigate("/expedientes");
                    break;

                case "4":
                    navigate("/expedientes");
                    break;
            }

        } catch (err) {
            console.log(err)
        }
    }

    return (
        <nav className="fixed top-0 left-0 z-50 w-full h-14 px-4 flex items-center justify-between border-b border-blue-800/50 bg-blue-600/90 dark:bg-slate-900/90 backdrop-blur-md shadow-sm transition-colors">

            <div className="flex items-center gap-2.5 cursor-pointer" onClick={onClickUsuario}>
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/15">
                    <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                    </svg>
                </div>
                <h3 className="hidden sm:block text-white text-[15px] leading-tight font-semibold tracking-tight">
                    IPVU Santiago del Estero
                </h3>
                <h3 className="sm:hidden text-white text-[15px] font-semibold">
                    IPVU
                </h3>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
                {/* por ahora solo la data entry tiene campanita */}
                {localStorage.getItem("rol_id") === "3" && <NotificacionesDataEntry />}

                <button
                    onClick={toggleTheme}
                    title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-white/90 hover:bg-white/15 transition-colors focus:outline-none"
                >
                    {theme === "dark" ? (
                        <SunIcon className="w-5 h-5" />
                    ) : (
                        <MoonIcon className="w-5 h-5" />
                    )}
                </button>

                <div className="hidden sm:flex items-center gap-2 pl-1 pr-1">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/15 text-white text-xs font-bold">
                        {iniciales}
                    </div>
                    <span className="text-white text-sm font-medium max-w-[140px] truncate">
                        {nombreUsuario}
                    </span>
                </div>

                <button
                    onClick={handleLogout}
                    title="Salir"
                    className="flex items-center gap-1.5 text-white px-2.5 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg font-semibold text-sm transition-colors cursor-pointer"
                >
                    <ArrowRightStartOnRectangleIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Salir</span>
                </button>
            </div>
        </nav>
    );
};

export default NavBar;