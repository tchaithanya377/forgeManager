import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserPlus, 
  Edit2, 
  Trash2, 
  Search,
  Users as UsersIcon,
  FolderPlus,
  Check,
  X,
  Users
} from 'lucide-react';
import { createNewUser, getUsers, updateUser, deleteUser, ROLES, DEPARTMENTS, type Role, type Department, createTeam, getTeams } from '../lib/firebase';
import { useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';

// Updated User interface to support multiple roles and required department
interface User {
  id: string;
  email: string;
  fullName: string;
  roles: Role[]; // Changed from role: Role
  department: Department; // Made required
  permissions?: string[];
  status: string;
  createdAt: any;
  reportsTo?: string;
}

// Team interface
interface Team {
  id: string;
  name: string;
  department: Department;
  roles: Role[];
  leadId: string;
  memberIds: string[];
}

// Mapping of departments to allowed roles
const DEPARTMENT_ROLES: Record<Department, Role[]> = {
  'Engineering': ['Developer', 'QA', 'DevOps'],
  'Marketing': ['Designer', 'Content Creator', 'SEO Specialist'],
  'Sales': ['Sales Representative', 'Account Manager'],
  // Adjust based on actual DEPARTMENTS and ROLES from '../lib/firebase'
};

function UserManagement() {
  const queryClient = useQueryClient();
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    roles: [] as Role[],
    department: '' as Department,
    reportsTo: '' as string,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [departmentFilter, setDepartmentFilter] = useState<Department | ''>('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkAssignTo, setBulkAssignTo] = useState<string>('');
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    department: '' as Department,
    roles: [] as Role[],
    leadId: '',
    memberIds: [] as string[],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery('users', getUsers, {
    staleTime: 5 * 60 * 1000,
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery('teams', getTeams, {
    staleTime: 5 * 60 * 1000,
  });

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach(user => map.set(user.id, user.fullName));
    return map;
  }, [users]);

  const filteredUsers = useMemo(() => 
    users.filter((user: User) => {
      const matchesSearch = 
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.roles.some(role => role.toLowerCase().includes(searchTerm.toLowerCase())) ||
        user.department.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = !roleFilter || user.roles.includes(roleFilter);
      const matchesDepartment = !departmentFilter || user.department === departmentFilter;
      
      return matchesSearch && matchesRole && matchesDepartment;
    }),
    [users, searchTerm, roleFilter, departmentFilter]
  );

  const handleUserSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!userFormData.department) {
      toast.error('Please select a department');
      return;
    }
    if (userFormData.roles.length === 0) {
      toast.error('Please select at least one role');
      return;
    }
    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          fullName: userFormData.fullName,
          roles: userFormData.roles,
          department: userFormData.department,
          reportsTo: userFormData.reportsTo || null,
        });
        toast.success('User updated successfully');
      } else {
        await createNewUser({
          ...userFormData,
          reportsTo: userFormData.reportsTo || null,
        });
        toast.success('User created successfully');
      }
      setShowUserModal(false);
      setEditingUser(null);
      queryClient.invalidateQueries('users');
    } catch (error: any) {
      toast.error(error.message || (editingUser ? 'Failed to update user' : 'Failed to create user'));
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setUserFormData({
      email: user.email,
      password: '',
      fullName: user.fullName,
      roles: user.roles,
      department: user.department,
      reportsTo: user.reportsTo || '',
    });
    setShowUserModal(true);
  };

  const handleDelete = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteUser(userId);
        toast.success('User deleted successfully');
        queryClient.invalidateQueries('users');
      } catch (error) {
        toast.error('Failed to delete user');
      }
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignTo) {
      toast.error('Please select a user to assign to');
      return;
    }
    try {
      await Promise.all(selectedUsers.map(userId => 
        updateUser(userId, { reportsTo: bulkAssignTo })
      ));
      toast.success('Users assigned successfully');
      setSelectedUsers([]);
      setShowBulkAssign(false);
      queryClient.invalidateQueries('users');
    } catch (error) {
      toast.error('Failed to assign users');
    }
  };

  const handleTeamSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!teamFormData.name) {
      toast.error('Please enter a team name');
      return;
    }
    if (!teamFormData.department) {
      toast.error('Please select a department');
      return;
    }
    if (teamFormData.roles.length === 0) {
      toast.error('Please select at least one role');
      return;
    }
    if (!teamFormData.leadId) {
      toast.error('Please select a team lead');
      return;
    }
    try {
      await createTeam({
        name: teamFormData.name,
        department: teamFormData.department,
        roles: teamFormData.roles,
        leadId: teamFormData.leadId,
        memberIds: teamFormData.memberIds,
      });
      toast.success('Team created successfully');
      setShowTeamModal(false);
      setTeamFormData({ name: '', department: '' as Department, roles: [], leadId: '', memberIds: [] });
      queryClient.invalidateQueries('teams');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create team');
    }
  };

  const getRoleBadgeColor = (role: Role) => {
    switch (role) {
      case 'Super Admin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'Admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Project Manager':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Team Lead':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getEligibleTeamUsers = () => {
    return users.filter(user => 
      user.department === teamFormData.department &&
      user.roles.some(role => teamFormData.roles.includes(role))
    );
  };

  if (usersLoading || teamsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">User & Team Management</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your team members, roles, and teams
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {selectedUsers.length > 0 && (
            <button
              onClick={() => setShowBulkAssign(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center hover:bg-green-700"
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              Assign to Group
            </button>
          )}
          <button
            onClick={() => {
              setEditingUser(null);
              setUserFormData({
                email: '',
                password: '',
                fullName: '',
                roles: [],
                department: '' as Department,
                reportsTo: '',
              });
              setShowUserModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center hover:bg-blue-700"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </button>
          <button
            onClick={() => setShowTeamModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center hover:bg-purple-700"
          >
            <Users className="w-4 h-4 mr-2" />
            Create Team
          </button>
        </div>
      </div>

      {/* Users Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:text-white sm:text-sm"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as Role)}
              className="block w-full md:w-48 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:text-white sm:text-sm"
            >
              <option value="">All Roles</option>
              {Object.values(ROLES).map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value as Department)}
              className="block w-full md:w-48 py-2 px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:text-white sm:text-sm"
            >
              <option value="">All Departments</option>
              {Object.values(DEPARTMENTS).map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers(filteredUsers.map(u => u.id));
                      } else {
                        setSelectedUsers([]);
                      }
                    }}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Roles</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reports To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user: User) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers([...selectedUsers, user.id]);
                        } else {
                          setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                        }
                      }}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <img
                          className="h-10 w-10 rounded-full"
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.fullName}`}
                          alt=""
                          loading="lazy"
                        />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{user.fullName}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map(role => (
                        <span key={role} className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(role)}`}>
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.department}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {user.reportsTo ? userMap.get(user.reportsTo) || 'Unknown' : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Teams Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Teams</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Team Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Roles</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lead</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Members</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {teams.map((team: Team) => (
                <tr key={team.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{team.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{team.department}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{team.roles.join(', ')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{userMap.get(team.leadId) || 'Unknown'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{team.memberIds.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  {editingUser ? 'Edit User' : 'Add New User'}
                </h3>
                <div className="mt-2 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                    <input
                      type="email"
                      required
                      disabled={!!editingUser}
                      value={userFormData.email}
                      onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    />
                  </div>
                  {!editingUser && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                      <input
                        type="password"
                        required
                        value={userFormData.password}
                        onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                    <input
                      type="text"
                      required
                      value={userFormData.fullName}
                      onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Department</label>
                    <select
                      value={userFormData.department}
                      onChange={(e) => {
                        const newDept = e.target.value as Department;
                        setUserFormData({ ...userFormData, department: newDept, roles: [] });
                      }}
                      required
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    >
                      <option value="">Select Department</option>
                      {Object.values(DEPARTMENTS).map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Roles</label>
                    <select
                      multiple
                      value={userFormData.roles}
                      onChange={(e) => {
                        const selectedRoles = Array.from(e.target.selectedOptions, option => option.value as Role);
                        setUserFormData({ ...userFormData, roles: selectedRoles });
                      }}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    >
                      {(DEPARTMENT_ROLES[userFormData.department] || []).map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reports To</label>
                    <select
                      value={userFormData.reportsTo}
                      onChange={(e) => setUserFormData({ ...userFormData, reportsTo: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    >
                      <option value="">None</option>
                      {users.filter(u => u.id !== editingUser?.id).map(user => (
                        <option key={user.id} value={user.id}>{user.fullName} ({user.roles.join(', ')})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleUserSubmit}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {editingUser ? 'Update' : 'Create'}
                </button>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {showTeamModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Create New Team</h3>
                <div className="mt-2 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Team Name</label>
                    <input
                      type="text"
                      required
                      value={teamFormData.name}
                      onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Department</label>
                    <select
                      value={teamFormData.department}
                      onChange={(e) => {
                        const newDept = e.target.value as Department;
                        setTeamFormData({ ...teamFormData, department: newDept, roles: [], leadId: '', memberIds: [] });
                      }}
                      required
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    >
                      <option value="">Select Department</option>
                      {Object.values(DEPARTMENTS).map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Roles</label>
                    <select
                      multiple
                      value={teamFormData.roles}
                      onChange={(e) => {
                        const selectedRoles = Array.from(e.target.selectedOptions, option => option.value as Role);
                        setTeamFormData({ ...teamFormData, roles: selectedRoles, leadId: '', memberIds: [] });
                      }}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    >
                      {Object.values(ROLES).map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Team Lead</label>
                    <select
                      value={teamFormData.leadId}
                      onChange={(e) => setTeamFormData({ ...teamFormData, leadId: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    >
                      <option value="">Select Team Lead</option>
                      {getEligibleTeamUsers().map(user => (
                        <option key={user.id} value={user.id}>{user.fullName} ({user.roles.join(', ')})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Team Members</label>
                    <div className="mt-1 max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2">
                      {getEligibleTeamUsers().filter(user => user.id !== teamFormData.leadId).map(user => (
                        <div key={user.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={teamFormData.memberIds.includes(user.id)}
                            onChange={(e) => {
                              const memberIds = e.target.checked
                                ? [...teamFormData.memberIds, user.id]
                                : teamFormData.memberIds.filter(id => id !== user.id);
                              setTeamFormData({ ...teamFormData, memberIds });
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{user.fullName} ({user.roles.join(', ')})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleTeamSubmit}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Create Team
                </button>
                <button
                  onClick={() => setShowTeamModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulkAssign && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Assign Users to Group</h3>
                <div className="mt-2 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Assign to User</label>
                    <select
                      value={bulkAssignTo}
                      onChange={(e) => setBulkAssignTo(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    >
                      <option value="">Select User</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.fullName} ({user.roles.join(', ')})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleBulkAssign}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Assign
                </button>
                <button
                  onClick={() => setShowBulkAssign(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
