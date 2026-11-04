import { UserPlusIcon, UsersIcon, DocumentTextIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router';

export const ADMIN_LINKS = [
    { title: "Usuarios", Icon: UserPlusIcon, to: "/usuarios" },
    { title: "Trabajador Social", Icon: UsersIcon, to: "/trabajadoraSocial" },
    { title: "Auditoría", Icon: ClipboardDocumentListIcon, to: "/auditoria" },
    { title: "Expedientes", Icon: DocumentTextIcon, to: "/expedientes" },
];

export const AdminLinkCard = ({ title, Icon, to }) => {
    return (
        <Link
            to={to}
            className="flex-1 min-w-[220px] flex items-center justify-between gap-3
                 border border-gray-200 dark:border-slate-700
                 rounded-2xl shadow-sm
                 p-4 bg-white dark:bg-slate-900
                 cursor-pointer
                 transition-all duration-200
                 hover:-translate-y-0.5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500"
        >
            <h3 className="font-semibold text-gray-800 dark:text-slate-100 text-sm sm:text-base">
                {title}
            </h3>
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10">
                <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
        </Link>
    );
};

const AdminQuickLinks = ({ excludePaths = [] }) => {
    const links = ADMIN_LINKS.filter((link) => !excludePaths.includes(link.to));

    if (links.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-3">
            {links.map((link) => (
                <AdminLinkCard key={link.to} {...link} />
            ))}
        </div>
    );
};

export default AdminQuickLinks;
