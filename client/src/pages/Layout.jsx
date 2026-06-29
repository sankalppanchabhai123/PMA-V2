import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loadTheme } from '../features/themeSlice';
import { Loader2Icon } from 'lucide-react';
import { useUser, SignIn, useAuth, CreateOrganization, useOrganization } from '@clerk/react';
import { fetchWorkspaces } from '../features/workspaceSlice';

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCreatingOrg, setIsCreatingOrg] = useState(false);
    const [orgCreated, setOrgCreated] = useState(false);

    const { loading, workspaces } = useSelector((state) => state.workspace);
    const { organization } = useOrganization(); // Check Clerk's organization state
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user, isLoaded } = useUser();
    const { getToken } = useAuth();
    const hasFetchedWorkspaces = useRef(false);

    const handleOrganizationCreated = async (organization) => {
        console.log('Organization created:', organization);
        setIsCreatingOrg(true);
        setOrgCreated(true);

        try {
            // Fetch workspaces
            const result = await dispatch(fetchWorkspaces({ getToken })).unwrap();
            console.log('Workspaces after creation:', result);

            // Navigate after successful fetch
            navigate('/');
        } catch (error) {
            console.error('Error fetching workspaces:', error);
            // Show error state
            setIsCreatingOrg(false);
        }
    };

    // Initial load of theme
    useEffect(() => {
        dispatch(loadTheme());
    }, [dispatch]);

    // Initial load of workspaces
    useEffect(() => {
        if (isLoaded && user && workspaces?.length === 0 && !hasFetchedWorkspaces.current && !orgCreated) {
            hasFetchedWorkspaces.current = true;
            dispatch(fetchWorkspaces({ getToken }));
        }
    }, [user, isLoaded, workspaces, dispatch, getToken, orgCreated]);

    // Watch for workspaces update after organization creation
    useEffect(() => {
        if (isCreatingOrg && workspaces?.length > 0) {
            console.log('Workspaces loaded, navigating...');
            setIsCreatingOrg(false);
            navigate('/');
        }
    }, [workspaces, isCreatingOrg, navigate]);

    // If user is not authenticated
    if (!user) {
        return (
            <div className='flex justify-center items-center h-screen bg-white'>
                <SignIn />
            </div>
        );
    }

    // If loading workspaces
    if (loading) {
        return (
            <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
                <Loader2Icon className="size-7 text-blue-500 animate-spin" />
            </div>
        );
    }

    // If creating organization
    if (isCreatingOrg) {
        return (
            <div className='flex flex-col items-center justify-center h-screen bg-white dark:bg-zinc-950'>
                <Loader2Icon className="size-10 text-blue-500 animate-spin" />
                <p className="mt-4 text-gray-600 dark:text-gray-400">
                    Setting up your workspace...
                </p>
            </div>
        );
    }

    // Show CreateOrganization if no workspaces
    // Check both Redux state AND Clerk organization state
    if (user && workspaces?.length === 0 && !organization) {
        return (
            <div className='min-h-screen flex flex-col justify-center items-center bg-gray-50 dark:bg-zinc-900'>
                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-8 w-full max-w-md">
                    <h1 className="text-2xl font-bold text-center mb-2">
                        Create Your Workspace
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                        Get started by creating your first workspace.
                    </p>
                    <CreateOrganization
                        afterCreateOrganizationUrl="/"
                        afterCreateOrganization={handleOrganizationCreated}
                        skipInvitationScreen={true}
                    />
                </div>
            </div>
        );
    }

    // Main layout with workspaces
    return (
        <div className="flex bg-white dark:bg-zinc-950 text-gray-900 dark:text-slate-100">
            <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
            <div className="flex-1 flex flex-col h-screen">
                <Navbar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
                <div className="flex-1 h-full p-6 xl:p-10 xl:px-16 overflow-y-scroll">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default Layout;