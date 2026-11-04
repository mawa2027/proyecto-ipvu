import { Navigate, Outlet } from "react-router";

const HOME_POR_ROL = {
    "1": "/expedientes",
    "2": "/expedientes",
    "3": "/expedientes",
    "4": "/expedientes",
};

const ProtectedRoute = ({ allowedRoles }) => {
    const token = localStorage.getItem("token");
    const rolId = localStorage.getItem("rol_id");

    if (!token || !rolId) {
        return <Navigate to="/login" replace />;
    }

    if (!allowedRoles.includes(rolId)) {
        return <Navigate to={HOME_POR_ROL[rolId] || "/login"} replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
