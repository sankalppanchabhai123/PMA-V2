import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentWorkspace } from "../features/workspaceSlice";
import { useNavigate } from "react-router-dom";
import { useClerk, useOrganizationList } from "@clerk/react";

function WorkspaceDropdown() {
    const { setActive, userMemberships, isLoaded } = useOrganizationList({
        userMemberships: true
    });

    const { openCreateOrganization } = useClerk();
    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace || null);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const dispatch = useDispatch();
    const navigate = useNavigate();

    // Get the full organization object from memberships
    const currentOrg = userMemberships?.data?.find(
        ({ organization }) => organization.id === currentWorkspace?.id
    )?.organization;

    // If no current workspace is set, use the first organization
    const selectedOrg = currentOrg || userMemberships?.data?.[0]?.organization || null;

    const onSelectWorkspace = async (organization) => {
        try {
            await setActive({ organization: organization.id });
            dispatch(setCurrentWorkspace(organization));
            setIsOpen(false);
            navigate('/');
        } catch (error) {
            console.error("Failed to switch workspace:", error);
        }
    };

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Set initial workspace when data loads
    useEffect(() => {
        if (isLoaded && userMemberships?.data?.length > 0 && !currentWorkspace) {
            const firstOrg = userMemberships.data[0].organization;
            dispatch(setCurrentWorkspace(firstOrg));
            setActive({ organization: firstOrg.id });
        }
    }, [isLoaded, userMemberships, currentWorkspace, dispatch, setActive]);

    // If no workspace is selected or data is loading, show loading state
    if (!isLoaded) {
        return (
            <div className="relative m-4">
                <div className="w-full flex items-center justify-between p-3 h-auto text-left rounded">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded shadow bg-gray-200 dark:bg-zinc-700 animate-pulse"></div>
                        <div>
                            <div className="h-4 w-32 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse"></div>
                            <div className="h-3 w-20 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse mt-1"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative m-4" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center justify-between p-3 h-auto text-left rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
                <div className="flex items-center gap-3">
                    {selectedOrg?.imageUrl ? (
                        <img
                            src={selectedOrg.imageUrl}
                            alt={selectedOrg?.name || "Workspace"}
                            className="w-8 h-8 rounded shadow"
                            onError={(e) => {
                                e.target.src = `https://ui-avatars.com/api/?name=${selectedOrg?.name || 'W'}&background=random`;
                            }}
                        />
                    ) : (
                        <div className="w-8 h-8 rounded shadow bg-gray-200 dark:bg-zinc-700 flex items-center justify-center">
                            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                                {selectedOrg?.name?.[0] || "W"}
                            </span>
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800 dark:text-white text-sm truncate">
                            {selectedOrg?.name || "Select Workspace"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                            {userMemberships?.data?.length || 0} workspace{userMemberships?.data?.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-zinc-400 flex-shrink-0" />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-64 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded shadow-lg top-full left-0">
                    <div className="p-2">
                        <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2 px-2">
                            Workspaces
                        </p>
                        {userMemberships?.data?.map(({ organization }) => (
                            <div
                                key={organization.id}
                                onClick={() => onSelectWorkspace(organization)}
                                className="flex items-center gap-3 p-2 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
                            >
                                {organization.imageUrl ? (
                                    <img
                                        src={organization.imageUrl}
                                        alt={organization.name}
                                        className="w-6 h-6 rounded"
                                        onError={(e) => {
                                            e.target.src = `https://ui-avatars.com/api/?name=${organization.name}&background=random`;
                                        }}
                                    />
                                ) : (
                                    <div className="w-6 h-6 rounded bg-gray-200 dark:bg-zinc-700 flex items-center justify-center">
                                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                            {organization.name?.[0]}
                                        </span>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                                        {organization.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                                        {organization.membersCount || 0} members
                                    </p>
                                </div>
                                {selectedOrg?.id === organization.id && (
                                    <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                )}
                            </div>
                        ))}
                    </div>

                    <hr className="border-gray-200 dark:border-zinc-700" />

                    <div
                        onClick={() => {
                            openCreateOrganization();
                            setIsOpen(false);
                        }}
                        className="p-2 cursor-pointer rounded group hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                        <p className="flex items-center text-xs gap-2 my-1 w-full text-blue-600 dark:text-blue-400 group-hover:text-blue-500 dark:group-hover:text-blue-300">
                            <Plus className="w-4 h-4" /> Create Workspace
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WorkspaceDropdown;