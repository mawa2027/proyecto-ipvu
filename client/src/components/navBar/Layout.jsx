
import { Outlet } from "react-router"
import NavBar from "./NavBar"

const Layout = () => {
    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 transition-colors">
            <NavBar />
            <div className="pt-14">
                <Outlet />
            </div>
        </div>
    )
}

export default Layout